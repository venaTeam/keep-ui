import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  EMPTY_GROUP_POSITIONS,
  EmptyGroupPositionControl,
} from "../empty-group-position-control";

describe("EmptyGroupPositionControl", () => {
  it("offers Top then Bottom", () => {
    expect(EMPTY_GROUP_POSITIONS.map((option) => option.value)).toEqual([
      "top",
      "bottom",
    ]);
  });

  it("is a radio group named 'Rows with no value' of native radios sharing one name", () => {
    render(<EmptyGroupPositionControl value="top" onChange={jest.fn()} />);

    const group = screen.getByRole("radiogroup", {
      name: "Rows with no value",
    });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((radio) => radio.tagName)).toEqual(["INPUT", "INPUT"]);
    expect(new Set(radios.map((radio) => radio.getAttribute("name"))).size).toBe(
      1
    );
  });

  it("checks the current position and reports the chosen one", () => {
    const onChange = jest.fn();
    render(<EmptyGroupPositionControl value="top" onChange={onChange} />);

    expect(screen.getByRole("radio", { name: "Top" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Bottom" }));

    expect(onChange).toHaveBeenCalledWith("bottom");
  });

  it("puts a passed data-cy on its root and, suffixed, on each radio", () => {
    const { container } = render(
      <EmptyGroupPositionControl
        value="bottom"
        onChange={jest.fn()}
        data-cy="rows-with-no-value"
      />
    );

    expect(container.firstElementChild).toHaveAttribute(
      "data-cy",
      "rows-with-no-value"
    );
    expect(
      screen.getAllByRole("radio").map((radio) => radio.getAttribute("data-cy"))
    ).toEqual(["rows-with-no-value-top", "rows-with-no-value-bottom"]);
  });

  it("renders its title with the passed element", () => {
    const Title = ({ id, children }: { id: string; children: React.ReactNode }) => (
      <h6 id={id} data-testid="custom-title">
        {children}
      </h6>
    );
    render(
      <EmptyGroupPositionControl value="top" onChange={jest.fn()} titleAs={Title} />
    );

    expect(screen.getByTestId("custom-title")).toHaveTextContent(
      "Rows with no value"
    );
    expect(
      screen.getByRole("radiogroup", { name: "Rows with no value" })
    ).toBeInTheDocument();
  });
});
