import React, { ElementType, useId } from "react";
import type { EmptyGroupPosition } from "./alert-table-widget-config";

/** The places the "no value" group can go, in the order they are offered. */
export const EMPTY_GROUP_POSITIONS: ReadonlyArray<{
  value: EmptyGroupPosition;
  label: string;
}> = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
];

const TITLE = "Rows with no value";

interface EmptyGroupPositionControlProps {
  value: EmptyGroupPosition;
  onChange: (value: EmptyGroupPosition) => void;
  titleAs?: ElementType;
  className?: string;
  titleClassName?: string;
  optionsClassName?: string;
  "data-cy"?: string;
}

/**
 * The "Rows with no value" Top / Bottom setting of a grouped Alert Table
 * widget, used by the widget form and the ⚙ panel.
 *
 * It is a radio group named by its title, of native radios sharing one name.
 * The title renders as `titleAs` (a `p` by default) with `titleClassName`;
 * the root takes `className` and the radios' row `optionsClassName`. A passed
 * `data-cy` goes on the root and, suffixed with `-top` or `-bottom`, on each
 * radio.
 */
export function EmptyGroupPositionControl({
  value,
  onChange,
  titleAs: Title = "p",
  className,
  titleClassName,
  optionsClassName = "flex gap-3",
  "data-cy": dataCy,
}: EmptyGroupPositionControlProps) {
  const name = useId();
  const titleId = useId();

  return (
    <div className={className} data-cy={dataCy}>
      <Title id={titleId} className={titleClassName}>
        {TITLE}
      </Title>
      <div
        role="radiogroup"
        aria-labelledby={titleId}
        className={optionsClassName}
      >
        {EMPTY_GROUP_POSITIONS.map((option) => (
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
    </div>
  );
}
