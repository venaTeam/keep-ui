import { getAutofitColumnWidth } from "../column-autofit";

const INSIDE_WIDTH = 200;
const OUTSIDE_WIDTH = 100;

function buildTable(host: HTMLElement): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML =
    '<table><tbody><tr><td data-column-id="name"><span>HighCPUUsage</span></td></tr></tbody></table>';
  host.appendChild(container);
  return container;
}

describe("getAutofitColumnWidth measurer placement", () => {
  let rectSpy: jest.SpyInstance;

  beforeEach(() => {
    rectSpy = jest
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const width = this.closest("[data-widget-typography]")
          ? INSIDE_WIDTH
          : OUTSIDE_WIDTH;
        return { width } as DOMRect;
      });
  });

  afterEach(() => {
    rectSpy.mockRestore();
    document.body.innerHTML = "";
  });

  it("measures on the page body for a table outside a customised widget", () => {
    const container = buildTable(document.body);

    expect(getAutofitColumnWidth(container, "name", { maxSize: 1000 })).toBeLessThan(
      INSIDE_WIDTH
    );
    expect(document.body.children).toHaveLength(1);
  });

  it("measures inside the widget card when the widget has custom typography", () => {
    const card = document.createElement("div");
    card.setAttribute("data-widget-typography", "");
    document.body.appendChild(card);
    const container = buildTable(card);

    expect(
      getAutofitColumnWidth(container, "name", { maxSize: 1000 })
    ).toBeGreaterThanOrEqual(INSIDE_WIDTH);
    expect(card.children).toHaveLength(1);
  });
});
