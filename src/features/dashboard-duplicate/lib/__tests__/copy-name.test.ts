import { defaultCopyName, isDashboardNameTaken } from "../copy-name";

describe("defaultCopyName", () => {
  it("suggests '<name> (copy)' when nothing clashes", () => {
    expect(defaultCopyName("Ops", [])).toBe("Ops (copy)");
  });

  it("moves on to '(copy 2)' when '(copy)' is taken", () => {
    expect(defaultCopyName("Ops", ["Ops", "Ops (copy)"])).toBe("Ops (copy 2)");
  });

  it("ignores case when checking earlier copies", () => {
    expect(defaultCopyName("Ops", ["ops (COPY)", "Ops (copy 2)"])).toBe(
      "Ops (copy 3)"
    );
  });

  it("takes the first free number rather than the highest plus one", () => {
    expect(defaultCopyName("Ops", ["Ops (copy)", "Ops (copy 3)"])).toBe(
      "Ops (copy 2)"
    );
  });
});

describe("isDashboardNameTaken", () => {
  it("matches an existing name after trimming and ignoring case", () => {
    expect(isDashboardNameTaken("  ops ", ["Ops"])).toBe(true);
  });

  it("does not treat a different name as taken", () => {
    expect(isDashboardNameTaken("Ops (copy)", ["Ops"])).toBe(false);
  });

  it("never reports a blank name as taken", () => {
    expect(isDashboardNameTaken("   ", ["Ops"])).toBe(false);
    expect(isDashboardNameTaken("", [""])).toBe(false);
  });
});
