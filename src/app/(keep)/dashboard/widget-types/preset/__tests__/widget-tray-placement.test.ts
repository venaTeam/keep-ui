import { getTrayPlacement } from "../widget-tray-placement";

const place = (
  rowTop: number,
  rowBottom: number,
  clipTop: number,
  clipBottom: number
) =>
  getTrayPlacement({ rowTop, rowBottom, trayHeight: 28, clipTop, clipBottom });

describe("getTrayPlacement", () => {
  it("hangs below when the tray fits under the row", () => {
    expect(place(40, 72, 0, 100)).toBe("below");
  });

  it("flips above when only the room above the row fits", () => {
    expect(place(60, 92, 30, 100)).toBe("above");
  });

  it("sits inside the row when neither below nor above fits", () => {
    expect(place(10, 42, 0, 60)).toBe("inside");
    expect(place(40, 72, 30, 90)).toBe("inside");
    expect(place(50, 82, 30, 92)).toBe("inside");
  });
});
