import { AutomationDetail } from "@/entities/automations";
export function AutomationDefinition({
  automation: row,
}: {
  automation: AutomationDetail;
}) {
  const fields = [
    ["Cooldown seconds", row.cooldown_seconds],
    [
      "Cooldown fields",
      row.cooldown_fields?.length === 0
        ? "Whole automation"
        : row.cooldown_fields?.join(", "),
    ],
    ["Timeout seconds", row.timeout_seconds],
    ["Grace seconds", row.grace_seconds],
    ["Secret name", row.secret_name],
    ["Logstash URL", row.logstash_url],
  ];
  return (
    <section
      className="space-y-4"
      aria-labelledby="automation-definition-title"
    >
      <h2 id="automation-definition-title" className="text-lg font-semibold">
        Definition
      </h2>
      <h3 className="font-medium">Trigger conditions (all must match)</h3>
      {row.triggers?.length ? (
        <ul className="list-disc pl-5">
          {row.triggers.map((trigger, index) => (
            <li key={index}>
              <code>{trigger.field}</code> equals <code>{trigger.value}</code>
            </li>
          ))}
        </ul>
      ) : (
        <p>Unavailable</p>
      )}
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-gray-500">{label}</dt>
            <dd className="break-all">
              {value === undefined
                ? "Unavailable"
                : value === null || value === ""
                  ? "Not set"
                  : value}
            </dd>
          </div>
        ))}
      </dl>
      <h3 className="font-medium">Script</h3>
      {row.script == null ? (
        <p>Unavailable</p>
      ) : (
        <pre
          className="overflow-auto rounded bg-gray-50 p-4 text-sm"
          tabIndex={0}
        >
          <code>{row.script}</code>
        </pre>
      )}
    </section>
  );
}
