import { useState } from "react";
import Modal from "@/components/ui/Modal";
import ".././Search.css";
import { FormProvider, useForm, useFormContext } from "react-hook-form";
import { TextInput } from "@/components/ui/TextInput";
import { get } from "lodash";
import ".././Search.css";

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
                    <fieldset className="grid grid-cols-2">
                        <label className="text-tremor-default mr-10 font-medium text-tremor-content-strong">tenant name {!tenantData?.tenant_name && <span className="text-gray-500">*</span>}
                            <TextInput
                                type="text"
                                disabled={tenantData?.tenant_name ? true : false}
                                placeholder={tenantData?.tenant_name ? tenantData.tenant_name : "tenant name"}
                                className="mt-2"
                                {...register("name", {
                                required: { message: "Name is required", value: true },
                                })}
                                error={isSubmitted && !!get(errors, "name.message")}
                                errorMessage={isSubmitted ? get(errors, "name.message") : undefined}
                                data-cy="rules-form-name-input"
                        />
                        </label>
                    </fieldset>
                    {modalType === "create" && 
                     <fieldset className="grid grid-cols-2">
                        <label className="text-tremor-default mr-10 font-medium text-tremor-content-strong">admin <span className="text-gray-500">*</span>
                            <TextInput
                                type="text"
                                disabled={tenantData?.tenant_name ? true : false}
                                placeholder={tenantData?.tenant_name ? tenantData.tenant_name : "tenant name"}
                                className="mt-2"
                                {...register("name", {
                                required: { message: "Name is required", value: true },
                                })}
                                error={isSubmitted && !!get(errors, "name.message")}
                                errorMessage={isSubmitted ? get(errors, "name.message") : undefined}
                                data-cy="rules-form-name-input"
                        />
                        </label>
                    </fieldset>}
                    </div>
                    
                  </div>
                </div>
              </form>
            </FormProvider>
    </Modal>
  )
}
