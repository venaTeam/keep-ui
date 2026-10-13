export const automationKey = (scope: string, path: string) =>
  ["automations", scope, path] as const;
export function isAutomationListKey(key: unknown, scope: string) {
  if (Array.isArray(key)) {
    return (
      key[0] === "automations" &&
      key[1] === scope &&
      typeof key[2] === "string" &&
      (key[2] === "/automations" || key[2].startsWith("/automations?"))
    );
  }
  // SWR stores array keys in serialized form in its cache provider.
  if (typeof key === "string") {
    const prefix = `@"automations",${JSON.stringify(scope)},`;
    return (
      key.startsWith(prefix) &&
      (key.includes(',"/automations",') || key.includes(',"/automations?'))
    );
  }
  return false;
}
