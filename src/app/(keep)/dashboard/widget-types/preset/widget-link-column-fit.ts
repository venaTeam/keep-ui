import { RefObject, useLayoutEffect, useMemo, useState } from "react";
import { isLinkIconColumn } from "@/widgets/alerts-table/lib/alert-link-columns";
import type { SizedColumn } from "./widget-column-layout";

type HeaderFits = Record<string, number>;

/** Sum, in pixels, of an element's computed left and right padding. */
function horizontalPadding(element: Element): number {
  const style = window.getComputedStyle(element);
  return (
    (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
  );
}

/** The header label of a column in `container`, or null when it isn't rendered. */
function getHeaderLabel(container: HTMLElement, columnId: string) {
  return container.querySelector<HTMLElement>(
    `[data-cy="alerts-header-${columnId}"] button > span`
  );
}

/**
 * Width, in whole pixels, a column needs to show its header label untruncated
 * at the current text size: the label's full text width plus the horizontal
 * padding of its button and header cell. Null when the header isn't rendered.
 */
function measureHeaderFitWidth(
  container: HTMLElement,
  columnId: string
): number | null {
  const label = getHeaderLabel(container, columnId);
  const cell = label?.closest("th");
  if (!label || !cell || !label.parentElement) {
    return null;
  }
  return Math.ceil(
    label.scrollWidth +
      horizontalPadding(label.parentElement) +
      horizontalPadding(cell)
  );
}

/** Whether two header fits hold the same widths. */
function isSameFits(first: HeaderFits, second: HeaderFits): boolean {
  const keys = Object.keys(first);
  return (
    keys.length === Object.keys(second).length &&
    keys.every((key) => first[key] === second[key])
  );
}

/**
 * Returns `columns` with each visible link icon column (Rule, Runbook) opening
 * wide enough for its header at the current text size: its default size, or
 * the header's measured fit (`measureHeaderFitWidth`) when that is wider, its
 * maximum lifted to match. Headers are measured before paint, again whenever
 * the visible link columns change, and whenever a link header label resizes,
 * as it does when the text scale or root font size changes. A saved width
 * still wins, since the layout only falls back to `size` without one.
 */
export function useFittedLinkColumns<T extends SizedColumn>(
  columns: T[],
  visibleColumnIds: readonly string[],
  tableRef: RefObject<HTMLElement | null>
): T[] {
  const [fits, setFits] = useState<HeaderFits>({});
  const linkIdsKey = visibleColumnIds.filter(isLinkIconColumn).join(",");

  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table || linkIdsKey === "") {
      return;
    }
    const linkIds = linkIdsKey.split(",");
    const measure = () => {
      const next: HeaderFits = {};
      linkIds.forEach((id) => {
        const fit = measureHeaderFitWidth(table, id);
        if (fit !== null) {
          next[id] = fit;
        }
      });
      setFits((current) => (isSameFits(current, next) ? current : next));
    };
    measure();
    const labels = linkIds
      .map((id) => getHeaderLabel(table, id))
      .filter((label): label is HTMLElement => label !== null);
    if (typeof ResizeObserver === "undefined" || labels.length === 0) {
      return;
    }
    const observer = new ResizeObserver(measure);
    labels.forEach((label) => observer.observe(label));
    return () => observer.disconnect();
  }, [tableRef, linkIdsKey]);

  return useMemo(
    () =>
      columns.map((column) => {
        const fit = column.id === undefined ? undefined : fits[column.id];
        if (fit === undefined || fit <= (column.size ?? 0)) {
          return column;
        }
        return {
          ...column,
          size: fit,
          maxSize: Math.max(column.maxSize ?? fit, fit),
        };
      }),
    [columns, fits]
  );
}
