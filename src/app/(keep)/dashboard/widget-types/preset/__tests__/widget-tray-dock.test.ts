import { nextTrayDock } from "../widget-tray-dock";

const zone = { linkZoneLeft: 856, trayLeft: 700 };

describe("nextTrayDock", () => {
  describe("docked left", () => {
    it("stays left while the pointer is on the link icons", () => {
      expect(nextTrayDock("left", 856, zone)).toBe("left");
      expect(nextTrayDock("left", 990, zone)).toBe("left");
    });

    it("moves right when the pointer is left of the tray", () => {
      expect(nextTrayDock("left", 699, zone)).toBe("right");
      expect(nextTrayDock("left", 120, zone)).toBe("right");
    });

    it("stays left while the pointer is on the tray", () => {
      expect(nextTrayDock("left", 700, zone)).toBe("left");
      expect(nextTrayDock("left", 855, zone)).toBe("left");
    });
  });

  describe("docked right", () => {
    it("moves left when the pointer reaches the link icons", () => {
      expect(nextTrayDock("right", 856, zone)).toBe("left");
      expect(nextTrayDock("right", 990, zone)).toBe("left");
    });

    it("stays right anywhere left of the link icons", () => {
      expect(nextTrayDock("right", 855, zone)).toBe("right");
      expect(nextTrayDock("right", 750, zone)).toBe("right");
      expect(nextTrayDock("right", 120, zone)).toBe("right");
    });
  });
});
