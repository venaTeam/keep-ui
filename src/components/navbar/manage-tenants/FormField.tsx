import { useState } from "react";
import ".././Search.css";
import TenantFormModal from "./TenantFormModal";
import { errors } from "@/metrics/metrics";
import { TextInput } from "@tremor/react";
import { required } from "zod/v4/core/util";

interface FormFieldProps {
    title: string;
    required: boolean;
    disabled: boolean;
    placeholder: string;
}

export default function FormField({title, required, disabled, placeholder}: FormFieldProps) {


  return (
    <fieldset className="grid grid-cols-2">
        <label className="text-tremor-default mr-10 font-medium text-tremor-content-strong">{title} {required&& <span className="text-gray-500">*</span>}
            <TextInput
                type="text"
                disabled={disabled}
                placeholder={placeholder}
                className="mt-2"
                {...register("name", {
                required: { message: "Name is required", value: true },})}
                error={isSubmitted && !!get(errors, "name.message")}
                errorMessage={isSubmitted ? get(errors, "name.message") : undefined}
                data-cy="rules-form-name-input"/>
        </label>
    </fieldset>

  )
}
