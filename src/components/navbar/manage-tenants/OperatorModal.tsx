import { useState, useEffect, useRef } from "react";
import Modal from "@/components/ui/Modal";
import styles from "../Search.module.css";
import { FormProvider, useForm } from "react-hook-form";
import { TextInput } from "@/components/ui/TextInput";
import FormField from "./FormField";
import Select from "react-select";
import { Button } from "@/components/ui";



type OperatorModalProps = {
    modalType: string;
    openModal: boolean;
    setOpenModal: (open: boolean) => void;
}


type OperatorFormType = {
  name: string;
  group: string;
  tenant: string;
};

export default function OperatorModal({modalType, openModal, setOpenModal}: OperatorModalProps) {

    const [copiedApiKey, setCopiedApiKey] = useState<string | null>(null);

    const modal_fields: Record<string, Record<string, { field_type: any; required: boolean; disabled: boolean; placeholder: string | undefined; other?: any }>> = 
    {
    "operator":
        {"name":
            {"field_type": TextInput, "required": true, "disabled": false, "placeholder": "operator name"},
        "group":
            {"field_type": Select, "required": true, "disabled": false, "placeholder": "group",
                "other": {
                "options": [{value: "label1", label: "Label 1"}, {value: "label2", label: "Label 2"}]
                }
            },
        "tenant":
            {"field_type": Select, "required": true, "disabled": false, "placeholder": "tenant",
                "other": {
                "options": [{value: "label1", label: "Label 1"}, {value: "label2", label: "Label 2"}]
                }
            },
           
    
    }
}

    const [existingValues, setExistingValues] = useState<any[]>([{"operator_name": "guli", "api_key": "aaaaaaaaaaaa"}, {"operator_name": "guli2", "api_key": "bbbbbbbbb"}])

    // const existing_values: any[] = []
    
    const handleCopyApiKey = (apiKey: string) => {
      navigator.clipboard.writeText(apiKey).then(() => {
        setCopiedApiKey(apiKey);
      }).catch(() => {
        console.error("Failed to copy API key");
      });
    };
    
    const methods = useForm<OperatorFormType>({
        mode: "onChange",
      });

      const {
        control,
        watch,
        formState: { errors, isSubmitted },
      } = methods;

  return (
    <Modal className={styles.tenantFormModal} isOpen={openModal} onClose={() => {setOpenModal(false)}} data-cy="cy-modal" title={`${modalType}s`}>
      <FormProvider {...methods}>
              <form
                className="flex flex-col flex-1 min-h-0"
                onSubmit={methods.handleSubmit((data) => {
                    console.log(data);
                    methods.reset();
                    setOpenModal(false);
                })}
              >
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className={`mb-10 ${styles.operatorModalContent}`}>

                    <div className="flex flex-row">
                    {existingValues.length == 0 ? 
                    <div className={styles.noOperators}>No operators yet!</div> :
                    <div className={styles.existingOperators}>
                        {existingValues.map((value) => (
                            <div className={styles.existingOperator} key={value.operator_name}>
                            <div className={styles.operatorName} >{value.operator_name}</div>
                            <div className={styles.apiKey}>
                              <span>{value.api_key}</span>
                              <div 
                                onClick={() => handleCopyApiKey(value.api_key)}
                                className="ml-2 p-1 hover:bg-gray-200 rounded cursor-pointer">
                                {copiedApiKey === value.api_key ? (
                                    <svg xmlns="http://w3.org" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="green" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                ) : (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                    <rect x="8" y="8" width="13" height="13" rx="2.5" ry="2.5" />
                                    </svg>

                                )}
                              </div>
                            </div>
                            </div>
                        ))}
                    </div>}
                    </div>

                    <div className={styles.requiredOperatorFields}>
                        <div className={styles.createOperator}>create new operator</div>

                        {Object.keys(modal_fields[modalType]).map((field) => (
                            <FormField
                                field_type={modal_fields[modalType][field].field_type}
                                key={field}
                                title={field}
                                required={modal_fields[modalType][field].required}
                                disabled={modal_fields[modalType][field].disabled}
                                placeholder={modal_fields[modalType][field].placeholder || ""}
                                isSubmitted={isSubmitted}
                                errors={errors}
                                other={modal_fields[modalType][field].other}
                                isSelect={modal_fields[modalType][field].field_type === Select}
                                fieldsetClassName={styles.operatorFieldSetClassName}
                            />
                        ))}
                    </div>
                  </div>
                  <div className={`flex justify-end ${styles.modalFooter}`}>
                    <Button variant={undefined} className={styles.submitButton} type="submit">
                        create {modalType}
                    </Button>
                  </div>
                </div>
              </form>
            </FormProvider>
    </Modal>
  )
}
