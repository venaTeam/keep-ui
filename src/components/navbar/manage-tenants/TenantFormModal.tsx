import { useState } from "react";
import Modal from "@/components/ui/Modal";
import styles from "../Search.module.css";
import { FormProvider, useForm, useFormContext } from "react-hook-form";
import { TextInput } from "@/components/ui/TextInput";
import { get } from "lodash";
import FormField from "./FormField";
import AsyncSelect from "react-select/async";
import Select from "react-select";
import { Button } from "@/components/ui";
import RoleMapping from "./RoleMapping";


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

    // GULI TODO: change options and select to loadOptions and AsyncSelect when we have the API for it + Move to CONST
    const modal_fields: Record<string, Record<string, { field_type: any; required: boolean; disabled: boolean; placeholder: string | undefined; other?: any }>> = 
    {"create tenant":
        {"name":
            {"field_type": TextInput,"required": true, "disabled": false, "placeholder": "tenant name"},
        "admin":
            {"field_type": Select, "required": true, "disabled": false, "placeholder": "admin",
                "other": {
                "options": [{value: "label1", label: "Label 1"}, {value: "label2", label: "Label 2"}]
                }
            }
        },
    "update tenant":
        {"name":
            {"field_type": TextInput, "required": false, "disabled": true, "placeholder": tenantData?.tenant_name}
        },
    "create api key":
        {"name":
            {"field_type": TextInput, "required": true, "disabled": false, "placeholder": "api key name"}
        }
    
    }



    const [adminIsUser, setAdminIsUser] = useState(true);

    
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
    <Modal className={styles.tenantFormModal} isOpen={openModal} onClose={() => {setOpenModal(false)}} data-cy="cy-modal" title={`${modalType}`}>
      <FormProvider {...methods}>
              <form
                className="flex flex-col flex-1 min-h-0"
                onSubmit={methods.handleSubmit((data) => {
                    console.log(data);
                })}
              >
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className={`mb-10 ${styles.modalContent}`}>
                    <div className={styles.requiredFields}>
                        {Object.keys(modal_fields[modalType]).map((field) => (
                            <FormField
                                field_type={modal_fields[modalType][field].field_type}
                                key={field}
                                title={field}
                                required={modal_fields[modalType][field].required}
                                disabled={modal_fields[modalType][field].disabled}
                                placeholder={modal_fields[modalType][field].placeholder || ""}
                                register={register}
                                isSubmitted={isSubmitted}
                                errors={errors}
                                other={modal_fields[modalType][field].other}
                                children={field === "admin" && (
                                    <div className={styles.userGroup}>
                                        <span className={`${adminIsUser ? styles.userGroupChosen : styles.userGroupNotChosen}`} onClick={() => setAdminIsUser(true)}> &nbsp; user &thinsp;</span>
                                        <span className={`${!adminIsUser ? styles.userGroupChosen : styles.userGroupNotChosen}`} onClick={() => setAdminIsUser(false)}>&nbsp; group &thinsp;</span>
                                    </div>
                                )}
                            />
                        ))}
                    </div>

                    {modalType != "create api key" && (
                        <div className={styles.rolesMapping}>
                            <label className={`text-tremor-default mr-10 font-medium text-tremor-content-strong ${styles.fieldLabelRM}`}>roles mapping</label>
                            <div className={styles.rolesMappingContent}>
                                <div className={styles.rolesMappingPart}>
                                    <label className={`text-tremor-default mr-10 font-medium text-tremor-content-strong ${styles.fieldLabelSubject}`}>users</label>
                                    <RoleMapping subjectType="user" />
                            </div>
                            <div className={styles.rolesMappingPart}>
                            <label className={`text-tremor-default mr-10 font-medium text-tremor-content-strong ${styles.fieldLabelSubject}`}>groups</label>
                            <RoleMapping subjectType="group" />
                            </div>
                        </div>
                    </div>)}
                  </div>
                  <div className={`flex justify-end ${styles.modalFooter}`}>
                    <Button variant={undefined} className={styles.submitButton}>
                        {modalType}
                    </Button>
                  </div>
                </div>
              </form>
            </FormProvider>
    </Modal>
  )
}
