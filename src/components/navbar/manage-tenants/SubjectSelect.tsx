import AsyncSelect from "react-select/async";
import { Controller, useFormContext } from "react-hook-form";
import { useKeycloakUsers, useKeycloakGroups } from "./useManageTenants";

interface SubjectSelectProps {
  subjectType: "user" | "group";
  name: string;
  placeholder?: string;
  disabled?: boolean;
}

type Option = { value: string; label: string };

// Only start matching once the user has typed this many characters.
const MIN_CHARS = 2;

/**
 * An async, searchable dropdown of Keycloak users (by email) or groups (by full
 * path), loaded from /auth/users and /auth/groups. Nothing is offered until at
 * least MIN_CHARS are typed; then the (SWR-deduped) list is filtered client-side.
 * The stored value is the identifier the token carries -- email for a user, group
 * path for a group -- so it matches tenant_role_grant.subject (VENA-5596).
 */
export default function SubjectSelect({
  subjectType,
  name,
  placeholder,
  disabled = false,
}: SubjectSelectProps) {
  const { control } = useFormContext();
  const { data: users = [] } = useKeycloakUsers();
  const { data: groups = [] } = useKeycloakGroups();

  const options: Option[] =
    subjectType === "user"
      ? // Store users by their username (= the token's preferred_username), which
        // is what a grant is matched on. DISPLAY the person's name, not the email.
        users.map((u) => ({
          value: u.username || u.email,
          label: u.name || u.username || u.email,
        }))
      : // Store groups by full path (matches the token); display without the "/".
        groups.map((g) => ({ value: g.path ?? `/${g.name}`, label: g.name }));

  // For a selected user, show the name that matches the stored username.
  const displayLabel = (val: string): string => {
    if (subjectType === "group") return val.replace(/^\//, "");
    const u = users.find((usr) => (usr.username || usr.email) === val);
    return u?.name || val;
  };

  const loadOptions = (input: string): Promise<Option[]> => {
    const q = input.trim().toLowerCase();
    if (q.length < MIN_CHARS) return Promise.resolve([]);
    return Promise.resolve(
      options.filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          o.value.toLowerCase().includes(q)
      )
    );
  };

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <AsyncSelect
          className="mt-2 w-40 mr-8"
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
