import { useEffect, useRef, useState } from "react";
import styles from "../Search.module.css";
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

  const [existingValues, setExistingValues] = useState<Record<string, string>[]>([{"name": "value1", "role": "viewer"}, {"name": "value2", "role": "editor"}]);
  const [toRemove, setToRemove] = useState<Record<string, string>[]>([]);


  // const existingValues = []
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
    "required": false,
    "disabled": false,
    "placeholder": `${subjectType} name`,
  },
  "role": {
    "field_type": Select,
    "required": false,
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

  useEffect(() => {
    console.log("hereee");
    console.log(toRemove)
  }, [toRemove])


  return (
    <div>
      <div className={`${styles.fieldsWrapper}`} ref={containerRef}>
      {existingValues.map((value, index) => (
        <div className={styles.existingRow}>
          
        <div key={index} className={`grid grid-cols-2 ${styles.existingFieldset}`}>
          {Object.keys(existingValuesFields).map((field) => (
            <FormField
              key={field}
              field_type={existingValuesFields[field].field_type}
              required={existingValuesFields[field].required}
              disabled={existingValuesFields[field].disabled}
              name={`${subjectType}.existing.${index}.${field}`}
              placeholder={value[field]}
              isSelect={field === "role"}
              isSubmitted={false}
              errors={{}}
              other={existingValuesFields[field].other}
              fieldClassName={styles.existingFieldInput}
              fieldsetClassName={styles.existingFieldSetClassName}
            />
          ))}
      </div>
      <div key={`${index}.${value.name}.${subjectType}`} className={styles.removeIcon} onClick={() => {
            setExistingValues((prevExistingValues) => prevExistingValues.filter(item => {
              return item.name !== value.name;
          }))
            setToRemove(prevToRemove => [...prevToRemove, value])  
          }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"/>
            <path d="M6 6l12 12"/>
        </svg>
        </div>
        </div>
      ))}
       {(
        Array.from({ length: newCount + (3 - existingValues.length) }).map((_, index) => (
        <div key={index} ref={newMappingRef} className={`grid grid-cols-2 ${styles.newFieldset}`}>
          {Object.keys(newFields).map((field) => (
            <FormField
              key={field}
              field_type={newFields[field].field_type}
              required={newFields[field].required}
              disabled={newFields[field].disabled}
              name={`new.${subjectType}.${index}.${field}`}
              placeholder={newFields[field].placeholder || ""}
              isSubmitted={false}
              isSelect={field === "role"}
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