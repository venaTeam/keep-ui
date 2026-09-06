import { useState } from "react";
import Modal from "@/components/ui/Modal";
import styles from "../Search.module.css";
import { FormProvider, useForm } from "react-hook-form";
import { TextInput } from "@/components/ui/TextInput";
import FormField from "./FormField";
import AvailableGroupSelect from "./AvailableGroupSelect";
import { Button } from "@/components/ui";
import { useApi } from "@/shared/lib/hooks/useApi";
import { useHydratedSession as useSession } from "@/shared/lib/hooks/useHydratedSession";
import { showErrorToast, showSuccessToast } from "@/shared/ui";
import { useOperators, useWhoami } from "./useManageTenants";

type OperatorModalProps = {
  modalType: string;
  openModal: boolean;
  setOpenModal: (open: boolean) => void;
};

type OperatorFormType = {
  name: string;
  group: string;
};

export default function OperatorModal({
  modalType,
  openModal,
  setOpenModal,
}: OperatorModalProps) {
  const api = useApi();
  const { data: session } = useSession();
  const [copiedApiKey, setCopiedApiKey] = useState<string | null>(null);

  // Operators attach to the user's current tenant (from the tenant switcher),
  // so there is no tenant picker -- the modal always works on this tenant.
  const currentTenantId =
    session?.tenantId ?? session?.user?.tenantIds?.[0]?.tenant_id;

  const methods = useForm<OperatorFormType>({ mode: "onChange" });
  const {
    formState: { errors, isSubmitted, isSubmitting },
  } = methods;

  const { data: operators = [], mutate: mutateOperators } =
    useOperators(currentTenantId);

  const { data: whoami } = useWhoami();
  const isSuperAdmin = whoami?.role === "superadmin";

  // Existing operators for the current tenant (id + name + apikey), from the API.
  const existingValues = operators.map((o) => ({
    id: o.id,
    operator_name: o.name,
    api_key: o.apikey,
  }));

  // Superadmin-only: delete an operator via the API. Removing the operator row
  // also removes its tenant link (tenant_id lives on the operator).
  const handleDeleteOperator = async (operatorId: string) => {
    if (!window.confirm("Delete this operator? It will be removed from the tenant.")) {
      return;
    }
    try {
      await api.delete(`/operators/${operatorId}`);
      showSuccessToast("Operator deleted");
      await mutateOperators();
    } catch (error) {
      showErrorToast(error);
    }
  };

  const handleCopyApiKey = (apiKey: string) => {
    navigator.clipboard
      .writeText(apiKey)
      .then(() => setCopiedApiKey(apiKey))
      .catch(() => console.error("Failed to copy API key"));
  };

  const onSubmit = methods.handleSubmit(async (data) => {
    if (!currentTenantId) {
      showErrorToast(new Error("No current tenant"));
      return;
    }
    try {
      await api.post("/operators", {
        group: data.group,
        tenant_id: currentTenantId,
        name: data.name,
      });
      showSuccessToast("Operator created");
      // The new operator (with its apikey) shows up in the list; the claimed
      // group drops out of available-groups on the next search.
      await mutateOperators();
      methods.reset({ name: "", group: "" });
    } catch (error) {
      showErrorToast(error);
    }
  });

  return (
    <Modal
      className={styles.tenantFormModal}
      isOpen={openModal}
      onClose={() => setOpenModal(false)}
      data-cy="cy-modal"
      title={`${modalType}s`}
    >
      <FormProvider {...methods}>
        <form className="flex flex-col flex-1 min-h-0" onSubmit={onSubmit}>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className={`mb-10 ${styles.operatorModalContent}`}>
              <div className="flex flex-row">
                {existingValues.length == 0 ? (
                  <div className={styles.noOperators}>No operators yet!</div>
                ) : (
                  <div className={styles.existingOperators}>
                    {existingValues.map((value) => (
                      <div
                        className={styles.existingOperator}
                        key={value.operator_name}
                      >
                        <div className={styles.operatorName}>
                          {value.operator_name}
                        </div>
                        <div className={styles.apiKey}>
                          <span>{value.api_key}</span>
                          <div
                            onClick={() => handleCopyApiKey(value.api_key)}
                            className="ml-2 p-1 hover:bg-gray-200 rounded cursor-pointer"
                          >
                            {copiedApiKey === value.api_key ? (
                              <svg
                                xmlns="http://w3.org"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="green"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            ) : (
                              <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                <rect
                                  x="8"
                                  y="8"
                                  width="13"
                                  height="13"
                                  rx="2.5"
                                  ry="2.5"
                                />
                              </svg>
                            )}
                          </div>
                        </div>
                        {isSuperAdmin && (
                          <div
                            onClick={() => handleDeleteOperator(value.id)}
                            className="ml-2 p-1 hover:bg-red-100 rounded cursor-pointer"
                            title="Delete operator"
                          >
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="red"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M18 6 6 18" />
                              <path d="M6 6l12 12" />
                            </svg>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.requiredOperatorFields}>
                <div className={styles.createOperator}>create new operator</div>

                <FormField
                  field_type={TextInput}
                  title="name"
                  required={true}
                  disabled={false}
                  placeholder="operator name"
                  isSubmitted={isSubmitted}
                  errors={errors}
                  fieldsetClassName={styles.operatorFieldSetClassName}
                />

                <fieldset
                  className={`grid grid-cols-2 ${styles.operatorFieldSetClassName}`}
                >
                  <label
                    className={`text-tremor-default mr-10 font-medium text-tremor-content-strong ${styles.fieldLabel}`}
                  >
                    group
                    <div className={`text-red-500 ${styles.requiredField}`}>
                      {" "}
                      &nbsp; *
                    </div>
                  </label>
                  <AvailableGroupSelect
                    name="group"
                    placeholder="type to search groups"
                  />
                </fieldset>
              </div>
            </div>
            <div className={`flex justify-end ${styles.modalFooter}`}>
              <Button
                variant={undefined}
                className={styles.submitButton}
                type="submit"
                disabled={isSubmitting}
              >
                create {modalType}
              </Button>
            </div>
          </div>
        </form>
      </FormProvider>
    </Modal>
  );
}
