import { readFileSync } from "fs";
import { join } from "path";
import {
  QUICK_ACTIONS_TABLE_CLASS,
  QUICK_ACTIVE_ATTR,
  QUICK_LEAVING_ATTR,
  QUICK_TRAY_CELL_CLASS,
  QUICK_TRAY_CLASS,
} from "../class-names";

const css = readFileSync(join(__dirname, "../quick-actions.css"), "utf8");
const STICKY_CELLS_ABOVE_ROWS = ".opaque-cells td.sticky { z-index: 40 !important; }";

const TINT = "rgb(248, 250, 252)";
const OUTLINE = "#d1d5db";

let style: HTMLStyleElement;

const row = (id: string) => `
  <tr id="${id}">
    <td><input type="checkbox" /></td>
    <td><a href="#${id}">Runbook</a></td>
    <td class="${QUICK_TRAY_CELL_CLASS} sticky">
      <div class="${QUICK_TRAY_CLASS}"><button type="button">Dismiss</button></div>
    </td>
  </tr>`;

beforeEach(() => {
  style = document.createElement("style");
  style.textContent = `${STICKY_CELLS_ABOVE_ROWS}\n${css}`;
  document.head.appendChild(style);
  document.body.innerHTML = `
    <div class="opaque-cells ${QUICK_ACTIONS_TABLE_CLASS}">
      <table><tbody>${row("first")}${row("second")}</tbody></table>
    </div>`;
});

afterEach(() => {
  style.remove();
  document.body.innerHTML = "";
});

const cellsOf = (id: string) =>
  Array.from(document.querySelectorAll<HTMLElement>(`#${id} > td`));
const trayOf = (id: string) =>
  document.querySelector<HTMLElement>(`#${id} .${QUICK_TRAY_CLASS}`)!;
const trayCellOf = (id: string) =>
  document.querySelector<HTMLElement>(`#${id} .${QUICK_TRAY_CELL_CLASS}`)!;
const activate = (id: string) =>
  document.getElementById(id)!.setAttribute(QUICK_ACTIVE_ATTR, "");
const markLeaving = (id: string) =>
  document.getElementById(id)!.setAttribute(QUICK_LEAVING_ATTR, "");
const computed = (element: Element) => getComputedStyle(element);

const ruleFor = (selector: string) =>
  (Array.from(style.sheet!.cssRules) as CSSStyleRule[]).find((rule) =>
    rule.selectorText?.split(",").some((part) => part.trim() === selector)
  )!;

const reducedMotionRules = () =>
  Array.from(style.sheet!.cssRules)
    .filter(
      (rule): rule is CSSMediaRule =>
        rule instanceof CSSMediaRule &&
        rule.conditionText.includes("prefers-reduced-motion: reduce")
    )
    .flatMap((rule) => Array.from(rule.cssRules) as CSSStyleRule[]);

describe("quick-actions.css tray", () => {
  it("is hidden, unclickable and parked inside its row unless the row is active", () => {
    ["below", "above", "inside"].forEach((placement) => {
      trayOf("first").dataset.placement = placement;
      const tray = computed(trayOf("first"));
      expect([tray.opacity, tray.visibility]).toEqual(["0", "hidden"]);
      expect([tray.top, tray.transform]).toEqual(["50%", "translateY(-50%)"]);
      expect(tray.transition).toBe("");
    });
  });

  it("shows on the active row only, with no hover or focus rule of its own", () => {
    activate("first");

    expect(computed(trayOf("first")).opacity).toBe("1");
    expect(computed(trayOf("first")).visibility).toBe("visible");
    expect(computed(trayOf("second")).visibility).toBe("hidden");
    const trayRules = (Array.from(style.sheet!.cssRules) as CSSStyleRule[])
      .map((rule) => rule.selectorText ?? "")
      .filter((selector) => selector.includes(QUICK_TRAY_CLASS));
    trayRules.forEach((selector) =>
      expect(selector).not.toMatch(/:hover|:focus-visible/)
    );
  });

  it("fades the tray and the tint of a row the pointer left, then parks the tray", () => {
    markLeaving("first");

    expect(computed(trayOf("first")).transition).toBe(
      "opacity 0.1s ease-out, visibility 0s linear 0.1s, top 0s linear 0.1s, transform 0s linear 0.1s"
    );
    cellsOf("first")
      .slice(0, 2)
      .forEach((cell) =>
        expect(computed(cell).transition).toBe(
          "background-color 0.1s ease-out, box-shadow 0.1s ease-out"
        )
      );
    expect(computed(trayOf("second")).transition).toBe("");
  });

  it("raises the active or fading row's tray cell over the sticky cells' !important z-index 40", () => {
    expect(computed(trayCellOf("first")).zIndex).toBe("40");

    activate("first");
    markLeaving("second");

    expect(computed(trayCellOf("first")).zIndex).toBe("41");
    expect(computed(trayCellOf("second")).zIndex).toBe("41");
    expect(
      ruleFor(
        `.${QUICK_ACTIONS_TABLE_CLASS} tr[${QUICK_ACTIVE_ATTR}] > td.${QUICK_TRAY_CELL_CLASS}`
      ).style.getPropertyPriority("z-index")
    ).toBe("important");
  });

  it("tints and outlines the active row, and no other", () => {
    activate("first");

    const [checkbox, link] = cellsOf("first");
    expect(computed(checkbox).backgroundColor).toBe(TINT);
    expect(computed(link).backgroundColor).toBe(TINT);
    expect(computed(checkbox).boxShadow).toBe(
      `inset 1px 0 0 ${OUTLINE}, inset 0 1px 0 ${OUTLINE}, inset 0 -1px 0 ${OUTLINE}`
    );
    expect(computed(link).boxShadow).toBe(
      `inset -1px 0 0 ${OUTLINE}, inset 0 1px 0 ${OUTLINE}, inset 0 -1px 0 ${OUTLINE}`
    );
    cellsOf("second").forEach((cell) => {
      expect(computed(cell).backgroundColor).toBe("");
      expect(computed(cell).boxShadow).toBe("");
    });
  });

  it.each([
    ["has its dialog open", (cell: HTMLElement) => cell.insertAdjacentHTML("beforeend", '<span data-quick-open hidden></span>')],
    ["is ticked", (cell: HTMLElement) => {
      const box = cell.querySelector("input")!;
      box.classList.add("quick-pick");
      (box as HTMLInputElement).checked = true;
    }],
  ])("keeps the orange highlight over the tint on an active row that %s", (_state, mark) => {
    activate("first");
    mark(cellsOf("first")[0]);

    cellsOf("first")
      .slice(0, 2)
      .forEach((cell) =>
        expect(computed(cell).backgroundColor).toBe("rgb(255, 247, 237)")
      );
    const highlightRule = ruleFor(
      `.${QUICK_ACTIONS_TABLE_CLASS} tr[${QUICK_ACTIVE_ATTR}]:has([data-quick-open]) > td`
    );
    expect(highlightRule.style.background).toBe("#fff7ed");
  });

  it("hangs the active row's tray below it as a tab: the row's tint, outlined except on top, rounded at the bottom, over the row's bottom line", () => {
    activate("first");
    const tray = computed(trayOf("first"));

    expect(tray.top).toBe("calc(100% - 1px)");
    expect(tray.transform).toBe("translateY(0)");
    expect(tray.backgroundColor).toBe(TINT);
    expect(tray.boxShadow).toBe("");
    expect([
      tray.borderTopWidth,
      tray.borderRightWidth,
      tray.borderBottomWidth,
      tray.borderLeftWidth,
    ]).toEqual(["0", "1px", "1px", "1px"]);
    expect(tray.borderColor).toBe(OUTLINE);
    expect(tray.borderRadius).toBe("0 0 0.375rem 0.375rem");
  });

  it("sets the active row's tray above it as a tab: outlined except on its bottom, rounded at the top", () => {
    trayOf("first").dataset.placement = "above";
    activate("first");
    const tray = computed(trayOf("first"));

    expect(tray.top).toBe("1px");
    expect(tray.transform).toBe("translateY(-100%)");
    expect([tray.borderTopWidth, tray.borderBottomWidth]).toEqual([
      "1px",
      "0",
    ]);
    expect(tray.borderRadius).toBe("0.375rem 0.375rem 0 0");
  });

  it("centres the active row's tray inside it with a plain rounded outline", () => {
    trayOf("first").dataset.placement = "inside";
    activate("first");
    const tray = computed(trayOf("first"));

    expect(tray.top).toBe("50%");
    expect(tray.transform).toBe("translateY(-50%)");
    expect([
      tray.borderTopWidth,
      tray.borderRightWidth,
      tray.borderBottomWidth,
      tray.borderLeftWidth,
    ]).toEqual(["1px", "1px", "1px", "1px"]);
    expect(tray.borderRadius).toBe("0.375rem");
  });

  it("drops the fade under reduced motion", () => {
    const transitions = Object.fromEntries(
      reducedMotionRules().map((rule) => [
        rule.selectorText.replace(/\s+/g, " "),
        rule.style.transition,
      ])
    );

    expect(transitions).toEqual({
      [`.${QUICK_ACTIONS_TABLE_CLASS} tr[${QUICK_LEAVING_ATTR}] .${QUICK_TRAY_CLASS}, .${QUICK_ACTIONS_TABLE_CLASS} tr[${QUICK_LEAVING_ATTR}] > td`]:
        "none",
    });
  });
});
