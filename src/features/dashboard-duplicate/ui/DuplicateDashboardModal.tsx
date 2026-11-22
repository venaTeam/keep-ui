import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { Button, TextInput } from "@tremor/react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Modal from "@/components/ui/Modal";
import { KeepApiError } from "@/shared/api";
import {
  confirmNavigation,
  useNavigationGuardStore,
} from "@/shared/lib/navigation-guard";
import { showErrorToast } from "@/shared/ui";
import { Dashboard } from "@/utils/hooks/useDashboards";
import { defaultCopyName, isDashboardNameTaken } from "../lib/copy-name";
import { useDuplicateDashboard } from "../model/useDuplicateDashboard";

const NAME_TAKEN = "A dashboard with this name already exists";
const SOURCE_GONE = "This dashboard no longer exists";

interface DuplicateDashboardModalProps {
  source: Dashboard | null;
  existingNames: string[];
  onClose: () => void;
}

/**
 * Asks for the copy's name and duplicates `source` on the server, then opens
 * the copy. The dialog is open while `source` is set; the last source stays
 * shown while it closes. A result that arrives after the dialog was dismissed
 * or switched to another source only toasts a success; it never closes,
 * navigates or touches the dialog's state. A 404 keeps Duplicate disabled
 * until another source is opened; a 409 reloads the dashboards list so the
 * local name check catches the clash.
 */
export function DuplicateDashboardModal({
  source,
  existingNames,
  onClose,
}: DuplicateDashboardModalProps) {
  const { duplicateDashboard, refreshDashboards } = useDuplicateDashboard();
  const router = useRouter();
  const pathname = usePathname();
  const hasUnsavedChanges = useNavigationGuardStore(
    (state) => state.blockers.length > 0
  );
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const activeRequest = useRef<object | null>(null);

  useEffect(() => {
    activeRequest.current = null;
  }, [source]);

  const dismiss = () => {
    activeRequest.current = null;
    onClose();
  };

  const [prevSource, setPrevSource] = useState<Dashboard | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [name, setName] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [sourceGone, setSourceGone] = useState(false);
  const [pending, setPending] = useState(false);

  if (source !== prevSource) {
    setPrevSource(source);
    if (source) {
      setSourceName(source.dashboard_name);
      setName(defaultCopyName(source.dashboard_name, existingNames));
      setServerError(null);
      setSourceGone(false);
      setPending(false);
    }
  }

  const nameTaken = isDashboardNameTaken(name, existingNames);
  const canSubmit =
    name.trim() !== "" && !nameTaken && !pending && !sourceGone;
  const nameError = sourceGone
    ? SOURCE_GONE
    : serverError ?? (nameTaken && !pending ? NAME_TAKEN : null);
  const showUnsavedNote =
    hasUnsavedChanges &&
    decodeURIComponent(pathname) === `/dashboard/${sourceName}`;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!source || !canSubmit) {
      return;
    }
    const request = {};
    activeRequest.current = request;
    setPending(true);
    setServerError(null);
    let created: Dashboard;
    try {
      created = await duplicateDashboard(source.id, name);
    } catch (error) {
      if (activeRequest.current !== request) {
        return;
      }
      activeRequest.current = null;
      setPending(false);
      const status =
        error instanceof KeepApiError ? error.statusCode : undefined;
      if (status === 409) {
        setServerError(NAME_TAKEN);
        refreshDashboards();
      } else if (status === 404) {
        setSourceGone(true);
        refreshDashboards();
      } else {
        showErrorToast(error, "Failed to duplicate dashboard");
      }
      return;
    }
    toast.success("Dashboard duplicated");
    if (activeRequest.current !== request) {
      return;
    }
    activeRequest.current = null;
    onClose();
    confirmNavigation(() =>
      router.push(`/dashboard/${encodeURIComponent(created.dashboard_name)}`)
    );
  };

  return (
    <Modal
      isOpen={source !== null}
      onClose={dismiss}
      title="Duplicate dashboard"
      className="w-[480px]"
      data-cy="dashboard-duplicate-modal"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-gray-500">
          Make a copy of{" "}
          <span className="font-semibold text-gray-900">{sourceName}</span>.
        </p>
        <div className="flex flex-col gap-1">
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-gray-700"
          >
            Name
          </label>
          <TextInput
            id={inputId}
            value={name}
            onValueChange={(value) => {
              setName(value);
              setServerError(null);
            }}
            error={!!nameError}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? errorId : undefined}
            data-autofocus
            data-cy="dashboard-duplicate-name-input"
          />
          {nameError && (
            <p
              id={errorId}
              role="alert"
              className="text-sm text-red-500"
              data-cy="dashboard-duplicate-name-error"
            >
              {nameError}
            </p>
          )}
        </div>
        <div className="flex gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
          <InformationCircleIcon
            className="h-5 w-5 shrink-0 text-gray-400"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-1">
            <p>
              Widgets, layout, appearance and uploaded images are copied. The
              original dashboard isn&apos;t changed.
            </p>
            {showUnsavedNote && (
              <p
                className="font-medium text-gray-700"
                data-cy="dashboard-duplicate-unsaved-note"
              >
                Unsaved changes aren&apos;t included in the copy.
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            color="orange"
            onClick={dismiss}
            data-cy="dashboard-duplicate-cancel-btn"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            color="orange"
            loading={pending}
            disabled={!canSubmit}
            data-cy="dashboard-duplicate-submit-btn"
          >
            Duplicate
          </Button>
        </div>
      </form>
    </Modal>
  );
}
