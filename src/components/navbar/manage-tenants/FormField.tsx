import styles from "../Search.module.css";
import { Controller, get, useFormContext } from "react-hook-form";
import { asyncSelectStyles } from "./useManageTenants";

interface FormFieldProps {
    title?: string;
    name?: string;
    required: boolean;
    disabled: boolean;
    placeholder: string;
    isSubmitted: boolean;
    errors: any;
    other?: any;
    field_type: React.ElementType;
    isSelect?: boolean;
    children?: React.ReactNode;
    fieldClassName?: any;
    fieldsetClassName?: any;
}

export default function FormField({fieldClassName, fieldsetClassName, field_type: FieldComponent, title, name, required, disabled, placeholder, isSubmitted, errors, other, isSelect = false, children}: FormFieldProps) {
  const { control } = useFormContext();
  const fieldName = name || title || "";
  const errorMessage = isSubmitted ? get(errors, `${fieldName}.message`) : undefined;

  return (
    <fieldset className={`grid grid-cols-2 ${fieldsetClassName || styles.fieldset}`} >
        { title && <label className={`text-tremor-default mr-10 font-medium text-tremor-content-strong ${styles.fieldLabel}`}>{title}
            {children}
            {required&& <div className={`text-red-500 ${styles.requiredField}`}> &nbsp; *</div>}

        </label>}
        <Controller
          name={fieldName}
          control={control}
          rules={required ? { required: { message: `${title} is required`, value: true } } : undefined}
          render={({ field }) => {
            const baseProps = {
              className: `mt-2 ${fieldClassName || styles.fieldInput}`,
              onBlur: field.onBlur,
              "data-cy": `rules-form-${title}-input`,
            };

            const fieldProps = isSelect ? {
              value: other?.options?.find((opt: any) => opt.value === field.value) ?? null,
              onChange: (option: any) => field.onChange(option?.value),
              isDisabled: disabled,
              options: other?.options,
              menuPortalTarget: typeof document !== "undefined" ? document.body : undefined,
              menuPosition: "fixed",
              styles: asyncSelectStyles,
            } : {
              type: "text",
              disabled,
              value: field.value ?? "",
              onChange: (event: any) => field.onChange(event.target.value),
              error: isSubmitted && required && !!errorMessage,
              errorMessage,
            };

            return (
              <FieldComponent
                placeholder={placeholder}
                {...baseProps}
                {...fieldProps}
              />
            );
          }}
        />
        {isSelect && errorMessage && <div className="text-red-500 mt-1 text-sm">{errorMessage}</div>}
    </fieldset>
  )
}
