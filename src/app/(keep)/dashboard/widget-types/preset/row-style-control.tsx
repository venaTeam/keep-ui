import React, { ElementType, useId } from "react";
import type { RowStyle } from "@/entities/alerts/model/useAlertRowStyle";

/** The row styles a widget can show, in the order they are offered. */
const ROW_STYLES: ReadonlyArray<{
  value: RowStyle;
  label: string;
  hint: string;
}> = [
  {
    value: "default",
    label: "Compact",
    hint: "One line per row. Fits the most alerts.",
  },
  {
    value: "relaxed",
    label: "Relaxed",
    hint: "Long text wraps onto up to 3 lines. Fewer rows fit.",
  },
];

const TITLE = "Rows";

interface RowStyleControlProps {
  value: RowStyle;
  onChange: (value: RowStyle) => void;
  titleAs?: ElementType;
  titleClassName?: string;
  "data-cy"?: string;
}

/**
 * The "Rows" Compact / Relaxed setting of an Alert Table widget, used by the
 * ⚙ panel.
 *
 * It is a radio group named by its title, of native radios sharing one name,
 * with the checked option's hint below it as the group's description. The
 * title renders as `titleAs` (a `p` by default) with `titleClassName`. A
 * passed `data-cy` goes on the root and, suffixed with `-default` or
 * `-relaxed`, on each radio.
 */
export function RowStyleControl({
  value,
  onChange,
  titleAs: Title = "p",
  titleClassName,
  "data-cy": dataCy,
}: RowStyleControlProps) {
  const name = useId();
  const titleId = useId();
  const hintId = useId();
  const hint = ROW_STYLES.find((option) => option.value === value)?.hint;

  return (
    <div data-cy={dataCy}>
      <Title id={titleId} className={titleClassName}>
        {TITLE}
      </Title>
      <div
        role="radiogroup"
        aria-labelledby={titleId}
        aria-describedby={hint ? hintId : undefined}
        className="flex gap-3"
      >
        {ROW_STYLES.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-1.5"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              data-cy={dataCy && `${dataCy}-${option.value}`}
              className="border-gray-300 text-orange-500 accent-orange-500 focus:ring-orange-300"
            />
            {option.label}
          </label>
        ))}
      </div>
      {hint && (
        <p id={hintId} className="mt-1 text-[11px] text-gray-500">
          {hint}
        </p>
      )}
    </div>
  );
}
