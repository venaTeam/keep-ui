import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useConfig } from "@/utils/hooks/useConfig";
import { AutomationDetail } from "@/entities/automations/model/types";
import {
  AutomationActions,
  ENABLE_TOOLTIP,
} from "../detail/ui/AutomationActions";
import { AutomationsTable } from "../list/ui/AutomationsTable";
import { AutomationDefinition } from "../detail/ui/AutomationDefinition";
import { DELETE_WARNING } from "../lifecycle/ui/AutomationConfirmation";
const run = jest.fn();
let pending = false;
jest.mock("@/entities/automations/model/hooks", () => ({
  useAutomationActions: () => ({ run, pending }),
}));
const automation: AutomationDetail = {
  id: "a1",
  name: "Restart payments",
  namespace: "payments",
  matching_state: "inactive",
  build_state: "idle",
  active_digest: "sha256:abcdef1234567890",
  contract_version: "v1",
  triggers: [{ field: "severity", value: "critical" }],
  script: "def handle(alert): pass",
  secret_name: null,
  cooldown_seconds: null,
  cooldown_fields: null,
  timeout_seconds: 300,
  grace_seconds: 300,
  logstash_url: null,
  delete_cascade_step: null,
  index_generation: 1,
  created_at: "2026-10-12T12:00:00Z",
  updated_at: "2026-10-12T12:00:00Z",
  created_by: "alice",
  updated_by: "alice",
};
beforeEach(() => {
  run.mockReset().mockResolvedValue(true);
  pending = false;
  jest.mocked(useConfig).mockReturnValue({ data: { READ_ONLY: false } as any });
});
test.each([null, "", "   "])(
  "Enable with digest %p is disabled and its explanation is keyboard accessible",
  async (digest) => {
    render(
      <AutomationActions
        automation={{ ...automation, active_digest: digest }}
      />
    );
    expect(screen.getByRole("button", { name: "Enable" })).toBeDisabled();
    const help = screen.getByLabelText(ENABLE_TOOLTIP);
    expect(help).toHaveAttribute("tabindex", "0");
    fireEvent.focus(help);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      ENABLE_TOOLTIP
    );
    expect(run).not.toHaveBeenCalled();
  }
);
test("active automation without a digest can still be disabled during a build", async () => {
  render(
    <AutomationActions
      automation={{
        ...automation,
        matching_state: "active",
        active_digest: null,
        build_state: "building",
      }}
    />
  );
  expect(screen.getByRole("button", { name: "Disable" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Edit" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Disable" }));
  expect(
    await screen.findByText(/Existing executions can finish/)
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Disable automation" }));
  await waitFor(() => expect(run).toHaveBeenCalledWith("disable"));
});
test("delete warns about immediate termination, cancellation does not mutate", async () => {
  render(<AutomationActions automation={automation} />);
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(await screen.findByText(DELETE_WARNING)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(run).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Delete automation" })
  );
  await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
});
test.each(["deleting", "deleted"] as const)(
  "%s disables all actions",
  (state) => {
    render(
      <AutomationActions
        automation={{ ...automation, matching_state: state }}
      />
    );
    for (const button of screen.getAllByRole("button"))
      expect(button).toBeDisabled();
  }
);
test("read-only and pending mutations prevent changes", () => {
  pending = true;
  const { rerender } = render(<AutomationActions automation={automation} />);
  expect(screen.getByRole("button", { name: "Enable" })).toBeDisabled();
  pending = false;
  jest.mocked(useConfig).mockReturnValue({ data: { READ_ONLY: true } as any });
  rerender(<AutomationActions automation={automation} />);
  expect(screen.getByRole("button", { name: "Enable" })).toBeDisabled();
});
test("Edit hands off to the sibling editor route", () => {
  render(<AutomationActions automation={automation} />);
  expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
    "href",
    "/automations/a1/edit"
  );
});
test("cards render both axes and last run without digest, and preserve filters", () => {
  render(
    <AutomationsTable
      query="namespace=payments"
      rows={[
        {
          ...automation,
          matching_state: "active",
          build_state: "build_failed",
          last_run: { created_at: "2026-10-12T12:00:00Z" },
        },
        { ...automation, id: "a2", last_run: null },
        { ...automation, id: "a3" },
      ]}
    />
  );
  expect(screen.getByText("active")).toBeVisible();
  expect(screen.getByText("build_failed")).toBeVisible();
  expect(screen.queryByText("abcdef123456")).not.toBeInTheDocument();
  expect(screen.getByText("Never run")).toBeVisible();
  expect(screen.getByText("Unavailable")).toBeVisible();
  expect(document.querySelector("time")).toHaveAttribute(
    "datetime",
    "2026-10-12T12:00:00Z"
  );
  expect(screen.getAllByRole("link")[0]).toHaveAttribute(
    "href",
    "/automations/a1?namespace=payments"
  );
});
test("definition displays nullable fields explicitly and script as text", () => {
  render(<AutomationDefinition automation={automation} />);
  expect(screen.getByText("def handle(alert): pass")).toBeVisible();
  expect(screen.getAllByText("Not set").length).toBeGreaterThan(0);
  expect(screen.getByText("severity")).toBeVisible();
});
