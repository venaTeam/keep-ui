import { readFileSync } from "fs";
import { join } from "path";
import {
  QUICK_ACTIONS_TABLE_CLASS,
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
const focusLinkIn = (id: string) =>
  document.querySelector<HTMLElement>(`#${id} a`)!.focus();
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
  it("is hidden and unclickable outside a hovered or focused row", () => {
    expect(computed(trayOf("first")).opacity).toBe("0");
    expect(computed(trayOf("first")).visibility).toBe("hidden");
  });

  it("stays shown, with its row's tint, for 150ms after the row loses hover or focus, then fades", () => {
    expect(computed(trayOf("first")).transition).toBe(
      "opacity 0.1s ease-out 0.15s, visibility 0s linear 0.25s, top 0s linear 0.25s, transform 0s linear 0.25s"
    );
    expect(computed(trayCellOf("first")).transition).toBe(
      "z-index 0s linear 0.25s"
    );
    cellsOf("first")
      .slice(0, 2)
      .forEach((cell) =>
        expect(computed(cell).transition).toBe(
          "background-color 0.1s ease-out 0.15s, box-shadow 0.1s ease-out 0.15s"
        )
      );
  });

  it("shows at once while its row holds keyboard focus", () => {
    focusLinkIn("first");

    expect(computed(trayOf("first")).opacity).toBe("1");
    expect(computed(trayOf("first")).visibility).toBe("visible");
    expect(computed(trayOf("first")).transition).toBe("none");
    expect(computed(trayOf("second")).visibility).toBe("hidden");
  });

  it("raises the shown tray's cell over the sticky cells' !important z-index 40, leaving other rows alone", () => {
    expect(computed(trayCellOf("first")).zIndex).toBe("40");

    focusLinkIn("first");

    expect(computed(trayCellOf("first")).zIndex).toBe("41");
    expect(computed(trayCellOf("first")).transition).toBe("none");
    expect(computed(trayCellOf("second")).zIndex).toBe("40");
    expect(
      ruleFor(
        `.${QUICK_ACTIONS_TABLE_CLASS} tr:hover > td.${QUICK_TRAY_CELL_CLASS}`
      ).style.getPropertyPriority("z-index")
    ).toBe("important");
  });

  it("tints and outlines the row whose tray shows, and no other", () => {
    focusLinkIn("first");

    const [checkbox, link] = cellsOf("first");
    expect(computed(checkbox).backgroundColor).toBe(TINT);
    expect(computed(link).backgroundColor).toBe(TINT);
    expect(computed(checkbox).boxShadow).toBe(
      `inset 1px 0 0 ${OUTLINE}, inset 0 1px 0 ${OUTLINE}, inset 0 -1px 0 ${OUTLINE}`
    );
    expect(computed(link).boxShadow).toBe(
      `inset -1px 0 0 ${OUTLINE}, inset 0 1px 0 ${OUTLINE}, inset 0 -1px 0 ${OUTLINE}`
    );
    expect(computed(link).transition).toBe("none");
    cellsOf("second").forEach((cell) => {
      expect(computed(cell).backgroundColor).toBe("");
      expect(computed(cell).boxShadow).toBe("");
    });
  });

  it("parks a hidden tray inside its row, so it adds no scrollable overflow", () => {
    ["below", "above", "inside"].forEach((placement) => {
      trayOf("first").dataset.placement = placement;
      expect(computed(trayOf("first")).top).toBe("50%");
      expect(computed(trayOf("first")).transform).toBe("translateY(-50%)");
    });
  });

  it("hangs a shown tray below its row as a tab: the row's tint, outlined except on top, rounded at the bottom, over the row's bottom line", () => {
    focusLinkIn("first");
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

  it("sets a shown tray above its row as a tab: outlined except on its bottom, rounded at the top", () => {
    trayOf("first").dataset.placement = "above";
    focusLinkIn("first");
    const tray = computed(trayOf("first"));

    expect(tray.top).toBe("1px");
    expect(tray.transform).toBe("translateY(-100%)");
    expect([tray.borderTopWidth, tray.borderBottomWidth]).toEqual([
      "1px",
      "0",
    ]);
    expect(tray.borderRadius).toBe("0.375rem 0.375rem 0 0");
  });

  it("centres a shown tray inside its row with a plain rounded outline", () => {
    trayOf("first").dataset.placement = "inside";
    focusLinkIn("first");
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

  it("keeps the 150ms delay without the fade under reduced motion", () => {
    const transitions = Object.fromEntries(
      reducedMotionRules().map((rule) => [
        rule.selectorText,
        rule.style.transition,
      ])
    );

    expect(transitions).toEqual({
      [`.${QUICK_ACTIONS_TABLE_CLASS} .${QUICK_TRAY_CLASS}`]:
        "opacity 0s linear 0.15s, visibility 0s linear 0.15s, top 0s linear 0.15s, transform 0s linear 0.15s",
      [`.${QUICK_ACTIONS_TABLE_CLASS} tr:has(.${QUICK_TRAY_CLASS}) > td`]:
        "background-color 0s linear 0.15s, box-shadow 0s linear 0.15s",
      [`.${QUICK_ACTIONS_TABLE_CLASS} tr:has(.${QUICK_TRAY_CLASS}) > td.${QUICK_TRAY_CELL_CLASS}`]:
        "z-index 0s linear 0.15s",
    });
  });
});
