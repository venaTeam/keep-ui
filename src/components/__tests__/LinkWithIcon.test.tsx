import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { FiLayout } from "react-icons/fi";
import { LinkWithIcon } from "../LinkWithIcon";

jest.mock("next/navigation", () => ({
  usePathname: () => "/alerts/feed",
}));

type LinkWithIconTestProps = Omit<
  React.ComponentProps<typeof LinkWithIcon>,
  "href" | "icon" | "children"
>;

const renderLink = (props: LinkWithIconTestProps = {}) =>
  render(
    <LinkWithIcon href="/dashboard/Ops" icon={FiLayout} {...props}>
      Ops
    </LinkWithIcon>
  );

describe("LinkWithIcon duplicate action", () => {
  it("renders a labelled duplicate button when onDuplicate is given", () => {
    renderLink({
      onDuplicate: jest.fn(),
      duplicateAriaLabel: "Duplicate Ops",
      duplicateDataCy: "nav-link-dashboard-duplicate-d1",
    });
    expect(
      screen.getByRole("button", { name: "Duplicate Ops" })
    ).toHaveAttribute("data-cy", "nav-link-dashboard-duplicate-d1");
  });

  it("calls onDuplicate once without following the link", () => {
    const onDuplicate = jest.fn();
    const parentClick = jest.fn();
    render(
      <div onClick={parentClick}>
        <LinkWithIcon
          href="/dashboard/Ops"
          icon={FiLayout}
          onDuplicate={onDuplicate}
          duplicateAriaLabel="Duplicate Ops"
        >
          Ops
        </LinkWithIcon>
      </div>
    );
    const notCancelled = fireEvent.click(
      screen.getByRole("button", { name: "Duplicate Ops" })
    );
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(notCancelled).toBe(false);
    expect(parentClick).not.toHaveBeenCalled();
  });

  it("renders no duplicate button without onDuplicate", () => {
    renderLink({ isDeletable: true, onDelete: jest.fn() });
    expect(screen.queryByRole("button", { name: /duplicate/i })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("keeps the original trash icon classes without onDuplicate", () => {
    renderLink({ isDeletable: true, onDelete: jest.fn() });
    const trashIcon = screen.getByRole("button").querySelector("svg");
    expect(trashIcon).toHaveAttribute(
      "class",
      "tremor-Icon-icon shrink-0 text-slate-400 hover:text-red-500 group-hover:block hidden h-4 w-4"
    );
  });

  it("reveals the copy icon on hover and keyboard focus only", () => {
    renderLink({ onDuplicate: jest.fn(), duplicateAriaLabel: "Duplicate Ops" });
    const copyIcon = screen
      .getByRole("button", { name: "Duplicate Ops" })
      .querySelector("svg");
    expect(copyIcon).toHaveClass(
      "hidden",
      "group-hover:block",
      "group-has-[:focus-visible]:block"
    );
    expect(copyIcon).not.toHaveClass("group-focus-within:block");
  });

  it("places duplicate before delete and keeps delete working", () => {
    const onDelete = jest.fn();
    const onDuplicate = jest.fn();
    renderLink({
      isDeletable: true,
      onDelete,
      onDuplicate,
      duplicateAriaLabel: "Duplicate Ops",
    });
    const [duplicateButton, deleteButton] = screen.getAllByRole("button");
    expect(duplicateButton).toHaveAccessibleName("Duplicate Ops");
    fireEvent.click(deleteButton);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDuplicate).not.toHaveBeenCalled();
  });
});
