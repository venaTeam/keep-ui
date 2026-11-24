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

/** The header of a column in `container`, or null when it isn't rendered. */
function getHeader(container: HTMLElement, columnId: string) {
  return container.querySelector<HTMLElement>(
    `[data-cy="alerts-header-${columnId}"]`
  );
}

/** The label of a column header: the text span of its sort button. */
function getHeaderLabel(header: HTMLElement | null) {
  return header?.querySelector<HTMLElement>("button > span") ?? null;
}

/**
 * Width, in pixels, of a header's in-flow controls besides its label button,
 * such as the edit-mode column menu; absolutely positioned ones (the drag and
 * resize handles) take no room.
 */
function getHeaderChromeWidth(header: HTMLElement, labelButton: Element): number {
  return Array.from(header.children).reduce((width, child) => {
    if (child === labelButton) {
      return width;
    }
    const { position } = window.getComputedStyle(child);
    if (position === "absolute" || position === "fixed") {
      return width;
    }
    return width + child.getBoundingClientRect().width;
  }, 0);
}

/**
 * Width, in whole pixels, a column needs to show its header untruncated at
 * the current text size, with whatever header controls the current mode
 * shows: the label's full text width, the padding of its button, the other
 * in-flow header controls (`getHeaderChromeWidth`) and the padding of the
 * header and its cell, rounded up, plus 1px because `scrollWidth` rounds a
 * sub-pixel text width to the nearest pixel. Null when the header isn't
 * rendered.
 */
function measureHeaderFitWidth(
  container: HTMLElement,
  columnId: string
): number | null {
  const header = getHeader(container, columnId);
  const label = getHeaderLabel(header);
  const labelButton = label?.parentElement;
  const cell = header?.closest("th");
  if (!header || !label || !labelButton || !cell) {
    return null;
  }
  return (
    Math.ceil(
      label.scrollWidth +
        horizontalPadding(labelButton) +
        getHeaderChromeWidth(header, labelButton) +
        horizontalPadding(header) +
        horizontalPadding(cell)
    ) + 1
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
 * the visible link columns or `headersInteractive` (the edit-mode header
 * controls) change, and whenever a link
 * header label resizes, as it does when the text scale or root font size
 * changes. A saved width still wins, since the layout only falls back to
 * `size` without one.
 */
export function useFittedLinkColumns<T extends SizedColumn>(
  columns: T[],
  visibleColumnIds: readonly string[],
  tableRef: RefObject<HTMLElement | null>,
  headersInteractive: boolean
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
      .map((id) => getHeaderLabel(getHeader(table, id)))
      .filter((label): label is HTMLElement => label !== null);
    if (typeof ResizeObserver === "undefined" || labels.length === 0) {
      return;
    }
    const observer = new ResizeObserver(measure);
    labels.forEach((label) => observer.observe(label));
    return () => observer.disconnect();
  }, [tableRef, linkIdsKey, headersInteractive]);

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
