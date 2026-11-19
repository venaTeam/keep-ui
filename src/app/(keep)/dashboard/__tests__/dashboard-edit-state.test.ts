import { dashboardEditKey, DashboardEditState } from "../dashboard-edit-state";

const state = (): DashboardEditState => ({
  dashboardName: "Ops",
  appearance: { density: "comfortable" } as any,
  layout: [{ i: "w1", x: 0, y: 0, w: 3, h: 3, static: false }],
  widgetData: [
    {
      i: "w1", x: 0, y: 0, w: 3, h: 3, static: false, name: "Feed",
      widgetType: "PRESET",
      preset: { id: "p1", name: "feed" },
    } as any,
  ],
});

describe("dashboardEditKey", () => {
  it("is equal for the same state", () => {
    expect(dashboardEditKey(state())).toBe(dashboardEditKey(state()));
  });

  it("ignores fields the grid and the page add on their own", () => {
    const touched = state();
    touched.layout = [{ ...touched.layout[0], moved: false, isDraggable: true } as any];
    touched.widgetData = [
      {
        ...touched.widgetData[0],
        moved: false,
        minW: 2,
        preset: { ...touched.widgetData[0].preset, alerts_count: 12 },
      } as any,
    ];
    expect(dashboardEditKey(touched)).toBe(dashboardEditKey(state()));
  });

  it("changes when a panel moves", () => {
    const moved = state();
    moved.layout = [{ ...moved.layout[0], x: 6 }];
    expect(dashboardEditKey(moved)).not.toBe(dashboardEditKey(state()));
  });

  it("changes when a panel is added, edited or renamed", () => {
    const added = state();
    added.layout = [...added.layout, { i: "w2", x: 3, y: 0, w: 3, h: 3, static: false }];
    expect(dashboardEditKey(added)).not.toBe(dashboardEditKey(state()));

    const edited = state();
    edited.widgetData = [{ ...edited.widgetData[0], name: "Critical" }];
    expect(dashboardEditKey(edited)).not.toBe(dashboardEditKey(state()));

    const renamed = { ...state(), dashboardName: "Ops 2" };
    expect(dashboardEditKey(renamed)).not.toBe(dashboardEditKey(state()));
  });

  it("changes when the appearance changes", () => {
    const restyled = { ...state(), appearance: { density: "compact" } as any };
    expect(dashboardEditKey(restyled)).not.toBe(dashboardEditKey(state()));
  });
});
