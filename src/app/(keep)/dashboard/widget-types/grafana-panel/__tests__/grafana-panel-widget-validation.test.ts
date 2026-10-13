import {
  GRAFANA_PANEL_SANDBOX,
  extractGrafanaPanelUrl,
  validateGrafanaPanelUrl,
} from "../grafana-panel-widget-validation";

const GRAFANA = "https://grafana.example.com";
const APP = "https://keep.example.com";
const PANEL = `${GRAFANA}/d-solo/abc/demo?orgId=1&panelId=2&theme=light`;

describe("extractGrafanaPanelUrl", () => {
  it("returns a plain URL trimmed", () => {
    expect(extractGrafanaPanelUrl(`  ${PANEL}  `)).toBe(PANEL);
  });

  it("pulls the src out of a pasted Grafana iframe snippet", () => {
    const snippet = `<iframe src="${PANEL.replace(
      /&/g,
      "&amp;"
    )}" width="450" height="200" frameborder="0"></iframe>`;
    expect(extractGrafanaPanelUrl(snippet)).toBe(PANEL);
  });

  it("returns empty for markup without an iframe src", () => {
    expect(extractGrafanaPanelUrl("<div>hello</div>")).toBe("");
    expect(extractGrafanaPanelUrl("<iframe></iframe>")).toBe("");
  });
});

describe("validateGrafanaPanelUrl", () => {
  const allowed = [GRAFANA];

  it("accepts a URL on an allowed origin", () => {
    expect(validateGrafanaPanelUrl(PANEL, allowed, APP)).toBeNull();
  });

  it("requires a URL", () => {
    expect(validateGrafanaPanelUrl("  ", allowed, APP)).toMatch(/required/i);
  });

  it("rejects unparseable URLs", () => {
    expect(validateGrafanaPanelUrl("grafana/d-solo", allowed, APP)).toMatch(
      /valid url/i
    );
  });

  it("rejects non-http(s) schemes even when the text looks allowed", () => {
    expect(
      validateGrafanaPanelUrl("javascript:alert(1)", allowed, APP)
    ).toMatch(/http/i);
    expect(
      validateGrafanaPanelUrl(
        "data:text/html,<script>alert(1)</script>",
        allowed,
        APP
      )
    ).toMatch(/http/i);
  });

  it("rejects scheme-relative forms that would resolve onto Keep's origin", () => {
    expect(
      validateGrafanaPanelUrl(
        "https:grafana.example.com/d-solo/x",
        allowed,
        APP
      )
    ).toMatch(/full url/i);
    expect(
      validateGrafanaPanelUrl(
        "https:/grafana.example.com/../backend/docs",
        allowed,
        APP
      )
    ).toMatch(/full url/i);
    expect(
      validateGrafanaPanelUrl("https:\\grafana.example.com/x", allowed, APP)
    ).toMatch(/full url/i);
  });

  it("fails closed when Keep's origin is unknown", () => {
    expect(validateGrafanaPanelUrl(PANEL, allowed, "")).not.toBeNull();
  });

  it("reports embedding as disabled when no origins are allowed", () => {
    expect(validateGrafanaPanelUrl(PANEL, [], APP)).toMatch(/not enabled/i);
  });

  it("rejects origins outside the allowlist, including look-alikes", () => {
    expect(
      validateGrafanaPanelUrl("https://evil.example.com/x", allowed, APP)
    ).toMatch(/not an allowed grafana/i);
    expect(
      validateGrafanaPanelUrl(
        "https://grafana.example.com.evil.io/x",
        allowed,
        APP
      )
    ).toMatch(/not an allowed grafana/i);
    expect(
      validateGrafanaPanelUrl("http://grafana.example.com/x", allowed, APP)
    ).toMatch(/not an allowed grafana/i);
    expect(
      validateGrafanaPanelUrl(
        "https://grafana.example.com:8443/x",
        allowed,
        APP
      )
    ).toMatch(/not an allowed grafana/i);
  });

  it("accepts only single-panel /d-solo/ URLs on an allowed Grafana", () => {
    expect(
      validateGrafanaPanelUrl(`${GRAFANA}/d/abc/demo?orgId=1`, allowed, APP)
    ).toMatch(/d-solo/);
    expect(
      validateGrafanaPanelUrl(`${GRAFANA}/explore?orgId=1`, allowed, APP)
    ).toMatch(/d-solo/);
    expect(
      validateGrafanaPanelUrl(`${GRAFANA}/login?x=/d-solo/`, allowed, APP)
    ).toMatch(/d-solo/);
    expect(
      validateGrafanaPanelUrl(
        `${GRAFANA}/grafana/d-solo/abc/demo?panelId=1`,
        allowed,
        APP
      )
    ).toBeNull();
  });

  it("never allows framing Keep's own origin, even if it is allowlisted", () => {
    expect(
      validateGrafanaPanelUrl(`${APP}/alerts`, [APP, GRAFANA], APP)
    ).toMatch(/keep itself/i);
  });
});

describe("GRAFANA_PANEL_SANDBOX", () => {
  it("lets the embedded app run without top-navigation", () => {
    const flags = GRAFANA_PANEL_SANDBOX.split(" ");
    expect(flags).toEqual(
      expect.arrayContaining([
        "allow-scripts",
        "allow-same-origin",
        "allow-forms",
      ])
    );
    expect(flags).not.toContain("allow-top-navigation");
    expect(flags).not.toContain("allow-top-navigation-by-user-activation");
  });
});
