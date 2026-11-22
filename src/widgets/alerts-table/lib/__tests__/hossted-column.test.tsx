import React from "react";
import { render } from "@testing-library/react";
import { HosstedButton } from "@hossted/keep-integration";
import { AlertDto } from "@/entities/alerts/model";
import { buildHosstedColumns } from "../hossted-column";

jest.mock("@hossted/keep-integration", () => ({
  HosstedButton: jest.fn(() => null),
}));

describe("buildHosstedColumns", () => {
  it("returns no column when disabled", () => {
    expect(buildHosstedColumns(false)).toEqual([]);
  });

  it("returns the hossted column when enabled", () => {
    const cols = buildHosstedColumns(true);
    expect(cols).toHaveLength(1);
    expect(cols[0].id).toBe("hossted");
    expect(cols[0].header).toBe("Hossted");
  });

  it("renders HosstedButton with the alert and the side panel disabled", () => {
    const alert = { fingerprint: "fp-1", name: "a" } as unknown as AlertDto;
    const cell = buildHosstedColumns(true)[0].cell as (
      ctx: unknown
    ) => React.ReactNode;

    render(<>{cell({ row: { original: alert } })}</>);

    expect((HosstedButton as jest.Mock).mock.calls[0][0]).toEqual({
      request: { fingerprint: "fp-1", payload: alert },
      disableHosstedSidePanel: true,
    });
  });
});
