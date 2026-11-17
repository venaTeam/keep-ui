const normalize = (name: string) => name.trim().toLowerCase();

/**
 * True when the trimmed name matches an existing dashboard name, ignoring case.
 * A blank name is never reported as taken.
 */
export function isDashboardNameTaken(
  name: string,
  existingNames: string[]
): boolean {
  const candidate = normalize(name);
  if (!candidate) {
    return false;
  }
  return existingNames.some((existing) => normalize(existing) === candidate);
}

/**
 * The first free name among `<source> (copy)`, `<source> (copy 2)`, `<source> (copy 3)`, …
 */
export function defaultCopyName(
  sourceName: string,
  existingNames: string[]
): string {
  let candidate = `${sourceName} (copy)`;
  let counter = 2;
  while (isDashboardNameTaken(candidate, existingNames)) {
    candidate = `${sourceName} (copy ${counter})`;
    counter++;
  }
  return candidate;
}
