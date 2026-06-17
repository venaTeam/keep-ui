import React from "react";
import { render, screen } from "@testing-library/react";
import AlertAssignee from "../alert-assignee";

describe("AlertAssignee", () => {
  it("should return null when no assignee is provided", () => {
    const { container } = render(<AlertAssignee assignee={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("should return null when assignee is empty string", () => {
    const { container } = render(<AlertAssignee assignee="" />);
    expect(container.firstChild).toBeNull();
  });

  it("should render the assignee value as plain text", () => {
    render(<AlertAssignee assignee="test.user@example.com" />);

    const el = screen.getByText("test.user@example.com");
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute("title", "test.user@example.com");
  });

  it("should render the identifier as-is (no roster lookup, no avatar)", () => {
    render(<AlertAssignee assignee="jsmith" />);

    expect(screen.getByText("jsmith")).toBeInTheDocument();
    // No avatar image is rendered anymore.
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
