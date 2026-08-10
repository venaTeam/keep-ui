import { useState } from "react";
import Modal from "@/components/ui/Modal";
import styles from "../Search.module.css";
import { FormProvider, useForm } from "react-hook-form";
import { TextInput } from "@/components/ui/TextInput";
import FormField from "./FormField";
import { Button } from "@/components/ui";
import RoleMapping from "./RoleMapping";
import { useApi } from "@/shared/lib/hooks/useApi";
import { showErrorToast, showSuccessToast } from "@/shared/ui";
import {
  useTenants,
  useTenant,
  RoleAssignment,
  SubjectType,
  Role,
} from "./useManageTenants";

type TenantModalProps = {
  modalType: string;
  openModal: boolean;
  setOpenModal: (open: boolean) => void;
  tenantData?: any;
};

type TenantFormType = {
  name: string;
};

export default function TenantFormModal({
  modalType,
  openModal,
  setOpenModal,
  tenantData,
}: TenantModalProps) {
  const api = useApi();
  const { mutate: mutateTenants } = useTenants();
  const [removed, setRemoved] = useState<
    { subject: string; subject_type: SubjectType }[]
  >([]);
  // In-place role edits to existing grants, keyed by `${subject_type}:${subject}`
  // so re-editing the same row overwrites rather than piles up.
  const [edits, setEdits] = useState<Record<string, RoleAssignment>>({});
  const recordEdit = (subject_type: SubjectType) => (name: string, role: string) =>
    setEdits((prev) => ({
      ...prev,
      [`${subject_type}:${name}`]: {
        subject: name,
        subject_type,
        role: role as Role,
      },
    }));

  const isUpdate = modalType === "update tenant";
  const tenantId = tenantData?.id ?? tenantData?.tenant_id;

  // On update, load the tenant's current grants so they can be edited/removed.
  const { data: tenantDetail, mutate: mutateTenant } = useTenant(
    isUpdate ? tenantId : undefined
  );
  const grants = tenantDetail?.roles ?? [];
  const userGrants = grants
    .filter((g) => g.subject_type === "user")
    .map((g) => ({ name: g.subject, role: g.role }));
  const groupGrants = grants
    .filter((g) => g.subject_type === "group")
    .map((g) => ({ name: g.subject, role: g.role }));

  const methods = useForm<TenantFormType>({ mode: "onChange" });
  const {
    formState: { errors, isSubmitted, isSubmitting },
  } = methods;

  // Build role_mappings from the typed user/group rows (react-hook-form nests
  // them as new.user.N / new.group.N). The admin field is a mapping too, on create.
  const collectMappings = (data: any): RoleAssignment[] => {
    const out: RoleAssignment[] = [];
    const seen = new Set<string>();
    const push = (subject?: string, subject_type?: SubjectType, role?: string) => {
      if (!subject || !role || seen.has(subject)) return;
      seen.add(subject);
      out.push({ subject, subject_type: subject_type!, role: role as Role });
    };
    Object.values(data?.new?.user ?? {}).forEach((r: any) =>
      push(r?.name, "user", r?.role)
    );
    Object.values(data?.new?.group ?? {}).forEach((r: any) =>
      push(r?.name, "group", r?.role)
    );
    return out;
  };

  const onSubmit = methods.handleSubmit(async (data) => {
    const mappings = collectMappings(data);
    try {
      if (!isUpdate) {
        if (!mappings.some((m) => m.role === "admin")) {
          showErrorToast(new Error("At least one admin is required"));
          return;
        }
        await api.post("/tenants", { name: data.name, role_mappings: mappings });
        showSuccessToast("Tenant created");
      } else {
        // Remove the grants the user deleted first.
        const removedKeys = new Set(
          removed.map((r) => `${r.subject_type}:${r.subject}`)
        );
        for (const r of removed) {
          await api.delete(
            `/tenants/${tenantId}/roles?subject=${encodeURIComponent(r.subject)}`
          );
        }
        // POST both in-place edits to existing grants AND newly added rows.
        // The backend upserts on (tenant_id, subject), so re-POSTing an edited
        // grant updates its role. Skip anything that was just removed, and
        // dedupe so a subject isn't POSTed twice.
        const editList = Object.values(edits).filter(
          (e) => !removedKeys.has(`${e.subject_type}:${e.subject}`)
        );
        const seenPost = new Set<string>();
        const toPost = [...editList, ...mappings].filter((m) => {
          const key = `${m.subject_type}:${m.subject}`;
          if (seenPost.has(key)) return false;
          seenPost.add(key);
          return true;
        });
        for (const m of toPost) {
          await api.post(`/tenants/${tenantId}/roles`, m);
        }
        showSuccessToast("Tenant updated");
        await mutateTenant();
      }
      await mutateTenants();
      methods.reset();
      setRemoved([]);
      setEdits({});
      setOpenModal(false);
    } catch (error) {
      showErrorToast(error);
    }
  });

  return (
    <Modal
      className={styles.tenantFormModal}
      isOpen={openModal}
      onClose={() => {
        setOpenModal(false);
        setRemoved([]);
        setEdits({});
        methods.reset();
      }}
      data-cy="cy-modal"
      title={`${modalType}`}
    >
      <FormProvider {...methods}>
        <form className="flex flex-col flex-1 min-h-0" onSubmit={onSubmit}>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className={`mb-10 ${styles.modalContent}`}>
              <div className={styles.requiredFields}>
                <FormField
                  field_type={TextInput}
                  title="name"
                  required={!isUpdate}
                  disabled={isUpdate}
                  placeholder={isUpdate ? tenantData?.tenant_name : "tenant name"}
                  isSelect={false}
                  isSubmitted={isSubmitted}
                  errors={errors}
                  fieldsetClassName={styles.fieldset}
                />
              </div>
              <div className={styles.rolesMapping}>
                <div className={styles.rolesMappingHeader}>
                <label
                  className={`text-tremor-default mr-10 font-medium text-tremor-content-strong ${styles.fieldLabelRM}`}
                >
                  roles mapping
                </label>
                {!isUpdate && (
                  <div className="text-sm text-red-500">
                    choose at least one admin
                  </div>
                )}
                </div>
                <div className={styles.rolesMappingContent}>
                  <div className={styles.rolesMappingPart}>
                    <label
                      className={`text-tremor-default mr-10 font-medium text-tremor-content-strong ${styles.fieldLabelSubject}`}
                    >
                      users
                    </label>
                    <RoleMapping
                      subjectType="user"
                      initialValues={userGrants}
                      onEdit={recordEdit("user")}
                      onRemove={(v) =>
                        setRemoved((prev) => [
                          ...prev,
                          { subject: v.name, subject_type: "user" },
                        ])
                      }
                    />
                  </div>
                  <div className={styles.rolesMappingPart}>
                    <label
                      className={`text-tremor-default mr-10 font-medium text-tremor-content-strong ${styles.fieldLabelSubject}`}
                    >
                      groups
                    </label>
                    <RoleMapping
                      subjectType="group"
                      initialValues={groupGrants}
                      onEdit={recordEdit("group")}
                      onRemove={(v) =>
                        setRemoved((prev) => [
                          ...prev,
                          { subject: v.name, subject_type: "group" },
                        ])
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className={`flex justify-end ${styles.modalFooter}`}>
              <Button
                variant={undefined}
                className={styles.submitButton}
                type="submit"
                disabled={isSubmitting}
              >
                {modalType}
              </Button>
            </div>
          </div>
        </form>
      </FormProvider>
    </Modal>
  );
}
