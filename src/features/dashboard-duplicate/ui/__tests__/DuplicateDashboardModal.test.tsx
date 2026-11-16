import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { toast } from "react-toastify";
import { KeepApiError } from "@/shared/api";
import { showErrorToast } from "@/shared/ui";
import { useNavigationGuardStore } from "@/shared/lib/navigation-guard";
import { DuplicateDashboardModal } from "../DuplicateDashboardModal";

const mockPost = jest.fn();
const mockMutate = jest.fn();
const mockPush = jest.fn();
let mockPathname = "/alerts/feed";

jest.mock("@/shared/lib/hooks/useApi", () => ({
  useApi: () => ({ post: mockPost }),
}));

jest.mock("@/utils/hooks/useDashboards", () => ({
  useDashboards: () => ({ dashboards: [], mutate: mockMutate }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

jest.mock("react-toastify", () => ({ toast: { success: jest.fn() } }));

jest.mock("@/utils/metrics", () => ({
  recordAction: jest.fn(),
  recordError: jest.fn(),
}));

jest.mock("@/shared/ui", () => ({ showErrorToast: jest.fn() }));

const source = {
  id: "d1",
  dashboard_name: "NOC Overview",
  dashboard_config: {},
};
const existingNames = ["NOC Overview", "Ops"];

const INFO_TEXT =
  "Widgets, layout, appearance and uploaded images are copied. The original dashboard isn't changed.";
const NAME_TAKEN = "A dashboard with this name already exists";
const SOURCE_GONE = "This dashboard no longer exists";

const byCy = (cy: string) =>
  document.querySelector(`[data-cy="${cy}"]`) as HTMLElement | null;
const nameInput = () =>
  byCy("dashboard-duplicate-name-input") as HTMLInputElement;
const submitButton = () =>
  byCy("dashboard-duplicate-submit-btn") as HTMLButtonElement;
const typeName = (value: string) =>
  fireEvent.change(nameInput(), { target: { value } });
const pressEnter = () => fireEvent.submit(nameInput().closest("form")!);

const waitForOpenDialog = () =>
  waitFor(() => expect(nameInput()).toHaveFocus());

async function renderModal() {
  const onClose = jest.fn();
  const view = render(
    <DuplicateDashboardModal
      source={source}
      existingNames={existingNames}
      onClose={onClose}
    />
  );
  await waitForOpenDialog();
  return { ...view, onClose };
}

const created = (dashboard_name: string) => ({
  id: "d2",
  dashboard_name,
  dashboard_config: {},
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = "/alerts/feed";
  useNavigationGuardStore.setState({ blockers: [] });
});

describe("DuplicateDashboardModal", () => {
  it("prefills the copy name and explains what is copied", async () => {
    await renderModal();

    expect(byCy("dashboard-duplicate-modal")).toHaveTextContent(
      "Duplicate dashboard"
    );
    expect(byCy("dashboard-duplicate-modal")).toHaveTextContent(
      "Make a copy of NOC Overview."
    );
    expect(screen.getByLabelText("Name")).toBe(nameInput());
    expect(nameInput()).toHaveValue("NOC Overview (copy)");
    expect(screen.getByText(INFO_TEXT)).toBeInTheDocument();
    expect(submitButton()).toBeEnabled();
    expect(byCy("dashboard-duplicate-name-error")).toBeNull();
    expect(byCy("dashboard-duplicate-unsaved-note")).toBeNull();
  });

  it("disables submit and shows the clash message for an existing name in another case", async () => {
    await renderModal();

    typeName("ops");

    expect(submitButton()).toBeDisabled();
    expect(byCy("dashboard-duplicate-name-error")).toHaveTextContent(
      NAME_TAKEN
    );
  });

  it("disables submit for a blank name", async () => {
    await renderModal();

    typeName("   ");

    expect(submitButton()).toBeDisabled();
    expect(byCy("dashboard-duplicate-name-error")).toBeNull();
  });

  it("submits with Enter, posts the trimmed name and navigates to the copy", async () => {
    mockPost.mockResolvedValue(created("NOC Overview (copy)"));
    const { onClose } = await renderModal();

    typeName("  NOC Overview (copy)  ");
    pressEnter();

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        "/dashboard/NOC%20Overview%20(copy)"
      )
    );
    expect(mockPost).toHaveBeenCalledWith("/dashboard/d1/duplicate", {
      dashboard_name: "NOC Overview (copy)",
    });
    expect(onClose).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Dashboard duplicated");
  });

  it("encodes URL-special characters when navigating", async () => {
    mockPost.mockResolvedValue(created("a/b%#"));
    await renderModal();

    typeName("a/b%#");
    pressEnter();

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/dashboard/a%2Fb%25%23")
    );
  });

  it("lets the unsaved-changes guard hold the navigation to the copy", async () => {
    mockPost.mockResolvedValue(created("NOC Overview (copy)"));
    const blocker = jest.fn();
    useNavigationGuardStore.getState().addBlocker(blocker);
    await renderModal();

    pressEnter();

    await waitFor(() => expect(blocker).toHaveBeenCalled());
    expect(mockPush).not.toHaveBeenCalled();
    blocker.mock.calls[0][0]();
    expect(mockPush).toHaveBeenCalledWith("/dashboard/NOC%20Overview%20(copy)");
  });

  it("does not post twice while the request is pending", async () => {
    mockPost.mockReturnValue(new Promise(() => {}));
    await renderModal();

    fireEvent.click(submitButton());
    fireEvent.click(submitButton());

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(submitButton()).toBeDisabled();
  });

  it("keeps the dialog open with the clash message on 409", async () => {
    mockPost.mockRejectedValue(new KeepApiError("x", "u", "", {}, 409));
    const { onClose } = await renderModal();

    pressEnter();

    await waitFor(() =>
      expect(byCy("dashboard-duplicate-name-error")).toHaveTextContent(
        NAME_TAKEN
      )
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it("shows the source-gone message on 404 and refreshes the list", async () => {
    mockPost.mockRejectedValue(new KeepApiError("x", "u", "", {}, 404));
    const { onClose } = await renderModal();

    pressEnter();

    await waitFor(() =>
      expect(byCy("dashboard-duplicate-name-error")).toHaveTextContent(
        SOURCE_GONE
      )
    );
    expect(mockMutate).toHaveBeenCalledWith();
    expect(mockPush).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it("toasts other errors", async () => {
    const error = new KeepApiError("x", "u", "", {}, 500);
    mockPost.mockRejectedValue(error);
    const { onClose } = await renderModal();

    pressEnter();

    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith(
        error,
        "Failed to duplicate dashboard"
      )
    );
    await waitFor(() => expect(submitButton()).toBeEnabled());
    expect(byCy("dashboard-duplicate-name-error")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("resets the name and the error when another dashboard is opened", async () => {
    mockPost.mockRejectedValue(new KeepApiError("x", "u", "", {}, 409));
    const { rerender, onClose } = await renderModal();
    typeName("Taken elsewhere");
    pressEnter();
    await waitFor(() =>
      expect(byCy("dashboard-duplicate-name-error")).toHaveTextContent(
        NAME_TAKEN
      )
    );

    const ops = { id: "d3", dashboard_name: "Ops", dashboard_config: {} };
    rerender(
      <DuplicateDashboardModal
        source={null}
        existingNames={existingNames}
        onClose={onClose}
      />
    );
    rerender(
      <DuplicateDashboardModal
        source={ops}
        existingNames={existingNames}
        onClose={onClose}
      />
    );
    await waitForOpenDialog();

    expect(nameInput()).toHaveValue("Ops (copy)");
    expect(byCy("dashboard-duplicate-name-error")).toBeNull();
  });

  it("shows the unsaved note only for the open dashboard with unsaved edits", async () => {
    mockPathname = "/dashboard/NOC%20Overview";
    const { rerender, onClose } = await renderModal();
    expect(byCy("dashboard-duplicate-unsaved-note")).toBeNull();

    let removeBlocker = () => {};
    act(() => {
      removeBlocker = useNavigationGuardStore.getState().addBlocker(jest.fn());
    });
    expect(byCy("dashboard-duplicate-unsaved-note")).toHaveTextContent(
      "Unsaved changes aren't included in the copy."
    );

    act(() => removeBlocker());
    expect(byCy("dashboard-duplicate-unsaved-note")).toBeNull();

    act(() => {
      useNavigationGuardStore.getState().addBlocker(jest.fn());
    });
    expect(byCy("dashboard-duplicate-unsaved-note")).toBeInTheDocument();

    mockPathname = "/dashboard/Ops";
    rerender(
      <DuplicateDashboardModal
        source={source}
        existingNames={existingNames}
        onClose={onClose}
      />
    );
    expect(byCy("dashboard-duplicate-unsaved-note")).toBeNull();
  });

  it("Cancel closes without posting", async () => {
    const { onClose } = await renderModal();

    fireEvent.click(byCy("dashboard-duplicate-cancel-btn")!);

    expect(onClose).toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("renders nothing while there is no source", () => {
    render(
      <DuplicateDashboardModal
        source={null}
        existingNames={existingNames}
        onClose={jest.fn()}
      />
    );

    expect(byCy("dashboard-duplicate-modal")).toBeNull();
  });
});
