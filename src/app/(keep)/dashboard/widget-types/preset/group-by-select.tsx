import React, { useId, useMemo, useState } from "react";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { RiArrowDownSLine } from "react-icons/ri";
import {
  GROUP_BY_SHORTLIST,
  GROUP_BY_SHORTLIST_LABELS,
  matchesSearch,
} from "@/widgets/alerts-table/lib/alert-column-options";

interface GroupBySelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  fieldOptions: string[];
  isGroupable?: (field: string) => boolean;
  "data-testid"?: string;
  "data-cy"?: string;
}

const NONE = "";
const NONE_LABEL = "None";
const TITLE = "Group rows by";
const OTHER_FIELDS_LABEL = "Any other field…";
const DEFAULT_DATA_CY = "dashboard-widget-form-group-rows-by";

const OPTION_CLASS =
  "flex justify-start items-center cursor-default text-tremor-default p-2.5 text-tremor-content-emphasis data-[focus]:bg-tremor-background-muted data-[focus]:text-tremor-content-strong data-[selected]:bg-tremor-background-muted data-[selected]:text-tremor-content-strong";

const getOptionLabel = (option: string) =>
  option === NONE
    ? NONE_LABEL
    : (GROUP_BY_SHORTLIST_LABELS.get(option) ?? option);

const anyField = () => true;

const isTextInput = (event: React.KeyboardEvent) =>
  event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

const Option = ({ value, label }: { value: string; label: string }) => (
  <ComboboxOption value={value} className={OPTION_CLASS}>
    <span className="whitespace-nowrap truncate">{label}</span>
  </ComboboxOption>
);

/**
 * Picks the field a widget's rows are grouped by. It lists None, the shared
 * shortlist, a divider, then every other field under "Any other field…"; typing
 * filters all of them. While the list is open the box shows only the search
 * text, and typing or pasting into the closed box replaces the shown label,
 * so a search never starts with the current label. `onChange` receives null
 * for None. Only fields `isGroupable` accepts (every field by default) are
 * listed, shortlist included. A saved field that is no longer among
 * `fieldOptions`, or no longer groupable, stays listed so it remains visible.
 * The root's `data-cy` is the passed `data-cy`, else the passed `data-testid`
 * (also set as `data-testid`), else `dashboard-widget-form-group-rows-by`.
 */
export function GroupBySelect({
  value,
  onChange,
  fieldOptions,
  isGroupable = anyField,
  "data-testid": dataTestId,
  "data-cy": dataCy,
}: GroupBySelectProps) {
  const [query, setQuery] = useState("");
  const otherFieldsLabelId = useId();

  const otherFields = useMemo(() => {
    const fields = new Set(fieldOptions.filter(isGroupable));
    if (value) {
      fields.add(value);
    }
    return Array.from(fields)
      .filter(
        (field) => field !== NONE && !GROUP_BY_SHORTLIST_LABELS.has(field)
      )
      .sort((first, second) => first.localeCompare(second));
  }, [fieldOptions, isGroupable, value]);

  const search = query.trim();
  const showNone = matchesSearch(NONE_LABEL, search);
  const shortlist = GROUP_BY_SHORTLIST.filter(
    (option) =>
      (isGroupable(option.value) || option.value === value) &&
      (matchesSearch(option.label, search) || matchesSearch(option.value, search))
  );
  const others = otherFields.filter((field) => matchesSearch(field, search));
  const hasTopOptions = showNone || shortlist.length > 0;

  const handleChange = (next: string | null) => {
    if (next === null) {
      return;
    }
    onChange(next === NONE ? null : next);
  };

  return (
    <div
      className="w-full min-w-[10rem] text-tremor-default"
      data-cy={dataCy ?? dataTestId ?? DEFAULT_DATA_CY}
      data-testid={dataTestId}
    >
      <Combobox
        value={value ?? NONE}
        onChange={handleChange}
        onClose={() => setQuery("")}
        immediate
      >
        {({ open }) => (
          <>
            <div className="relative">
              <ComboboxInput
                aria-label={TITLE}
                placeholder={TITLE}
                autoComplete="off"
                displayValue={(option: string) =>
                  open ? query : getOptionLabel(option)
                }
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (!open && isTextInput(event)) {
                    event.currentTarget.value = "";
                  }
                }}
                onPaste={(event) => {
                  if (!open) {
                    event.currentTarget.value = "";
                  }
                }}
                className="w-full truncate rounded-tremor-default border border-tremor-border bg-tremor-background py-2 pl-3 pr-10 text-left text-tremor-default text-tremor-content-emphasis shadow-tremor-input outline-none transition duration-100 placeholder:text-tremor-content hover:bg-tremor-background-muted focus:border-tremor-brand-subtle focus:ring-2 focus:ring-tremor-brand-muted"
              />
              <ComboboxButton
                aria-label={`Show ${TITLE} options`}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5"
              >
                <RiArrowDownSLine className="h-5 w-5 flex-none text-tremor-content-subtle" />
              </ComboboxButton>
            </div>
            <ComboboxOptions
              anchor="bottom start"
              className="z-[60] w-[var(--input-width)] max-h-[228px] divide-y divide-tremor-border overflow-y-auto rounded-tremor-default border border-tremor-border bg-tremor-background text-tremor-default shadow-tremor-dropdown outline-none [--anchor-gap:4px]"
            >
              {showNone && <Option value={NONE} label={NONE_LABEL} />}
              {shortlist.map((option) => (
                <Option
                  key={option.value}
                  value={option.value}
                  label={option.label}
                />
              ))}
              {hasTopOptions && others.length > 0 && (
                <div
                  role="presentation"
                  aria-hidden="true"
                  className="h-1 bg-tremor-background-muted"
                  data-cy="group-by-select-divider"
                />
              )}
              {others.length > 0 && (
                <div
                  role="group"
                  aria-labelledby={otherFieldsLabelId}
                  className="divide-y divide-tremor-border"
                >
                  <div
                    id={otherFieldsLabelId}
                    className="px-2.5 py-1.5 text-xs font-medium text-tremor-content-subtle"
                  >
                    {OTHER_FIELDS_LABEL}
                  </div>
                  {others.map((field) => (
                    <Option key={field} value={field} label={field} />
                  ))}
                </div>
              )}
              {!hasTopOptions && others.length === 0 && (
                <div className="p-2.5 text-tremor-content-subtle">
                  No matching fields
                </div>
              )}
            </ComboboxOptions>
          </>
        )}
      </Combobox>
    </div>
  );
}
