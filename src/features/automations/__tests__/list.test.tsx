import { fireEvent, render, screen } from "@testing-library/react";
import { AutomationsList } from "../list/ui/AutomationsList";
import { AutomationFilters } from "../list/ui/AutomationFilters";
const retry = jest.fn();
let state: {
  data?: unknown[];
  error?: Error;
  isLoading?: boolean;
  isValidating?: boolean;
};
let params = new URLSearchParams();
const replace = jest.fn();
jest.mock("next/navigation", () => ({
  useSearchParams: () => params,
  useRouter: () => ({ replace }),
}));
jest.mock("@/entities/automations/model/hooks", () => ({
  useAutomations: () => ({ ...state, mutate: retry }),
  useAutomationNamespaces: () => ({
    data: ["payments", "platform", "unused-wallet"],
  }),
  automationError: () => "Could not load automations",
}));
beforeEach(() => {
  state = {};
  params = new URLSearchParams();
  retry.mockClear();
});
test("loading, empty list and empty filtered result are distinct", () => {
  state = { isLoading: true };
  const { rerender } = render(<AutomationsList />);
  expect(screen.getByText("Loading automations…")).toBeVisible();
  state = { data: [] };
  rerender(<AutomationsList />);
  expect(screen.getByText("No automations yet.")).toBeVisible();
  params = new URLSearchParams("namespace=payments");
  rerender(<AutomationsList />);
  expect(screen.getByText("No automations match these filters.")).toBeVisible();
});
test("request error exposes retry", () => {
  state = { error: new Error("failure") };
  render(<AutomationsList />);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Could not load automations"
  );
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(retry).toHaveBeenCalledTimes(1);
});
test("each filter uses exact wire enum and stale wallets remain selectable", () => {
  const onChange = jest.fn();
  render(
    <AutomationFilters
      filters={{ namespace: ["offboarded"] }}
      onChange={onChange}
    />
  );
  expect(screen.getByRole("checkbox", { name: "offboarded" })).toBeChecked();
  expect(
    screen.getByRole("checkbox", { name: "unused-wallet" })
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: "deleted" }));
  expect(onChange).toHaveBeenLastCalledWith({
    namespace: ["offboarded"],
    matching_state: ["deleted"],
  });
  fireEvent.click(screen.getByRole("checkbox", { name: "build_failed" }));
  expect(onChange).toHaveBeenLastCalledWith({
    namespace: ["offboarded"],
    build_state: ["build_failed"],
  });
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(onChange).toHaveBeenLastCalledWith({});
});
