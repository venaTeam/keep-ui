import { useState } from "react";
import Modal from "@/components/ui/Modal";
import ".././Search.css";
import { FormProvider, useForm, useFormContext } from "react-hook-form";
import { TextInput } from "@/components/ui/TextInput";
import { get } from "lodash";
import ".././Search.css";
import FormField from "./FormField";

type TenantModalProps = {
    modalType: string;
    openModal: boolean;
    setOpenModal: (open: boolean) => void;
    tenantData?: any;
}

type Role = {
    name: string;
    role: "viewer" | "editor" | "admin";
}

type TenantFormType = {
  name: string;
  admin?: string;
  operator: string;
  groupsRoles: Role[];
  usersRoles: Role[];
};

export default function TenantFormModal({modalType, openModal, setOpenModal, tenantData}: TenantModalProps) {

    console.log(tenantData);
    
    const modal_fields: Record<string, Record<string, { required: boolean; disabled: boolean; placeholder: string | undefined }>> = 
    {"create":
        {"name":
            {"required": true, "disabled": false, "placeholder": "tenant name"},
        "admin":
            {"required": true, "disabled": false, "placeholder": "admin"}
        },
    "update":
        {"name":
            {"required": false, "disabled": true, "placeholder": tenantData?.tenant_name},
    }}
    
    const methods = useForm<TenantFormType>({
        mode: "onChange",
      });

      const {
        control,
        register,
        watch,
        formState: { errors, isSubmitted },
      } = methods;

  return (
    <Modal isOpen={openModal} onClose={() => {setOpenModal(false)}} data-cy="cy-modal" title={`${modalType} tenant`}>
      <FormProvider {...methods}>
              <form
                className="flex flex-col flex-1 min-h-0"
                onSubmit={methods.handleSubmit((data) => {
                    console.log(data);
                })}
              >
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className="mb-10">
                    <div className="required-fields">
                        {Object.keys(modal_fields[modalType]).map((field) => (
                            <FormField
                                key={field}
                                title={field}
                                required={modal_fields[modalType][field].required}
                                disabled={modal_fields[modalType][field].disabled}
                                placeholder={modal_fields[modalType][field].placeholder || ""}
                                register={register}
                                isSubmitted={isSubmitted}
                                errors={errors}
                            />
                        ))}
                    </div>

                  </div>
                </div>
              </form>
            </FormProvider>
    </Modal>
  )
}
