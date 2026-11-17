/**
 * How alert rows are painted. "default" keeps the table's backgrounds,
 * pointer cursor and hover colour; "plain" rows are transparent and do not
 * look clickable, so the surrounding background shows through.
 */
export type RowAppearance = "default" | "plain";

/**
 * Adapts a row or cell class list to the given appearance.
 *
 * For "plain" it removes every background utility, including its `hover:`,
 * `group-hover:` and `!` forms, and `cursor-pointer`. Any other appearance
 * returns the class list unchanged.
 */
export function applyRowAppearance(
  className: string,
  appearance: RowAppearance
): string {
  if (appearance !== "plain") {
    return className;
  }
  return className
    .split(/\s+/)
    .filter((token) => {
      const utility = token.slice(token.lastIndexOf(":") + 1).replace(/^!/, "");
      return (
        token !== "" &&
        utility !== "cursor-pointer" &&
        !utility.startsWith("bg-")
      );
    })
    .join(" ");
}
