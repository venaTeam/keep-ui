import React from "react";
import { Button, Subtitle } from "@tremor/react";
import { FiX } from "react-icons/fi";
import {
  DashboardAppearance,
  DashboardDensity,
  DEFAULT_DENSITY,
  DENSITIES,
  PRESET_THEMES,
} from "./dashboard-appearance-validation";

const DENSITY_LABELS: Record<DashboardDensity, string> = {
  compact: "Compact",
  normal: "Normal",
  spacious: "Spacious",
};

/**
 * Slide-over panel for dashboard-level appearance. Edits are reported through
 * `onChange` so the parent applies them live to the canvas; `onCancel` reverts
 * to the parent's snapshot, `onClose` keeps them, and the toolbar Save persists.
 */
export function DashboardSettingsPanel({
  appearance,
  onChange,
  onReset,
  onCancel,
  onClose,
}: {
  appearance: DashboardAppearance;
  onChange: (next: DashboardAppearance) => void;
  onReset: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const activeDensity = appearance.density ?? DEFAULT_DENSITY;

  const setColor = (value: string) =>
    onChange({ ...appearance, backgroundColor: value });

  const applyPreset = (backgroundColor: string | null) => {
    const next: DashboardAppearance = { ...appearance };
    if (backgroundColor) {
      next.backgroundColor = backgroundColor;
    } else {
      delete next.backgroundColor;
    }
    onChange(next);
  };

  const setDensity = (density: DashboardDensity) =>
    onChange({ ...appearance, density });

  return (
    <div
      className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col gap-5 overflow-y-auto border-l border-gray-200 bg-white p-5 shadow-xl"
      data-cy="dashboard-settings-panel"
    >
      <div className="flex items-center justify-between">
        <Subtitle color="orange">Customize dashboard</Subtitle>
        <button
          type="button"
          aria-label="Close customization panel"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
          data-cy="dashboard-settings-close"
        >
          <FiX size={18} />
        </button>
      </div>
      <p className="-mt-3 text-sm text-gray-500">
        Applies to this dashboard only.
      </p>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Background color
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            aria-label="Dashboard background color"
            value={appearance.backgroundColor ?? "#f9fafb"}
            onChange={(event) => setColor(event.target.value)}
            className="w-10 h-10 p-1 border"
            data-cy="dashboard-settings-bg-color"
          />
          <span className="text-sm text-gray-500">
            {appearance.backgroundColor ?? "Default (unset)"}
          </span>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Preset themes
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESET_THEMES.map((preset) => {
            const selected =
              (appearance.backgroundColor ?? null) === preset.backgroundColor;
            return (
              <button
                key={preset.name}
                type="button"
                aria-label={preset.name}
                aria-pressed={selected}
                title={preset.name}
                onClick={() => applyPreset(preset.backgroundColor)}
                data-cy={`dashboard-settings-preset-${preset.name.toLowerCase()}`}
                className={`relative h-8 w-8 rounded-md border ${
                  selected
                    ? "ring-2 ring-orange-500 ring-offset-1"
                    : "border-gray-300"
                } ${preset.backgroundColor ? "" : "bg-white"}`}
                style={
                  preset.backgroundColor
                    ? { backgroundColor: preset.backgroundColor }
                    : undefined
                }
              >
                {preset.backgroundColor === null && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-gray-400">
                    /
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Grid density
        </label>
        <div
          className="inline-flex overflow-hidden rounded-md border border-gray-300"
          role="group"
          aria-label="Grid density"
        >
          {DENSITIES.map((density) => {
            const selected = activeDensity === density;
            return (
              <button
                key={density}
                type="button"
                aria-label={DENSITY_LABELS[density]}
                aria-pressed={selected}
                onClick={() => setDensity(density)}
                data-cy={`dashboard-settings-density-${density}`}
                className={`border-l border-gray-300 px-3 py-1.5 text-sm font-medium first:border-l-0 ${
                  selected
                    ? "bg-orange-50 text-orange-600"
                    : "bg-white text-gray-500"
                }`}
              >
                {DENSITY_LABELS[density]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-auto flex items-center gap-2 pt-4">
        <button
          type="button"
          onClick={onReset}
          className="text-sm font-medium text-gray-500 underline underline-offset-2 hover:text-gray-700"
          data-cy="dashboard-settings-reset"
        >
          Reset to default
        </button>
        <span className="flex-1" />
        <Button
          variant="secondary"
          color="orange"
          size="xs"
          onClick={onCancel}
          data-cy="dashboard-settings-cancel"
        >
          Cancel
        </Button>
        <Button
          color="orange"
          size="xs"
          onClick={onClose}
          data-cy="dashboard-settings-done"
        >
          Done
        </Button>
      </div>
    </div>
  );
}
