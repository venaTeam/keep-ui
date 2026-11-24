import { readFileSync } from "fs";
import { join } from "path";
import {
  QUICK_ACTIONS_TABLE_CLASS,
  QUICK_TRAY_CELL_CLASS,
  QUICK_TRAY_CLASS,
} from "../class-names";

const css = readFileSync(join(__dirname, "../quick-actions.css"), "utf8");

let style: HTMLStyleElement;

beforeEach(() => {
  style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  document.body.innerHTML = `
    <div class="${QUICK_ACTIONS_TABLE_CLASS}">
      <table><tbody><tr>
        <td><a href="#runbook">Runbook</a></td>
        <td class="${QUICK_TRAY_CELL_CLASS}">
          <div class="${QUICK_TRAY_CLASS}"><button type="button">Dismiss</button></div>
        </td>
      </tr></tbody></table>
    </div>`;
});

afterEach(() => {
  style.remove();
  document.body.innerHTML = "";
});

const tray = () => document.querySelector(`.${QUICK_TRAY_CLASS}`)!;
const trayCell = () => document.querySelector(`.${QUICK_TRAY_CELL_CLASS}`)!;

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
    expect(getComputedStyle(tray()).opacity).toBe("0");
    expect(getComputedStyle(tray()).visibility).toBe("hidden");
  });

  it("stays shown for 150ms after its row loses hover or focus, then fades", () => {
    expect(getComputedStyle(tray()).transition).toBe(
      "opacity 0.1s ease-out 0.15s, visibility 0s linear 0.25s"
    );
    expect(getComputedStyle(trayCell()).transition).toBe(
      "z-index 0s linear 0.25s"
    );
  });

  it("shows at once, above the next row's cells, while its row holds keyboard focus", () => {
    (document.querySelector("a") as HTMLElement).focus();

    expect(getComputedStyle(tray()).opacity).toBe("1");
    expect(getComputedStyle(tray()).visibility).toBe("visible");
    expect(getComputedStyle(tray()).transition).toBe("none");
    expect(getComputedStyle(trayCell()).zIndex).toBe("2");
    expect(getComputedStyle(trayCell()).transition).toBe("none");
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
        "opacity 0s linear 0.15s, visibility 0s linear 0.15s",
      [`.${QUICK_ACTIONS_TABLE_CLASS} .${QUICK_TRAY_CELL_CLASS}`]:
        "z-index 0s linear 0.15s",
    });
  });
});
