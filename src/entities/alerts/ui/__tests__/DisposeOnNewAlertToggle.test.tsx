import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DEFAULT_DISPOSE_ON_NEW_ALERT } from "@/entities/alerts/model/constants";
import { DisposeOnNewAlertToggle } from "../DisposeOnNewAlertToggle";

describe("DisposeOnNewAlertToggle", () => {
  it("defaults to keeping on new alerts (DEFAULT_DISPOSE_ON_NEW_ALERT is false)", () => {
    expect(DEFAULT_DISPOSE_ON_NEW_ALERT).toBe(false);
  });

  it("renders 'Keeping on new alerts' when value is the default", () => {
    render(
      <DisposeOnNewAlertToggle
        value={DEFAULT_DISPOSE_ON_NEW_ALERT}
        onChange={jest.fn()}
        entityLabel="status"
      />
    );

    expect(
      screen.getByRole("button", { name: "Keeping on new alerts" })
    ).toBeInTheDocument();
  });

  it("renders 'Disposing on new alerts' when value is true", () => {
    render(
      <DisposeOnNewAlertToggle
        value={true}
        onChange={jest.fn()}
        entityLabel="status"
      />
    );

    expect(
      screen.getByRole("button", { name: "Disposing on new alerts" })
    ).toBeInTheDocument();
  });

  it("calls onChange with the negated value when clicked", () => {
    const onChange = jest.fn();

    const { rerender } = render(
      <DisposeOnNewAlertToggle
        value={false}
        onChange={onChange}
        entityLabel="dismissal"
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Keeping on new alerts" })
    );
    expect(onChange).toHaveBeenCalledWith(true);

    onChange.mockClear();

    rerender(
      <DisposeOnNewAlertToggle
        value={true}
        onChange={onChange}
        entityLabel="dismissal"
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Disposing on new alerts" })
    );
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
