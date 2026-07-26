import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "../Search.module.css";
import TenantFormModal from "./TenantFormModal";
import FormField from "./FormField";
import { TextInput } from "@/components/ui/TextInput";
import Select from "react-select";


interface RoleMappingProps {
  subjectType: "group" | "user";
}

export default function RoleMapping({ subjectType }: RoleMappingProps) {

  const containerRef = useRef<HTMLDivElement>(null);
  const newMappingRef = useRef<HTMLDivElement>(null);
  const [addNewMapping, setAddNewMapping] = useState(false);
  const [newCount, setNewCount] = useState(0);

  const existingValues: Record<string, string>[] = [{"name": "value1", "role": "viewer"}, {"name": "value2", "role": "editor"}, {"name": "value3", "role": "admin"}];

const existingValuesFields: Record<string, any> = {
  "name": {
    "field_type": TextInput,
    "required": false,
    "disabled": true,
  },
  "role": {
    "field_type": Select,
    "required": false,
    "disabled": false,
    "other": {
      "options": [
        { value: "viewer", label: "viewer" },
        { value: "editor", label: "editor" },
        { value: "admin", label: "admin" },
      ],
    },
  },
};

const newFields: Record<string, any> = {
  "name": {
    "field_type": TextInput,
    "required": true,
    "disabled": false,
    "placeholder": `${subjectType} name`,
  },
  "role": {
    "field_type": Select,
    "required": true,
    "disabled": false,
    "placeholder": "role",
    "other": {
      "options": [
        { value: "viewer", label: "viewer" },
        { value: "editor", label: "editor" },
        { value: "admin", label: "admin" },
      ],
    },
  },
};

  useEffect(() => {
    if (addNewMapping && newMappingRef.current) {
      newMappingRef.current.scrollIntoView({ behavior: "smooth" });
    }
  })

  return (
    <div>
      <div className={`${styles.fieldsWrapper}`} ref={containerRef}>
      {existingValues.map((value, index) => (
        <div key={index} className={`grid grid-cols-2 ${styles.existingFieldset}`}>
          {Object.keys(existingValuesFields).map((field) => (
            <FormField
              key={field}
              field_type={existingValuesFields[field].field_type}
              required={existingValuesFields[field].required}
              disabled={existingValuesFields[field].disabled}
              placeholder={value[field]}
              register={() => {}}
              isSubmitted={false}
              errors={{}}
              other={existingValuesFields[field].other}
              fieldClassName={styles.existingFieldInput}
              fieldsetClassName={styles.existingFieldSetClassName}
            />
          ))}
        </div>
      ))}
       {addNewMapping && (
        Array.from({ length: newCount }).map((_, index) => (
        <div key={index} ref={newMappingRef} className={`grid grid-cols-2 ${styles.newFieldset}`}>
          {Object.keys(newFields).map((field) => (
            <FormField
              key={field}
              field_type={newFields[field].field_type}
              required={newFields[field].required}
              disabled={newFields[field].disabled}
              placeholder={newFields[field].placeholder || ""}
              register={() => {}}
              isSubmitted={false}
              errors={{}}
              other={newFields[field].other}
              fieldClassName={styles.existingFieldInput}
              fieldsetClassName={styles.existingFieldSetClassName}
            />
          ))}
        </div>
      )))}
      </div>
      <div className={styles.addMapping} onClick={() => {
        setAddNewMapping(true);
        setNewCount(newCount + 1);
      }} >
        add {subjectType} mapping
      </div>
     
    </div>
  );
}