import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CustomPresetAlertLinks } from "../CustomPresetAlertLinks";

const mockPush = jest.fn();
const mockDeletePreset = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => window.location.pathname,
}));

jest.mock("@/entities/presets/model/usePresets", () => ({
  usePresets: () => ({
    dynamicPresets: [
      { id: "p1", name: "Critical", tags: [], should_do_noise_now: false },
    ],
    setLocalDynamicPresets: jest.fn(),
  }),
}));

jest.mock("@/entities/presets/model/usePresetActions", () => ({
  usePresetActions: () => ({ deletePreset: mockDeletePreset }),
}));

jest.mock("@/components/LinkWithIcon", () => ({
  LinkWithIcon: ({ onDelete }: { onDelete?: () => void }) => (
    <button onClick={onDelete}>delete preset</button>
  ),
}));

jest.mock("../PresetsNoise", () => ({ PresetsNoise: () => null }));
jest.mock("../CustomPresetAlertLink.css", () => ({}));

const deleteAt = async (path: string, deleted: boolean) => {
  window.history.replaceState(null, "", path);
  mockDeletePreset.mockResolvedValue(deleted);
  render(<CustomPresetAlertLinks selectedTags={[]} />);
  fireEvent.click(screen.getByText("delete preset"));
  await waitFor(() => expect(mockDeletePreset).toHaveBeenCalled());
  await Promise.resolve();
};

beforeEach(() => {
  mockPush.mockReset();
  mockDeletePreset.mockReset();
});

describe("CustomPresetAlertLinks delete", () => {
  it("goes to the feed when the open preset is deleted", async () => {
    await deleteAt("/alerts/critical", true);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/alerts/feed"));
  });

  it("stays on another page, e.g. a dashboard being edited", async () => {
    await deleteAt("/dashboard/Ops", true);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("stays when the delete is cancelled", async () => {
    await deleteAt("/alerts/critical", false);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
