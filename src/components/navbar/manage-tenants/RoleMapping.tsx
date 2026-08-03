import { useEffect, useRef, useState } from "react";
import styles from "../Search.module.css";
import FormField from "./FormField";
import { TextInput } from "@/components/ui/TextInput";
import Select from "react-select";
import SubjectSelect from "./SubjectSelect";

interface RoleMappingProps {
  subjectType: "group" | "user";
  // Existing grants for this subject type (empty on create; the tenant's current
  // grants on update). Shape: { name, role }.
  initialValues?: Record<string, string>[];
  // Called when an existing grant is removed, so the parent can DELETE it.
  onRemove?: (removed: Record<string, string>) => void;
}

export default function RoleMapping({
  subjectType,
  initialValues = [],
  onRemove,
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
              {Object.keys(existingValuesFields).map((field) => (
                <FormField
                  key={field}
                  field_type={existingValuesFields[field].field_type}
                  required={existingValuesFields[field].required}
                  disabled={existingValuesFields[field].disabled}
                  name={`${subjectType}.existing.${index}.${field}`}
                  placeholder={
                    field === "name" && subjectType === "group"
                      ? (value[field] || "").replace(/^\//, "")
                      : value[field]
                  }
                  isSelect={field === "role"}
                  isSubmitted={false}
                  errors={{}}
                  other={existingValuesFields[field].other}
                  fieldClassName={styles.existingFieldInput}
                  fieldsetClassName={styles.existingFieldSetClassName}
                />
              ))}
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
