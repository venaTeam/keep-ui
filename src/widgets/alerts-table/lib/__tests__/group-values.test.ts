import { isEmptyGroupValue } from "@/widgets/alerts-table/lib/group-values";

describe("isEmptyGroupValue", () => {
  it.each([undefined, null, "", "undefined", "null", []])(
    "treats %p as empty",
    (v) => expect(isEmptyGroupValue(v)).toBe(true)
  );
  it.each(["firing", 0, false, ["prometheus"]])("treats %p as a value", (v) =>
    expect(isEmptyGroupValue(v)).toBe(false)
  );
});
