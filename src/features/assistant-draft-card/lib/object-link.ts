import { DraftObject, OBJECT_TYPES, ObjectType } from "@/entities/assistant";

// The page each known object type is on, and what to call it without a name
const PAGES: Record<ObjectType, { base: string; noun: string }> = {
  preset: { base: "/alerts", noun: "the preset" },
  correlation_rule: { base: "/rules", noun: "the correlation rule" },
  dashboard: { base: "/dashboard", noun: "the dashboard" },
};

// A path of this site: no scheme, no host, no whitespace or control characters
const SITE_PATH = /^\/(?![/\\])[^\s\\\u0000-\u001f\u007f-\u009f]*$/;

const isKnownType = (type: string): type is ObjectType =>
  (OBJECT_TYPES as readonly string[]).includes(type);

const isUnder = (path: string, base: string) =>
  path === base || ["/", "?", "#"].some((next) => path.startsWith(base + next));

export interface ObjectLink {
  href: string;
  /** The object's name, or what it is when it has none. */
  name: string;
}

/**
 * The "Open <name>" link of an outcome. Only for an object type this build
 * knows, with a path on that type's page: an object of a newer gateway gets
 * the outcome's text and no link, whatever path it carries.
 */
export function getObjectLink(
  object: DraftObject | null | undefined
): ObjectLink | null {
  if (!object || typeof object.type !== "string" || !isKnownType(object.type)) {
    return null;
  }
  const { path, name } = object;
  const { base, noun } = PAGES[object.type];
  if (
    typeof path !== "string" ||
    !SITE_PATH.test(path) ||
    !isUnder(path, base)
  ) {
    return null;
  }
  return { href: path, name: typeof name === "string" && name ? name : noun };
}
