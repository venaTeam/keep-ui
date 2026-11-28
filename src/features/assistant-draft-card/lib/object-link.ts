import {
  DraftObject,
  LinkPage,
  OBJECT_TYPES,
  ObjectType,
  parseNavigationPath,
} from "@/entities/assistant";

// The pages each known object type is shown on, and what to call it without a
// name
const PAGES: Record<ObjectType, { pages: readonly LinkPage[]; noun: string }> =
  {
    preset: { pages: ["alerts_preset"], noun: "the preset" },
    correlation_rule: {
      pages: ["rules", "rule"],
      noun: "the correlation rule",
    },
    dashboard: { pages: ["dashboard"], noun: "the dashboard" },
  };

const isKnownType = (type: string): type is ObjectType =>
  (OBJECT_TYPES as readonly string[]).includes(type);

export interface ObjectLink {
  href: string;
  /** The object's name, or what it is when it has none. */
  name: string;
}

/**
 * The "Open <name>" link of an outcome. Only for an object type this build
 * knows, with a path the assistant's links may open (`navigation.ts`) on that
 * type's page: an object of a newer gateway gets the outcome's text and no
 * link, whatever path it carries.
 */
export function getObjectLink(
  object: DraftObject | null | undefined
): ObjectLink | null {
  if (!object || typeof object.type !== "string" || !isKnownType(object.type)) {
    return null;
  }
  const { path, name } = object;
  const { pages, noun } = PAGES[object.type];
  const target = parseNavigationPath(path);
  if (!target || !pages.includes(target.page)) {
    return null;
  }
  return {
    href: path as string,
    name: typeof name === "string" && name ? name : noun,
  };
}
