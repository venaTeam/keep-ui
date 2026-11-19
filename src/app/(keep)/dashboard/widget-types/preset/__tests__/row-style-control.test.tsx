import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { RowStyleControl } from "../row-style-control";

describe("RowStyleControl", () => {
  it("Compact is checked with its hint, and choosing Relaxed calls onChange('relaxed')", () => {
    const onChange = jest.fn();
    render(<RowStyleControl value="default" onChange={onChange} />);

    const group = screen.getByRole("radiogroup", { name: "Rows" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((radio) => radio.tagName)).toEqual(["INPUT", "INPUT"]);
    expect(new Set(radios.map((radio) => radio.getAttribute("name"))).size).toBe(
      1
    );
    expect(screen.getByRole("radio", { name: "Compact" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Relaxed" })).not.toBeChecked();
    expect(
      screen.getByText("One line per row. Fits the most alerts.")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Long text wraps onto up to 3 lines. Fewer rows fit.")
    ).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Relaxed" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("relaxed");
  });

  it("Relaxed shows the relaxed hint", () => {
    render(<RowStyleControl value="relaxed" onChange={jest.fn()} />);

    expect(screen.getByRole("radio", { name: "Relaxed" })).toBeChecked();
    expect(
      screen.getByText("Long text wraps onto up to 3 lines. Fewer rows fit.")
    ).toHaveClass("text-[11px]", "text-gray-500");
    expect(
      screen.queryByText("One line per row. Fits the most alerts.")
    ).toBeNull();
  });

  it("puts a passed data-cy on its root and, suffixed, on each radio, and renders its title with the passed element", () => {
    const { container } = render(
      <RowStyleControl
        value="default"
        onChange={jest.fn()}
        titleAs="h5"
        titleClassName="section-title"
        data-cy="row-style"
      />
    );

    expect(container.firstElementChild).toHaveAttribute("data-cy", "row-style");
    expect(
      screen.getAllByRole("radio").map((radio) => radio.getAttribute("data-cy"))
    ).toEqual(["row-style-default", "row-style-relaxed"]);
    const title = screen.getByText("Rows");
    expect(title.tagName).toBe("H5");
    expect(title).toHaveClass("section-title");
  });
});
