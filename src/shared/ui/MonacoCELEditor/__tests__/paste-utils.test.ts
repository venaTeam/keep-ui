import { normalizeCelPaste } from "../paste-utils";

describe("normalizeCelPaste", () => {
  it.each([
    [
      "source == 'grafana'\nand severity == 'critical'",
      "source == 'grafana' and severity == 'critical'",
    ],
    ["first\r\nsecond", "first second"],
    ["first\rsecond", "first second"],
  ])("normalizes multiline CEL", (value, expected) => {
    expect(normalizeCelPaste(value)).toBe(expected);
  });

  it("leaves single-line CEL unchanged", () => {
    expect(normalizeCelPaste("severity == 'critical'")).toBe(
      "severity == 'critical'"
    );
  });
});
