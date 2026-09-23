import { useEffect, useRef, useState } from "react";
import styles from "../Search.module.css";
import FormField from "./FormField";
import { TextInput } from "@/components/ui/TextInput";
import Select from "react-select";
import SubjectSelect from "./SubjectSelect";
import { asyncSelectStyles } from "./useManageTenants";

interface RoleMappingProps {
  subjectType: "group" | "user";
  // Existing grants for this subject type (empty on create; the tenant's current
  // grants on update). Shape: { name, role }.
  initialValues?: Record<string, string>[];
  // Called when an existing grant is removed, so the parent can DELETE it.
  onRemove?: (removed: Record<string, string>) => void;
  // Called when an existing grant's role is changed in place, so the parent can
  // POST the update (previously only newly-added rows were submitted).
  onEdit?: (name: string, role: string) => void;
}

export default function RoleMapping({
  subjectType,
  initialValues = [],
  onRemove,
  onEdit,
}: RoleMappingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const newMappingRef = useRef<HTMLDivElement>(null);
  const [addNewMapping, setAddNewMapping] = useState(false);
  const [newCount, setNewCount] = useState(0);

  const [existingValues, setExistingValues] = useState<Record<string, string>[]>(
    initialValues
  );
  const [toRemove, setToRemove] = useState<Record<string, string>[]>([]);

  // Existing grants arrive asynchronously (fetched on update) -- sync them in.
  useEffect(() => {
    setExistingValues(initialValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialValues)]);

  const existingValuesFields: Record<string, any> = {
    name: { field_type: TextInput, required: false, disabled: true },
    role: {
      field_type: Select,
      required: false,
      disabled: false,
      other: {
        options: [
          { value: "viewer", label: "viewer" },
          { value: "editor", label: "editor" },
          { value: "admin", label: "admin" },
        ],
      },
    },
  };

  const roleField = {
    field_type: Select,
    required: false,
    disabled: false,
    placeholder: "role",
    other: {
      options: [
        { value: "viewer", label: "viewer" },
        { value: "editor", label: "editor" },
        { value: "admin", label: "admin" },
      ],
    },
  };

  useEffect(() => {
    if (addNewMapping && newMappingRef.current) {
      newMappingRef.current.scrollIntoView({ behavior: "smooth" });
    }
  });

  return (
    <div>
      <div className={`${styles.fieldsWrapper}`} ref={containerRef}>
        {existingValues.map((value, index) => (
          <div className={styles.existingRow} key={`${subjectType}.${value.name}`}>
            <div className={`grid grid-cols-2 ${styles.existingFieldset}`}>
              {/* name -- read-only display of the existing subject */}
              <FormField
                key="name"
                field_type={existingValuesFields.name.field_type}
                required={false}
                disabled={true}
                name={`${subjectType}.existing.${index}.name`}
                placeholder={
                  subjectType === "group"
                    ? (value.name || "").replace(/^\//, "")
                    : value.name
                }
                isSubmitted={false}
                errors={{}}
                fieldClassName={styles.existingFieldInput}
                fieldsetClassName={styles.existingFieldSetClassName}
              />
              {/* role -- editable; kept in existingValues state and reported to
                  the parent via onEdit so an in-place role change is saved. */}
              <fieldset
                className={`grid grid-cols-2 ${styles.existingFieldSetClassName}`}
              >
                <Select
                  className={`mt-2 ${styles.existingFieldInput}`}
                  options={existingValuesFields.role.other.options}
                  value={
                    existingValuesFields.role.other.options.find(
                      (o: any) => o.value === value.role
                    ) ?? null
                  }
                  onChange={(opt: any) => {
                    const role = opt?.value;
                    if (!role) return;
                    setExistingValues((prev) =>
                      prev.map((it, i) =>
                        i === index ? { ...it, role } : it
                      )
                    );
                    onEdit?.(value.name, role);
                  }}
                  menuPortalTarget={
                    typeof document !== "undefined" ? document.body : undefined
                  }
                  menuPosition="fixed"
                  styles={asyncSelectStyles}
                />
              </fieldset>
            </div>
            <div
              className={styles.removeIcon}
              onClick={() => {
                setExistingValues((prev) =>
                  prev.filter((item) => item.name !== value.name)
                );
                setToRemove((prev) => [...prev, value]);
                onRemove?.(value);
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </div>
          </div>
        ))}
        {Array.from({
          length: newCount + Math.max(0, 3 - existingValues.length),
        }).map((_, index) => (
          <div
            key={index}
            ref={newMappingRef}
            className={`grid grid-cols-2 ${styles.newFieldset}`}
          >
            {/* subject: async dropdown of Keycloak users/groups */}
            <SubjectSelect
              subjectType={subjectType}
              name={`new.${subjectType}.${index}.name`}
              placeholder={`${subjectType} name`}
            />
            {/* role */}
            <FormField
              field_type={roleField.field_type}
              required={roleField.required}
              disabled={roleField.disabled}
              name={`new.${subjectType}.${index}.role`}
              placeholder={roleField.placeholder}
              isSubmitted={false}
              isSelect={true}
              errors={{}}
              other={roleField.other}
              fieldClassName={styles.existingFieldInput}
              fieldsetClassName={styles.existingFieldSetClassName}
            />
          </div>
        ))}
      </div>
      <div
        className={styles.addMapping}
        onClick={() => {
          setAddNewMapping(true);
          setNewCount(newCount + 1);
        }}
      >
        add {subjectType} mapping
      </div>
    </div>
  );
}
