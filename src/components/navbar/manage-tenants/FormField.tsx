import ".././Search.css";
import { errors } from "@/metrics/metrics";
import { TextInput } from "@tremor/react";
import { get } from "react-hook-form";

interface FormFieldProps {
    title: string;
    required: boolean;
    disabled: boolean;
    placeholder: string;
    register: any;
    isSubmitted: boolean;
    errors: any;
}

export default function FormField({title, required, disabled, placeholder, register, isSubmitted, errors}: FormFieldProps) {


  return (
    <fieldset className="grid grid-cols-2">
        <label className="text-tremor-default mr-10 font-medium text-tremor-content-strong">{title} {required&& <span className="text-gray-500">*</span>}
            <TextInput
                type="text"
                disabled={disabled}
                placeholder={placeholder}
                className="mt-2"
                {...register(title, {
                required: { message: `${title} is required`, value: true },})}
                error={isSubmitted && !!get(errors, `${title}.message`)}
                errorMessage={isSubmitted ? get(errors, `${title}.message`) : undefined}
                data-cy={`rules-form-${title}-input`}
            />
        </label>
    </fieldset>

  )
}
