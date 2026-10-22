// Test-only upstream: exercises real browser -> BFF -> HTTP service requests.
const http = require("node:http");
const base = {
  namespace: "payments",
  matching_state: "active",
  build_state: "idle",
  active_digest: `sha256:${"abcdef1234567890".repeat(4)}`,
  contract_version: "v1",
  triggers: [
    { field: "application", value: "payments" },
    { field: "severity", value: "critical" },
  ],
  script: "def handle(alert):\n    return {'ok': True}",
  secret_name: "payments-secret",
  cooldown_seconds: 60,
  cooldown_fields: ["application"],
  timeout_seconds: 300,
  grace_seconds: 300,
  logstash_url: "https://logs.example.test",
  delete_cascade_step: null,
  index_generation: 1,
  created_at: "2026-10-12T10:00:00Z",
  updated_at: "2026-10-12T12:00:00Z",
  created_by: "alice",
  updated_by: "bob",
  last_run: {
    id: "run-1",
    state: "succeeded",
    created_at: "2026-10-12T12:00:00Z",
  },
};
let rows, requests, scenario;
function reset() {
  rows = [
    { ...base, id: "payments", name: "Restart payments" },
    {
      ...base,
      id: "unbuilt",
      name: "Unbuilt automation",
      namespace: "platform",
      matching_state: "inactive",
      active_digest: null,
      last_run: null,
    },
    {
      ...base,
      id: "building",
      name: "Building automation",
      build_state: "building",
    },
    {
      ...base,
      id: "failed",
      name: "Failed build automation",
      build_state: "build_failed",
    },
  ];
  requests = [];
  scenario = {};
}
reset();
http
  .createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:3199");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "authorization,content-type,ngrok-skip-browser-warning,x-keep-source"
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,DELETE,OPTIONS"
    );
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }
    const url = new URL(req.url, "http://localhost");
    let body = "";
    for await (const chunk of req) body += chunk;
    const send = (status, payload) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
    };
    if (url.pathname === "/health") return send(200, { ok: true });
    if (url.pathname === "/__reset") {
      reset();
      return send(200, {});
    }
    if (url.pathname === "/__scenario") {
      scenario = JSON.parse(body);
      return send(200, {});
    }
    if (url.pathname === "/__requests") return send(200, requests);
    requests.push({
      path: url.pathname,
      search: url.search,
      method: req.method,
      authorization: req.headers.authorization,
      body,
    });
    if (url.pathname === "/namespaces")
      return scenario.namespacesError
        ? send(503, { detail: "Unavailable" })
        : send(200, {
            namespaces: [
              { namespace: "payments" },
              { namespace: "platform" },
              { namespace: "unused-wallet" },
            ],
          });
    if (url.pathname === "/automations") {
      if (scenario.listError)
        return send(scenario.listError, { detail: "Unavailable" });
      return send(200, {
        automations: rows.filter((row) =>
          ["namespace", "matching_state", "build_state"].every(
            (key) =>
              !url.searchParams.get(key) ||
              row[key] === url.searchParams.get(key)
          )
        ),
      });
    }
    const match = url.pathname.match(
      /^\/automations\/([^/]+)(?:\/(enable|disable))?$/
    );
    if (match) {
      const row = rows.find((row) => row.id === match[1]);
      if (!row) return send(404, { detail: "Not found" });
      if (req.method === "GET") {
        if (scenario.detailError)
          return send(scenario.detailError, { detail: "Unavailable" });
        if (row.matching_state === "deleting" && row.deleteReads++ > 0) {
          row.matching_state = "deleted";
          row.delete_cascade_step = 4;
        }
        return send(200, row);
      }
      if (scenario.mutationError)
        return send(scenario.mutationError, {
          detail: "Lifecycle unavailable",
        });
      if (req.method === "DELETE") {
        if (row.build_state === "building")
          return send(409, { detail: "Building" });
        row.matching_state = "deleting";
        row.delete_cascade_step = 0;
        row.deleteReads = 0;
      } else if (req.method === "POST" && match[2]) {
        if (match[2] === "enable" && !row.active_digest?.trim())
          return send(409, { detail: "No digest" });
        row.matching_state = match[2] === "enable" ? "active" : "inactive";
      } else return send(405, { detail: "Method not allowed" });
      return send(req.method === "DELETE" ? 202 : 200, {
        id: row.id,
        matching_state: row.matching_state,
        build_state: row.build_state,
        active_digest: row.active_digest,
        delete_cascade_step: row.delete_cascade_step,
        index_generation: ++row.index_generation,
        updated_at: base.updated_at,
        updated_by: "tester",
      });
    }
    // Minimal application-shell responses, unrelated to automation data.
    if (url.pathname === "/settings/tenant/configuration") return send(200, {});
    if (url.pathname === "/settings/user/preferences") return send(200, {});
    if (url.pathname === "/preset" || url.pathname === "/dashboards")
      return send(200, []);
    if (url.pathname === "/whoami") return send(200, { role: "admin" });
    return send(200, []);
  })
  .listen(4199, "127.0.0.1", () =>
    console.log("Automation fixture upstream listening on 4199")
  );
