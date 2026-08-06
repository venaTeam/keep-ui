import AsyncSelect from "react-select/async";
import { Controller, useFormContext } from "react-hook-form";
import { useApi } from "@/shared/lib/hooks/useApi";
import {
  KeycloakUser,
  KeycloakGroup,
  SEARCH_MIN_CHARS as MIN_CHARS,
} from "./useManageTenants";

interface SubjectSelectProps {
  subjectType: "user" | "group";
  name: string;
  placeholder?: string;
  disabled?: boolean;
}

type Option = { value: string; label: string };

/**
 * An async, searchable dropdown of Keycloak users (by username) or groups (by
 * full path). Searches SERVER-SIDE: once MIN_CHARS are typed it queries
 * /auth/users?search= or /auth/groups?search=, which returns only the matches.
 * (Fetching the whole directory times out on large LDAP setups.) The stored
 * value is the identifier the token carries -- username for a user, group path
 * for a group -- so it matches tenant_role_grant.subject (VENA-5596).
 */
export default function SubjectSelect({
  subjectType,
  name,
  placeholder,
  disabled = false,
}: SubjectSelectProps) {
  const { control } = useFormContext();
  const api = useApi();

  const loadOptions = async (input: string): Promise<Option[]> => {
    const q = input.trim();
    if (q.length < MIN_CHARS || !api.isReady()) return [];
    const query = `?search=${encodeURIComponent(q)}`;
    if (subjectType === "user") {
      const users = await api.get<KeycloakUser[]>(`/auth/users${query}`);
      return (users ?? []).map((u) => ({
        value: u.username || u.email,
        label: u.name || u.username || u.email, // show the name, not the email
      }));
    }
    const groups = await api.get<KeycloakGroup[]>(`/auth/groups${query}`);
    return (groups ?? []).map((g) => ({
      value: g.path ?? `/${g.name}`, // stored with the "/" (matches the token)
      label: g.name, // displayed without it
    }));
  };

  // Selected-value display: groups without the "/", users as the stored username.
  const displayLabel = (val: string): string =>
    subjectType === "group" ? val.replace(/^\//, "") : val;

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
          cacheOptions
          loadOptions={loadOptions}
          noOptionsMessage={({ inputValue }) =>
            inputValue.trim().length < MIN_CHARS
              ? `Type at least ${MIN_CHARS} letters`
              : "No matches"
          }
          value={
            field.value
              ? { value: field.value, label: displayLabel(field.value) }
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
