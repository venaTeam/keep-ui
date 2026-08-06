import AsyncSelect from "react-select/async";
import { Controller, useFormContext } from "react-hook-form";
import { useApi } from "@/shared/lib/hooks/useApi";
import { SEARCH_MIN_CHARS as MIN_CHARS } from "./useManageTenants";

type Option = { value: string; label: string };

/**
 * Async picker for an operator's group. Searches Keycloak SERVER-SIDE via
 * /operators/available-groups?search= (returns only groups WITHOUT an operator).
 * Loading all groups times out on large directories (thousands of groups), so
 * nothing loads until MIN_CHARS are typed. Stored value = full group path
 * (what POST /operators expects); displayed without the leading "/".
 */
export default function AvailableGroupSelect({
  name,
  placeholder,
  disabled = false,
}: {
  name: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const { control } = useFormContext();
  const api = useApi();

  const loadOptions = async (input: string): Promise<Option[]> => {
    const q = input.trim();
    if (q.length < MIN_CHARS || !api.isReady()) return [];
    const groups = await api.get<string[]>(
      `/operators/available-groups?search=${encodeURIComponent(q)}`
    );
    return (groups ?? []).map((g) => ({ value: g, label: g.replace(/^\//, "") }));
  };

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <AsyncSelect
          className="mt-2"
          placeholder={placeholder}
          isDisabled={disabled}
          isClearable
          loadOptions={loadOptions}
          noOptionsMessage={({ inputValue }) =>
            inputValue.trim().length < MIN_CHARS
              ? `Type at least ${MIN_CHARS} letters`
              : "No matches"
          }
          value={
            field.value
              ? { value: field.value, label: field.value.replace(/^\//, "") }
              : null
          }
          onChange={(opt: any) => field.onChange(opt?.value ?? "")}
          onBlur={field.onBlur}
          menuPortalTarget={
            typeof document !== "undefined" ? document.body : undefined
          }
          menuPosition="fixed"
          styles={{ menuPortal: (base: any) => ({ ...base, zIndex: 9999 }) }}
        />
      )}
    />
  );
}
