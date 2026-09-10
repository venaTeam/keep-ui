import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import { Button, Textarea } from "@tremor/react";
import QueryBuilder, {
  defaultOperators,
  Field,
  formatQuery,
  Operator,
  RuleGroupType,
} from "react-querybuilder";
import { parseCEL } from "react-querybuilder/parseCEL";
import { parseSQL } from "react-querybuilder/parseSQL";
import "react-querybuilder/dist/query-builder.scss";
import { Table } from "@tanstack/react-table";
import { FiExternalLink, FiSave } from "react-icons/fi";
import { AlertDto } from "@/entities/alerts/model";
import { TrashIcon } from "@heroicons/react/24/outline";
import { TbDatabaseImport } from "react-icons/tb";
import { components, GroupBase, MenuListProps } from "react-select";
import { Select } from "@/shared/ui";
import { useConfig } from "@/utils/hooks/useConfig";
import { IoSearchOutline } from "react-icons/io5";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import { CornerDownLeft } from "lucide-react";
import { STATIC_PRESETS_NAMES } from "@/entities/presets/model/constants";
import { Preset } from "@/entities/presets/model/types";
import { usePresetActions } from "@/entities/presets/model/usePresetActions";
import CelInput from "@/features/cel-input/cel-input";
import { useFacetPotentialFields } from "@/features/filter";
import { useCelState } from "@/features/cel-input/use-cel-state";
import {
  INVALID_CEL_MESSAGE,
  type CelValidationContext,
  type CelValidationResponse,
} from "@/shared/ui/MonacoCELEditor/cel-validation";
import type { UseCelValidationResult } from "@/shared/ui/MonacoCELEditor/validation-hook";

const staticOptions = [
  { value: 'severity > "info"', label: 'severity > "info"' },
  { value: 'status=="firing"', label: 'status == "firing"' },
  { value: 'source=="grafana"', label: 'source == "grafana"' },
  {
    value: 'description.contains("CPU")',
    label: 'description.contains("CPU")',
  },
];

const CustomOption = (props: any) => {
  return (
    <components.Option {...props}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <IoSearchOutline style={{ marginRight: "8px" }} />
        {props.children}
      </div>
    </components.Option>
  );
};

const kbdStyle = {
  background: "#eee",
  borderRadius: "3px",
  padding: "2px 4px",
  margin: "0 2px",
  fontWeight: "bold",
};

// Define an interface for the custom props
interface CustomMenuListProps
  extends MenuListProps<any, boolean, GroupBase<any>> {
  docsUrl: string;
}

// Custom MenuList with a static line at the end
const CustomMenuList = (props: CustomMenuListProps) => {
  const { docsUrl, ...menuListProps } = props;

  return (
    <components.MenuList {...menuListProps}>
      {props.children}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px",
          background: "lightgray",
          color: "black",
          fontSize: "0.9em",
          borderTop: "1px solid #ddd",
        }}
      >
        <span>
          Wildcard: <kbd style={kbdStyle}>source.contains(&quot;&quot;)</kbd>
        </span>
        <span>
          OR: <kbd style={kbdStyle}> || </kbd>
        </span>
        <span>
          AND: <kbd style={kbdStyle}> && </kbd>
        </span>
        <span>
          <kbd style={kbdStyle}>Enter</kbd> to update query
        </span>
        <a
          href={`${docsUrl}/overview/cel`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            textDecoration: "none",
            color: "black",
            display: "flex",
            alignItems: "center",
          }}
        >
          See Syntax Documentation{" "}
          <FiExternalLink style={{ marginLeft: "5px" }} />
        </a>
      </div>
    </components.MenuList>
  );
};

const customComponents = {
  Control: () => null, // This hides the input field control
  DropdownIndicator: null, // Optionally, hides the dropdown indicator if desired
  IndicatorSeparator: null,
  Option: CustomOption,
  MenuList: CustomMenuList,
};

const getOperators = (id: string): Operator[] => {
  if (id === "source") {
    return [
      { name: "contains", label: "contains" },
      { name: "null", label: "null" },
    ];
  }

  return defaultOperators;
};

type AlertsRulesBuilderProps = {
  table?: Table<AlertDto>;
  selectedPreset?: Preset;
  defaultQuery: string | undefined;
  celValue?: string | null;
  setIsModalOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  setPresetCEL?: React.Dispatch<React.SetStateAction<string>>;
  updateOutputCEL?: React.Dispatch<React.SetStateAction<string>>;
  onCelChanges?: (cel: string) => void;
  showSqlImport?: boolean;
  customFields?: Field[];
  showSave?: boolean;
  minimal?: boolean;
  showToast?: boolean;
  shouldSetQueryParam?: boolean;
  applyOnTyping?: boolean;
  /** Which execution engine the expression is validated against. */
  validationContext?: CelValidationContext;
  /** The applied CEL was rejected by the query API with INVALID_CEL. */
  isCelRejected?: boolean;
  /**
   * Server-backed validation state for the current draft, so a parent form can
   * gate its own submit on it. "unchecked", "validating" and "failed" are all
   * distinct from "invalid" and none of them mean valid.
   */
  onValidationStateChange?: (state: UseCelValidationResult) => void;
};

/**
 * An apply/save attempt for one exact draft.
 *
 * "pending" is not a verdict - the draft is neither valid nor invalid while a
 * check is in flight. "failed" means the check itself could not be completed,
 * which leaves validity unknown.
 */
type CelAttempt = {
  cel: string;
  status: "pending" | "rejected" | "failed";
};

const SQL_QUERY_PLACEHOLDER = `SELECT *
FROM alerts
WHERE severity = 'critical' and status = 'firing'`;

const constructCELRules = (preset?: Preset) => {
  // Check if selectedPreset is defined and has options
  if (preset && preset.options) {
    // New version: single "CEL" key
    const celOption = preset.options.find((option) => option.label === "CEL");
    if (celOption) {
      return celOption.value;
    }
    // Older version: Concatenate multiple fields
    else {
      return preset.options
        .map((option) => {
          // Assuming the older format is exactly "x='y'" (x equals y)
          // We split the string by '=', then trim and quote the value part
          let [key, value] = option.value.split("=");
          // Trim spaces and single quotes (if any) from the value
          value = value.trim().replace(/^'(.*)'$/, "$1");
          // Return the correctly formatted CEL expression
          return `${key.trim()}=="${value}"`;
        })
        .join(" && ");
    }
  }
  return ""; // Default to empty string if no preset or options are found
};

export const AlertsRulesBuilder = ({
  table,
  selectedPreset,
  defaultQuery = "",
  celValue,
  setIsModalOpen,
  setPresetCEL,
  updateOutputCEL,
  customFields,
  showSqlImport = true,
  showSave = true,
  minimal = false,
  showToast = false,
  shouldSetQueryParam = true,
  onCelChanges,
  applyOnTyping = false,
  validationContext = "alerts",
  isCelRejected = false,
  onValidationStateChange,
}: AlertsRulesBuilderProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: config } = useConfig();

  const { deletePreset } = usePresetActions();

  const { data: alertFields } = useFacetPotentialFields("alerts");

  const [isGUIOpen, setIsGUIOpen] = useState(false);
  const [isImportSQLOpen, setImportSQLOpen] = useState(false);
  const [sqlQuery, setSQLQuery] = useState("");

  // If celValue is provided (from parent state), use it as the initial value
  // This ensures the CEL expression is preserved across component remounts
  const initialCel = celValue ?? constructCELRules(selectedPreset);

  const [appliedCel, setAppliedCel] = useCelState({
    enableQueryParams: shouldSetQueryParam,
    defaultCel: initialCel,
  });
  const [celRules, setCELRules] = useState(appliedCel);

  const parsedCELRulesToQuery = parseCEL(celRules);

  const isDynamic =
    selectedPreset && !STATIC_PRESETS_NAMES.includes(selectedPreset.name);

  const action = isDynamic ? "update" : "create";

  const [query, setQuery] = useState<RuleGroupType>(parsedCELRulesToQuery);
  /**
   * The backend decides CEL validity. This holds its verdict together with the
   * draft the verdict is about, so a late response can never be applied to a
   * newer draft.
   */
  const [validation, setValidation] = useState<UseCelValidationResult | null>(
    null
  );
  const [attempt, setAttempt] = useState<CelAttempt | null>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);

  const celRulesRef = useRef(celRules);
  celRulesRef.current = celRules;
  const validationRef = useRef(validation);
  validationRef.current = validation;
  const attemptRef = useRef(attempt);
  attemptRef.current = attempt;

  /** The server accepted this exact draft. Anything else is "not known valid". */
  const isDraftKnownValid =
    validation?.cel === celRules && validation.status === "valid";
  /** A rejection describes the applied expression; editing it ends its claim. */
  const isAppliedCelRejected = isCelRejected && celRules === appliedCel;
  const isAttemptRejected =
    attempt?.status === "rejected" && attempt.cel === celRules;
  const isAttemptPending =
    attempt?.status === "pending" && attempt.cel === celRules;
  const hasValidationServiceFailed =
    (attempt?.status === "failed" && attempt.cel === celRules) ||
    (validation?.cel === celRules && validation.status === "failed");

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const isFirstRender = useRef(true);

  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleClearInput = useCallback(() => {
    setCELRules("");
    setAppliedCel("");
    onCelChanges && onCelChanges("");
    table?.resetGlobalFilter();
    setAttempt(null);
  }, [table]);

  const handleCelRulesChange = (cel: string) => {
    setCELRules(cel);
    /**
     * Typing invalidates the previous attempt: its diagnostics described text
     * that no longer exists, and its response must not apply the older draft.
     * The already-applied search is left untouched.
     */
    setAttempt(null);
  };

  const handleValidationChange = useCallback(
    (state: UseCelValidationResult) => {
      setValidation(state);
      onValidationStateChange?.(state);
    },
    [onValidationStateChange]
  );

  const toggleSuggestions = () => {
    setShowSuggestions(!showSuggestions);
  };

  const handleSelectChange = (selectedOption: any) => {
    handleCelRulesChange(selectedOption.value);
    toggleSuggestions();
  };

  useEffect(() => {
    function handleClickOutside(event: any) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Adjust the height of the textarea based on its content
  const adjustTextAreaHeight = () => {
    const textArea = textAreaRef.current;
    if (textArea) {
      textArea.style.height = "auto";
      textArea.style.height = `${textArea.scrollHeight}px`;
    }
  };
  // Adjust the height whenever the content changes
  useEffect(() => {
    adjustTextAreaHeight();
  }, [celRules]);

  const applyCel = useCallback(
    (cel: string) => {
      setAppliedCel(cel);
      if (showToast)
        toast.success("Condition applied", { position: "top-right" });
    },
    [setAppliedCel, showToast]
  );

  /**
   * Apply `cel`, but only once the server has accepted that exact draft.
   *
   * Background validation is debounced, so on Enter the draft may have no
   * verdict yet. Rather than guessing, ask immediately and wait. A pending
   * attempt is neither valid nor invalid, and the applied filter and its
   * results stay put until a verdict arrives.
   */
  const submitCel = useCallback(
    async (cel: string) => {
      // One apply at a time - a second Enter must not fire a duplicate request.
      if (attemptRef.current?.status === "pending") {
        return;
      }

      // An empty search is not a filter, so there is nothing to check.
      if (!cel) {
        setAttempt(null);
        applyCel(cel);
        return;
      }

      const validator = validationRef.current;

      if (validator?.cel === cel && validator.status === "valid") {
        setAttempt(null);
        applyCel(cel);
        return;
      }

      if (!validator) {
        // No way to check this draft, so its validity is unknown - which is not
        // permission to apply it.
        setAttempt({ cel, status: "failed" });
        return;
      }

      setAttempt({ cel, status: "pending" });

      let result: CelValidationResponse;

      try {
        result = await validator.validateNow(cel);
      } catch (error) {
        // The check could not be completed, so validity is unknown. Do not
        // apply, and do not claim the expression is invalid.
        if (celRulesRef.current === cel) {
          setAttempt({ cel, status: "failed" });
        }
        return;
      }

      // The user edited while we waited: this answer is about an older draft.
      if (celRulesRef.current !== cel) {
        return;
      }

      if (result.valid) {
        setAttempt(null);
        applyCel(cel);
        return;
      }

      setAttempt({ cel, status: "rejected" });
    },
    [applyCel]
  );

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault(); // Prevents the default action of Enter key in a form
      // close the menu
      setShowSuggestions(false);
      void submitCel(celRulesRef.current);
    }
  };

  useEffect(() => {
    updateOutputCEL?.(appliedCel);
    onCelChanges?.(appliedCel);
  }, [appliedCel, updateOutputCEL]);

  // When applyOnTyping is enabled, auto-apply the draft once the server has
  // accepted it, and clear it otherwise so the parent form cannot submit an
  // expression that is unchecked, still being checked, rejected, or unverifiable.
  useEffect(() => {
    if (!applyOnTyping) {
      return;
    }

    setAppliedCel(isDraftKnownValid ? celRules : "");
  }, [applyOnTyping, celRules, isDraftKnownValid]);

  const onGenerateQuery = () => {
    setCELRules(formatQuery(query, "cel"));
    setIsGUIOpen(false);
  };

  const fields: Field[] = table
    ? table
      .getAllColumns()
      .filter(({ getIsPinned }) => getIsPinned() === false)
      .map(({ id, columnDef }) => ({
        name: id,
        label: columnDef.header as string,
        operators: getOperators(id),
      }))
    : customFields
      ? customFields
      : [];

  const onImportSQL = () => {
    setImportSQLOpen(true);
  };

  const convertSQLToCEL = (sql: string): string | null => {
    try {
      const query = parseSQL(sql);
      // Validate the parsed query
      if (!query || !query.rules || query.rules.length === 0) {
        throw new Error("Invalid SQL query: No rules generated.");
      }
      const formattedCel = formatQuery(query, "cel");
      return formatQuery(parseCEL(formattedCel), "cel");
    } catch (error) {
      // If the caught error is an instance of Error, use its message
      if (error instanceof Error) {
        setSqlError(error.message);
      } else {
        setSqlError("An unknown error occurred while parsing SQL.");
      }
      return null;
    }
  };

  const onImportSQLSubmit = () => {
    const convertedCEL = convertSQLToCEL(sqlQuery);
    if (convertedCEL) {
      setCELRules(convertedCEL); // Set the converted CEL as the new CEL rules
      setImportSQLOpen(false); // Close the modal
      setSqlError(null); // Clear any previous errors
    }
  };

  const openSaveModal = (celExpression: string) => {
    setPresetCEL?.(celExpression);
    setIsModalOpen?.(true);
  };

  /**
   * Saving requires a server verdict for the exact expression being saved. A
   * query rejection also disqualifies it, until the user edits the text.
   */
  const isCelUsable = isDraftKnownValid && !isAppliedCelRejected;

  /**
   * The prominent message is deferred until the user tries to apply, so typing
   * an incomplete expression does not shout at them. Forms that apply on typing
   * have no separate apply step, so their verdict shows as soon as it lands.
   */
  const showCelError = applyOnTyping
    ? validation?.cel === celRules && validation.status === "invalid"
    : isAttemptRejected || isAppliedCelRejected;

  function getSaveFilterTooltipText(): string {
    if (hasValidationServiceFailed) {
      return "Could not check this expression. Try again before saving.";
    }

    if (!isCelUsable) {
      return "You can only save a valid CEL expression.";
    }

    return action === "update"
      ? "Edit preset"
      : "Save current filter as a preset";
  }

  return (
    <>
      <div className="flex flex-col gap-y-2 w-full justify-end">
        {/* Docs */}
        <div className="flex flex-wrap items-start gap-x-2">
          <div className="flex flex-1 min-w-0 gap-2 items-center relative">
            {/* Textarea and error message container */}
            <div className="flex-grow relative" ref={wrapperRef}>
              <div className="relative">
                <CelInput
                  id="alerts-cel-input"
                  placeholder='Use CEL to filter your alerts e.g. source.contains("kibana").'
                  value={celRules}
                  fieldsForSuggestions={alertFields}
                  validationContext={validationContext}
                  onValueChange={handleCelRulesChange}
                  onValidationChange={handleValidationChange}
                  onClearValue={handleClearInput}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setShowSuggestions(true)}
                />
              </div>
              {showSuggestions && (
                <div className="absolute z-10 w-full">
                  <Select
                    options={staticOptions}
                    onChange={handleSelectChange}
                    menuIsOpen={true}
                    components={
                      minimal
                        ? undefined
                        : {
                          ...customComponents,
                          MenuList: (props) => (
                            <CustomMenuList
                              {...props}
                              docsUrl={
                                config?.KEEP_DOCS_URL ||
                                "https://docs.keephq.dev"
                              }
                            />
                          ),
                        }
                    }
                    onBlur={() => setShowSuggestions(false)}
                  />
                </div>
              )}
              {showCelError && (
                <div
                  className="text-red-500 text-sm relative top-1"
                  data-cy="cel-error"
                  data-testid="cel-error"
                >
                  {INVALID_CEL_MESSAGE}
                </div>
              )}
              {!showCelError && hasValidationServiceFailed && (
                <div
                  className="text-red-500 text-sm relative top-1"
                  data-cy="cel-validation-unavailable"
                  data-testid="cel-validation-unavailable"
                >
                  Could not check this expression. Press Enter to try again.
                </div>
              )}
              {!applyOnTyping && (
                <div className="flex items-center justify-end pt-1 px-2">
                  <span className="text-xs text-gray-400">
                    <CornerDownLeft className="h-3 w-3 mr-1 inline-block" />
                    Enter to apply
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Buttons next to the Textarea */}
          {showSave && (
            <Button
              data-testid="save-preset-button"
              data-cy="save-preset-button"
              icon={FiSave}
              color="orange"
              variant="secondary"
              size="sm"
              disabled={!celRules.length || !isCelUsable || isAttemptPending}
              onClick={() => openSaveModal(celRules)}
              tooltip={getSaveFilterTooltipText()}
            ></Button>
          )}
          {showSqlImport && (
            <Button
              color="orange"
              variant="secondary"
              type="button"
              onClick={onImportSQL}
              icon={TbDatabaseImport}
              size="sm"
              tooltip="Import from SQL"
              data-cy="preset-import-sql-btn"
            ></Button>
          )}
          {isDynamic && (
            <Button
              icon={TrashIcon}
              variant="secondary"
              color="red"
              title="Delete preset"
              onClick={() =>
                deletePreset(selectedPreset!.id!, selectedPreset!.name).then(
                  () => {
                    router.push("/alerts/feed");
                  }
                )
              }
              data-cy="preset-delete-btn"
            ></Button>
          )}
        </div>
      </div>
      {/* Import SQL */}
      <Modal
        isOpen={isImportSQLOpen}
        onClose={() => {
          setImportSQLOpen(false);
          setSqlError(null);
        }} // Clear the error when closing the modal
        title="Import from SQL"
        data-cy="preset-import-sql-modal"
      >
        <div className="space-y-4 pt-4">
          <Textarea
            className="min-h-[8em] h-auto" // This sets a minimum height and allows it to auto-adjust
            placeholder={SQL_QUERY_PLACEHOLDER}
            onValueChange={setSQLQuery}
          />
          {sqlError && (
            <div className="text-red-500 text-sm mb-2">Error: {sqlError}</div>
          )}
          <div className="flex justify-end">
            <Button
              color="orange"
              onClick={onImportSQLSubmit}
              disabled={!(sqlQuery.length > 0)}
              data-cy="preset-import-sql-submit-btn"
            >
              Convert to CEL
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isGUIOpen}
        onClose={() => setIsGUIOpen(false)}
        className="w-[50%] max-w-screen-2xl max-h-[710px] transform overflow-auto ring-tremor bg-white p-6 text-left align-middle shadow-tremor transition-all rounded-xl"
        title="Query Builder"
        data-cy="preset-query-builder-modal"
      >
        <div className="space-y-2 pt-4">
          <div className="max-h-96 overflow-auto">
            <QueryBuilder
              query={query}
              onQueryChange={(newQuery) => setQuery(newQuery)}
              fields={fields}
              addRuleToNewGroups
              showCombinatorsBetweenRules={false}
            />
          </div>
          <div className="inline-flex justify-end">
            <Button
              color="orange"
              onClick={onGenerateQuery}
              disabled={!query.rules.length}
              data-cy="preset-generate-query-btn"
            >
              Generate Query
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
