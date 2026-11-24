import { Select, SelectItem } from "@tremor/react";
import { Controller, useFormContext } from "react-hook-form";
import { CorrelationFormType } from "./types";
import {
  isSelectableResolveOn,
  RESOLVE_ON_LABELS,
  SELECTABLE_RESOLVE_ON,
} from "./resolve-on";

/**
 * The "Resolve on" strategy of a correlation rule.
 *
 * Only the selectable strategies are offered. A rule saved with a retired one
 * keeps that value in the form, which makes the field invalid (so Save stays
 * disabled) and shows a notice until the user picks a supported option.
 */
export const ResolveOnField = () => {
  const { control } = useFormContext<CorrelationFormType>();

  return (
    <div className="mr-10">
      <label
        className="flex items-center text-tremor-default font-medium text-tremor-content-strong"
        htmlFor="resolveOn"
      >
        Resolve on{" "}
      </label>

      <Controller
        control={control}
        name="resolveOn"
        rules={{ validate: isSelectableResolveOn }}
        render={({ field: { value, onChange } }) => (
          <>
            <Select
              value={isSelectableResolveOn(value) ? value : ""}
              onValueChange={onChange}
              placeholder="Choose an option"
              className="mt-2"
              data-cy="rules-form-resolve-on-select"
            >
              {SELECTABLE_RESOLVE_ON.map((option) => (
                <SelectItem key={option} value={option}>
                  {RESOLVE_ON_LABELS[option]}
                </SelectItem>
              ))}
            </Select>
            {!isSelectableResolveOn(value) && (
              // A plain <p>, not Tremor's <Text>: Text forwards only color,
              // className and children, so a data-cy or role placed on it
              // never reaches the DOM. These are Text's classes with color="amber".
              <p
                role="status"
                className="mt-2 text-tremor-default text-amber-500 dark:text-amber-500"
                data-cy="rules-form-resolve-on-legacy-notice"
              >
                {`This rule resolves on "${RESOLVE_ON_LABELS[value] ?? value}", which is no longer supported. Choose a new option to save changes.`}
              </p>
            )}
          </>
        )}
      />
    </div>
  );
};
