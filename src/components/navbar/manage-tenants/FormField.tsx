import { useState } from "react";
import styles from "../Search.module.css";
import { get } from "react-hook-form";

interface FormFieldProps {
    title?: string;
    required: boolean;
    disabled: boolean;
    placeholder: string;
    register: any;
    isSubmitted: boolean;
    errors: any;
    other?: any;
    field_type: React.ElementType;
    children?: React.ReactNode;
    fieldClassName?: any;
    fieldsetClassName?: any;
}

export default function FormField({fieldClassName, fieldsetClassName, field_type: FieldComponent, title, required, disabled, placeholder, register, isSubmitted, errors, other, children}: FormFieldProps) {

  return (
    <fieldset className={`grid grid-cols-2 ${fieldsetClassName || styles.fieldset}`} >
        { title && <label className={`text-tremor-default mr-10 font-medium text-tremor-content-strong ${styles.fieldLabel}`}>{title}
            {children}
            {required&& <div className={`text-red-500 ${styles.requiredField}`}> &nbsp; *</div>}

        </label>}
         <FieldComponent
                type="text"
                disabled={disabled}
                placeholder={placeholder}
                className={`mt-2 ${fieldClassName || styles.fieldInput}`}
                {...register(title, {
                required: { message: `${title} is required`, value: true },})}
                error={isSubmitted && !!get(errors, `${title}.message`)}
                errorMessage={isSubmitted ? get(errors, `${title}.message`) : undefined}
                data-cy={`rules-form-${title}-input`}
                options={other?.options}
            />
    </fieldset>
  )
}
