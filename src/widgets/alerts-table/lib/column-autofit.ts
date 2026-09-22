import {
  AUTOFIT_CELL_BUFFER,
  AUTOFIT_HEADER_BUFFER,
  AUTOFIT_MAX_WIDTH,
} from "./alert-table-column-consts";

interface AutofitBounds {
  minSize?: number;
  maxSize?: number;
}

function escapeAttr(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, "\\$&");
}

function measureContentWidth(source: Element, measurer: HTMLElement): number {
  const clone = source.cloneNode(true) as HTMLElement;
  clone.style.width = "auto";
  clone.style.minWidth = "0";
  clone.style.maxWidth = "none";
  clone.style.whiteSpace = "nowrap";
  clone.style.flex = "none";
  measurer.appendChild(clone);
  const width = clone.getBoundingClientRect().width;
  measurer.removeChild(clone);
  return width;
}

export function getAutofitColumnWidth(
  container: HTMLElement | null,
  columnId: string,
  bounds: AutofitBounds = {}
): number | null {
  if (!container || typeof document === "undefined") {
    return null;
  }

  const selector = escapeAttr(columnId);
  const bodyCells = Array.from(
    container.querySelectorAll<HTMLElement>(`td[data-column-id="${selector}"]`)
  );
  const headerContent = container.querySelector<HTMLElement>(
    `[data-cy="alerts-header-${selector}"] button`
  );

  const measurer = document.createElement("div");
  measurer.style.position = "absolute";
  measurer.style.top = "0";
  measurer.style.left = "-99999px";
  measurer.style.visibility = "hidden";
  measurer.style.whiteSpace = "nowrap";
  measurer.style.pointerEvents = "none";
  document.body.appendChild(measurer);

  let contentWidth = 0;
  let horizontalPadding = 0;

  try {
    if (headerContent) {
      contentWidth = Math.max(
        contentWidth,
        measureContentWidth(headerContent, measurer) + AUTOFIT_HEADER_BUFFER
      );
    }

    for (const cell of bodyCells) {
      const content = cell.firstElementChild ?? cell;
      contentWidth = Math.max(contentWidth, measureContentWidth(content, measurer));

      if (horizontalPadding === 0) {
        const style = window.getComputedStyle(cell);
        horizontalPadding =
          parseFloat(style.paddingLeft || "0") +
          parseFloat(style.paddingRight || "0");
      }
    }
  } finally {
    document.body.removeChild(measurer);
  }

  if (contentWidth === 0) {
    return null;
  }

  const desired = contentWidth + horizontalPadding + AUTOFIT_CELL_BUFFER;
  const min = bounds.minSize ?? 0;
  const max = Math.min(bounds.maxSize ?? AUTOFIT_MAX_WIDTH, AUTOFIT_MAX_WIDTH);

  return Math.round(Math.min(Math.max(desired, min), max));
}
