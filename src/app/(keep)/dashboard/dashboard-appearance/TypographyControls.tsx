import React, { useEffect, useState } from "react";
import { Select, SelectItem } from "@tremor/react";
import { WIDGET_FONTS } from "./fonts/widget-fonts";
import {
  DEFAULT_WIDGET_TYPOGRAPHY,
  TypographyStep,
  WIDGET_FONT_IDS,
  WIDGET_TEXT_SIZES,
  WIDGET_TITLE_SIZES,
  WidgetFontId,
  WidgetTextSize,
  WidgetTitleSize,
  WidgetTypography,
} from "./widget-typography";

const TABLE_TEXT_REM = 0.75;
const TITLE_REM = 1.125;
const FONT_SAMPLE = "Critical · 1,284 alerts · 02:45";

/** The viewer's root font size in px (the app's Small/Medium/Large setting), 14 when it cannot be read. */
function useRootFontPx(): number {
  const [px, setPx] = useState(14);
  useEffect(() => {
    const value = parseFloat(
      getComputedStyle(document.documentElement).fontSize
    );
    if (Number.isFinite(value) && value > 0) {
      setPx(value);
    }
  }, []);
  return px;
}

function formatPx(value: number): string {
  return `${Math.round(value * 10) / 10}px`;
}

function StepGroup<T extends string>({
  label,
  steps,
  active,
  onSelect,
  caption,
  dataCy,
}: {
  label: string;
  steps: TypographyStep<T>[];
  active: T;
  onSelect: (id: T) => void;
  caption: (step: TypographyStep<T>) => string;
  dataCy: string;
}) {
  return (
    <div
      className="grid overflow-hidden rounded-md border border-gray-300"
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      role="group"
      aria-label={label}
    >
      {steps.map((step) => {
        const selected = step.id === active;
        return (
          <button
            key={step.id}
            type="button"
            aria-pressed={selected}
            aria-label={`${label} ${step.label}`}
            onClick={() => onSelect(step.id)}
            data-cy={`${dataCy}-${step.id}`}
            className={`flex flex-col items-center border-l border-gray-300 px-1 py-1 text-sm font-medium first:border-l-0 ${
              selected
                ? "bg-orange-50 text-orange-600"
                : "bg-white text-gray-500"
            }`}
          >
            {step.label}
            <span
              className={`text-[10px] tabular-nums ${
                selected ? "text-orange-600" : "text-gray-400"
              }`}
            >
              {caption(step)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function FontList({
  active,
  onSelect,
  dataCy,
}: {
  active: WidgetFontId;
  onSelect: (id: WidgetFontId) => void;
  dataCy: string;
}) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-md border border-gray-200 bg-white"
      role="group"
      aria-label="Font"
    >
      {WIDGET_FONT_IDS.map((id) => {
        const font = WIDGET_FONTS[id];
        const selected = id === active;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(id)}
            data-cy={`${dataCy}-${id}`}
            className={`grid grid-cols-[1fr_auto] items-center gap-x-2 border-t border-gray-200 px-3 py-1.5 text-left first:border-t-0 ${
              selected
                ? "bg-orange-50 shadow-[inset_3px_0_0_theme(colors.orange.500)]"
                : "bg-white"
            }`}
            style={{ fontFamily: font.stack }}
          >
            <span className="text-sm text-gray-900">{font.label}</span>
            <span className="row-span-2 text-[10px] text-gray-400">
              {font.note ?? ""}
            </span>
            <span className="text-xs text-gray-500">{FONT_SAMPLE}</span>
          </button>
        );
      })}
    </div>
  );
}

function FontSelect({
  active,
  onSelect,
  dataCy,
}: {
  active: WidgetFontId;
  onSelect: (id: WidgetFontId) => void;
  dataCy: string;
}) {
  return (
    <Select
      value={active}
      onValueChange={(value) => onSelect(value as WidgetFontId)}
      enableClear={false}
      data-cy={dataCy}
    >
      {WIDGET_FONT_IDS.map((id) => (
        <SelectItem
          key={id}
          value={id}
          style={{ fontFamily: WIDGET_FONTS[id].stack }}
        >
          {WIDGET_FONTS[id].label}
          {WIDGET_FONTS[id].note ? ` · ${WIDGET_FONTS[id].note}` : ""}
        </SelectItem>
      ))}
    </Select>
  );
}

/**
 * Font, text-size and title-size controls with a preview line. Shared by the
 * Customize panel (font as a list) and the Edit Widget modal (font as a
 * select). `value` may omit fields; missing fields show as the default.
 * `showTextSize` false hides the text-size row (widgets whose body is an
 * iframe or image, where only the title follows typography).
 */
export function TypographyControls({
  value,
  onChange,
  fontPicker,
  idPrefix,
  previewTitle = "Critical firing",
  showTextSize = true,
}: {
  value: WidgetTypography;
  onChange: (next: WidgetTypography) => void;
  fontPicker: "list" | "select";
  idPrefix: string;
  previewTitle?: string;
  showTextSize?: boolean;
}) {
  const rootPx = useRootFontPx();
  const font = value.font ?? DEFAULT_WIDGET_TYPOGRAPHY.font;
  const size = value.size ?? DEFAULT_WIDGET_TYPOGRAPHY.size;
  const title = value.title ?? DEFAULT_WIDGET_TYPOGRAPHY.title;
  const sizeFactor = WIDGET_TEXT_SIZES.find((s) => s.id === size)?.factor ?? 1;
  const titleFactor =
    WIDGET_TITLE_SIZES.find((s) => s.id === title)?.factor ?? 1;
  const labelClass = "mb-1 block text-sm text-gray-500";

  return (
    <div className="flex flex-col gap-3">
      <div>
        <span className={labelClass}>Font</span>
        {fontPicker === "list" ? (
          <FontList
            active={font}
            onSelect={(id) => onChange({ ...value, font: id })}
            dataCy={`${idPrefix}-font`}
          />
        ) : (
          <FontSelect
            active={font}
            onSelect={(id) => onChange({ ...value, font: id })}
            dataCy={`${idPrefix}-font`}
          />
        )}
      </div>
      {showTextSize && (
        <div>
          <span className={labelClass}>Text size</span>
          <StepGroup<WidgetTextSize>
            label="Text size"
            steps={WIDGET_TEXT_SIZES}
            active={size}
            onSelect={(id) => onChange({ ...value, size: id })}
            caption={(step) => formatPx(TABLE_TEXT_REM * rootPx * step.factor)}
            dataCy={`${idPrefix}-size`}
          />
        </div>
      )}
      <div>
        <span className={labelClass}>Title size</span>
        <StepGroup<WidgetTitleSize>
          label="Title size"
          steps={WIDGET_TITLE_SIZES}
          active={title}
          onSelect={(id) => onChange({ ...value, title: id })}
          caption={(step) => formatPx(TITLE_REM * rootPx * step.factor)}
          dataCy={`${idPrefix}-title`}
        />
      </div>
      <div
        className="rounded-md border border-dashed border-gray-300 bg-white px-3 py-2"
        style={{ fontFamily: WIDGET_FONTS[font].stack }}
        data-cy={`${idPrefix}-preview`}
      >
        <div
          className="font-bold text-gray-900"
          style={{ fontSize: `${TITLE_REM * titleFactor}rem`, lineHeight: 1.3 }}
        >
          {previewTitle}
        </div>
        <div
          className="text-gray-500"
          style={{ fontSize: `${TABLE_TEXT_REM * sizeFactor}rem` }}
        >
          High CPU on prod-db-01 · critical · 2m ago
        </div>
      </div>
    </div>
  );
}
