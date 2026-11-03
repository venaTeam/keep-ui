import { useFacetPotentialFields } from "@/features/filter/hooks";
import { MultiSelect, MultiSelectItem } from "@tremor/react";
import React, { useEffect, useMemo, useState } from "react";
import { defaultColumns } from "./constants";

interface ColumnsSelectionProps {
  selectedColumns?: string[];
  onChange: (selected: string[]) => void;
}

const ColumnsSelection: React.FC<ColumnsSelectionProps> = ({
  selectedColumns,
  onChange,
}) => {
  const [savedColumns] = useState<string[]>(
    () => selectedColumns || defaultColumns
  );
  const [selectedColumnsState, setSelectedColumnsState] = useState<Set<string>>(
    new Set(savedColumns)
  );
  const { data } = useFacetPotentialFields("alerts");

  useEffect(
    () => onChange(Array.from(selectedColumnsState)),
    [selectedColumnsState]
  );

  const sortedOptions = useMemo(() => {
    const options = Array.from(new Set([...(data ?? []), ...savedColumns]));

    return options.sort((first, second) => {
      const inSetA = selectedColumnsState.has(first);
      const inSetB = selectedColumnsState.has(second);

      if (inSetA && !inSetB) return -1;
      if (!inSetA && inSetB) return 1;

      return first.localeCompare(second);
    });
  }, [data, savedColumns, selectedColumnsState]);

  return (
    <MultiSelect
      placeholder="Select alert columns"
      value={Array.from(selectedColumnsState)}
      onValueChange={(selected) => setSelectedColumnsState(new Set(selected))}
      data-cy="dashboard-widget-form-columns-multiselect"
    >
      {sortedOptions?.map((field) => (
        <MultiSelectItem key={field} value={field}>
          {field}
        </MultiSelectItem>
      ))}
    </MultiSelect>
  );
};

export default ColumnsSelection;
