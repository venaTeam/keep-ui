import React, {
  CSSProperties,
  ReactNode,
  RefObject,
  forwardRef,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { isEqual } from "lodash";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";
import {
  Announcements,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { FiSettings } from "react-icons/fi";
import { RxDragHandleDots2 } from "react-icons/rx";
import {
  ArrowsRightLeftIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  XMarkIcon,
} from "@heroicons/react/20/solid";
import { useFacetPotentialFields } from "@/features/filter/hooks";
import { getAutofitColumnWidth } from "@/widgets/alerts-table/lib/column-autofit";
import {
  COMMON_ENRICHMENT_FIELDS,
  getAlertColumnOptions,
  getColumnLabel,
} from "@/widgets/alerts-table/lib/alert-column-options";
import {
  EmptyGroupPosition,
  WIDGET_PINNED_LEFT,
  mergeVisibleColumnOrder,
  resolveFieldIds,
} from "./alert-table-widget-config";
import { GroupBySelect } from "./group-by-select";
import type { WidgetColumnState } from "./use-widget-column-state";

/** A visible column's current width and the range a width set for it is kept in, in pixels. */
export interface WidgetColumnWidth {
  width: number;
  min: number;
  max: number;
}

/** What the ⚙ panel needs to show and change column widths. */
export interface WidgetColumnWidths {
  /** The width and bounds of each visible column, by column id. */
  columns: Readonly<Record<string, WidgetColumnWidth>>;
  /** The widget's table element, which Auto-fit measures. */
  tableRef: RefObject<HTMLElement | null>;
}

interface WidgetTableSettingsProps {
  state: WidgetColumnState;
  columnIds: string[];
  columnWidths: WidgetColumnWidths;
  ungroupableColumnIds?: readonly string[];
}

const NO_FIELDS: string[] = [];
const NO_IDS: readonly string[] = [];
const EMPTY_GROUP_POSITIONS: { value: EmptyGroupPosition; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
];
const SECTION_TITLE_CLASS =
  "mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500";
const ICON_BUTTON_CLASS =
  "flex-none rounded p-0.5 text-gray-400 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300";
const TEXT_BUTTON_CLASS =
  "rounded px-1 py-0.5 text-orange-600 hover:bg-orange-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300";

const isPinned = (id: string) => WIDGET_PINNED_LEFT.includes(id);

const matches = (text: string, query: string) =>
  text.toLowerCase().includes(query.toLowerCase());

function useFieldOptions(columnIds: string[]): string[] {
  const { data } = useFacetPotentialFields("alerts");
  return useMemo(
    () =>
      getAlertColumnOptions(
        columnIds,
        resolveFieldIds(
          [...(data ?? NO_FIELDS), ...COMMON_ENRICHMENT_FIELDS],
          columnIds
        )
      ),
    [columnIds, data]
  );
}

function RenameInput({
  label,
  onCommit,
  onCancel,
}: {
  label: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(label);
  const settled = useRef(false);

  const settle = (action: () => void) => {
    if (!settled.current) {
      settled.current = true;
      action();
    }
  };

  return (
    <input
      autoFocus
      aria-label={`Name for ${label}`}
      value={name}
      onChange={(event) => setName(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={() => settle(() => onCommit(name))}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          settle(() => onCommit(name));
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          settle(onCancel);
        }
      }}
      className="min-w-0 flex-1 rounded border border-orange-300 px-1 py-0.5 text-xs outline-none focus:ring-1 focus:ring-orange-300"
    />
  );
}

function WidthInput({
  label,
  width,
  min,
  max,
  onCommit,
}: WidgetColumnWidth & {
  label: string;
  onCommit: (width: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const pending = useRef<string | null>(null);

  const edit = (text: string | null) => {
    pending.current = text;
    setDraft(text);
  };

  const commit = () => {
    const text = pending.current;
    edit(null);
    const value = Number(text);
    if (text === null || text.trim() === "" || !Number.isFinite(value)) {
      return;
    }
    onCommit(Math.round(Math.min(Math.max(value, min), max)));
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      autoFocus
      aria-label={`${label} width`}
      min={min}
      max={max}
      step={1}
      value={draft ?? String(width)}
      onChange={(event) => edit(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        } else if (event.key === "Escape" && pending.current !== null) {
          event.preventDefault();
          event.stopPropagation();
          edit(null);
        }
      }}
      className="w-16 rounded border border-gray-200 px-1 py-0.5 text-xs tabular-nums outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-300"
    />
  );
}

function ColumnWidthEditor({
  id,
  label,
  width,
  state,
  tableRef,
}: {
  id: string;
  label: string;
  width: WidgetColumnWidth;
  state: WidgetColumnState;
  tableRef: RefObject<HTMLElement | null>;
}) {
  const sizing = state.columnSizing;
  const saved = sizing[id];

  const save = (value: number) => {
    if (value !== saved) {
      state.setColumnSizing({ ...sizing, [id]: value });
    }
  };

  const autofit = () => {
    const measured = getAutofitColumnWidth(tableRef.current, id, {
      minSize: width.min,
      maxSize: width.max,
    });
    if (measured !== null) {
      save(measured);
    }
  };

  const reset = () => {
    const next = { ...sizing };
    delete next[id];
    state.setColumnSizing(next);
  };

  return (
    <div className="mb-0.5 mt-1 flex items-center gap-1.5 pl-6">
      <WidthInput label={label} {...width} onCommit={save} />
      <span className="text-gray-500">px</span>
      <button
        type="button"
        aria-label={`Auto-fit ${label}`}
        title="Fit the column to its content"
        className={TEXT_BUTTON_CLASS}
        onClick={autofit}
      >
        Auto-fit
      </button>
      {saved !== undefined && (
        <button
          type="button"
          aria-label={`Reset ${label} width`}
          title="Back to the default width"
          className={TEXT_BUTTON_CLASS}
          onClick={reset}
        >
          Reset
        </button>
      )}
    </div>
  );
}

interface ColumnRowProps {
  id: string;
  state: WidgetColumnState;
  isRenaming: boolean;
  onRenamingChange: (id: string | null) => void;
  width?: WidgetColumnWidth;
  tableRef: RefObject<HTMLElement | null>;
  isWidthOpen: boolean;
  onWidthOpenChange: (id: string | null) => void;
  handle?: ReactNode;
  style?: CSSProperties;
}

const ColumnRow = forwardRef<HTMLLIElement, ColumnRowProps>(function ColumnRow(
  {
    id,
    state,
    isRenaming,
    onRenamingChange,
    width,
    tableRef,
    isWidthOpen,
    onWidthOpenChange,
    handle,
    style,
  },
  ref
) {
  const renames = state.columnRenameMapping;
  const label = getColumnLabel(id, renames);
  const isRenamed = label !== getColumnLabel(id);
  const isVisible = !!state.columnVisibility[id];
  const widthControls = isVisible && !isPinned(id) ? width : undefined;

  const toggle = () =>
    state.setVisibleColumns(
      isVisible
        ? state.visibleColumns.filter((visibleId) => visibleId !== id)
        : [...state.visibleColumns, id]
    );

  const rename = (value: string) => {
    onRenamingChange(null);
    const name = value.trim();
    const mapping = { ...renames };
    if (name && name !== getColumnLabel(id)) {
      mapping[id] = name;
    } else {
      delete mapping[id];
    }
    if (!isEqual(mapping, renames)) {
      state.setColumnRenameMapping(mapping);
    }
  };

  return (
    <li
      ref={ref}
      style={style}
      className="rounded bg-white py-0.5"
      data-table-settings-column={id}
    >
      <div className="flex items-center gap-1.5">
        {handle ?? <span className="h-[18px] w-[18px] flex-none" />}
        {isRenaming ? (
          <RenameInput
            label={label}
            onCommit={rename}
            onCancel={() => onRenamingChange(null)}
          />
        ) : (
          <>
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={isVisible}
                onChange={toggle}
                className="flex-none rounded border-gray-300 text-orange-500 accent-orange-500 focus:ring-orange-300"
              />
              <span
                className={`truncate ${isVisible ? "text-gray-900" : "text-gray-500"}`}
              >
                {label}
                {isRenamed && (
                  <span className="ml-1 text-[10px] text-gray-400">({id})</span>
                )}
              </span>
            </label>
            {!isPinned(id) && (
              <button
                type="button"
                aria-label={`Rename ${label}`}
                title="Rename"
                className={ICON_BUTTON_CLASS}
                onClick={() => onRenamingChange(id)}
              >
                <PencilIcon className="h-3 w-3" />
              </button>
            )}
            {widthControls && (
              <button
                type="button"
                aria-label={`Edit ${label} width`}
                aria-expanded={isWidthOpen}
                title="Width"
                className={`${ICON_BUTTON_CLASS} ${isWidthOpen ? "!text-orange-600" : ""}`}
                onClick={() => onWidthOpenChange(isWidthOpen ? null : id)}
              >
                <ArrowsRightLeftIcon className="h-3 w-3" />
              </button>
            )}
          </>
        )}
      </div>
      {widthControls && isWidthOpen && (
        <ColumnWidthEditor
          id={id}
          label={label}
          width={widthControls}
          state={state}
          tableRef={tableRef}
        />
      )}
    </li>
  );
});

function SortableColumnRow(props: Omit<ColumnRowProps, "handle" | "style">) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.id });
  const label = getColumnLabel(props.id, props.state.columnRenameMapping);

  return (
    <ColumnRow
      {...props}
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        position: "relative",
        zIndex: isDragging ? 1 : undefined,
      }}
      handle={
        <button
          type="button"
          ref={setActivatorNodeRef}
          aria-label={`Reorder ${label}`}
          title="Drag to reorder"
          className={`${ICON_BUTTON_CLASS} cursor-grab touch-none active:cursor-grabbing`}
          {...attributes}
          {...listeners}
        >
          <RxDragHandleDots2 className="h-3.5 w-3.5" />
        </button>
      }
    />
  );
}

function ColumnList({
  state,
  columnWidths,
}: {
  state: WidgetColumnState;
  columnWidths: WidgetColumnWidths;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [widthOpen, setWidthOpen] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { columnOrder, columnVisibility, columnRenameMapping } = state;
  const pinned = WIDGET_PINNED_LEFT.filter((id) => columnVisibility[id]);
  const movable = columnOrder.filter(
    (id) => columnVisibility[id] && !isPinned(id)
  );
  const hidden = columnOrder.filter((id) => !columnVisibility[id]);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) {
      return;
    }
    const from = movable.indexOf(String(active.id));
    const to = movable.indexOf(String(over.id));
    if (from === -1 || to === -1) {
      return;
    }
    state.setColumnOrder(
      mergeVisibleColumnOrder(columnOrder, arrayMove(movable, from, to))
    );
  };

  const rowProps = (id: string) => ({
    id,
    state,
    isRenaming: renaming === id,
    onRenamingChange: setRenaming,
    width: columnWidths.columns[id],
    tableRef: columnWidths.tableRef,
    isWidthOpen: widthOpen === id,
    onWidthOpenChange: setWidthOpen,
  });

  const announcements = useMemo<Announcements>(() => {
    const labelOf = (id: string | number) =>
      getColumnLabel(String(id), columnRenameMapping);
    return {
      onDragStart: ({ active }) => `Picked up column ${labelOf(active.id)}.`,
      onDragOver: ({ active, over }) =>
        over
          ? `Column ${labelOf(active.id)} was moved over ${labelOf(over.id)}.`
          : `Column ${labelOf(active.id)} is no longer over a column.`,
      onDragEnd: ({ active, over }) =>
        over
          ? `Column ${labelOf(active.id)} was dropped over ${labelOf(over.id)}.`
          : `Column ${labelOf(active.id)} was dropped.`,
      onDragCancel: ({ active }) =>
        `Reordering was cancelled. Column ${labelOf(active.id)} was dropped.`,
    };
  }, [columnRenameMapping]);

  return (
    <div className="max-h-56 overflow-y-auto pr-1">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
        accessibility={{ announcements }}
      >
        <SortableContext items={movable} strategy={verticalListSortingStrategy}>
          <ul aria-label="Columns">
            {pinned.map((id) => (
              <ColumnRow key={id} {...rowProps(id)} />
            ))}
            {movable.map((id) => (
              <SortableColumnRow key={id} {...rowProps(id)} />
            ))}
            {hidden.map((id) => (
              <ColumnRow key={id} {...rowProps(id)} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function AddColumnSearch({
  state,
  fieldOptions,
}: {
  state: WidgetColumnState;
  fieldOptions: string[];
}) {
  const [query, setQuery] = useState("");
  const search = query.trim();
  const results = search
    ? fieldOptions.filter(
        (id) => !state.columnVisibility[id] && matches(id, search)
      )
    : [];

  const add = (id: string) => {
    state.setVisibleColumns([...state.visibleColumns, id]);
    setQuery("");
  };

  return (
    <div className="mt-1">
      <div className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          aria-label="Find a field"
          placeholder="Find a field…"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full rounded border border-gray-200 py-1 pl-6 pr-2 text-xs outline-none placeholder:text-gray-400 focus:border-orange-300 focus:ring-1 focus:ring-orange-300"
        />
      </div>
      {search && results.length > 0 && (
        <ul
          aria-label="Matching fields"
          className="mt-1 max-h-32 overflow-y-auto rounded border border-gray-200"
        >
          {results.map((id) => (
            <li key={id}>
              <button
                type="button"
                className="block w-full truncate px-2 py-1 text-left hover:bg-orange-50 focus:bg-orange-50 focus:outline-none"
                onClick={() => add(id)}
              >
                {id}
              </button>
            </li>
          ))}
        </ul>
      )}
      {search && results.length === 0 && (
        <p className="mt-1 px-2 py-1 text-gray-500">No matching fields</p>
      )}
    </div>
  );
}

function EmptyGroupPositionSetting({ state }: { state: WidgetColumnState }) {
  const name = useId();

  return (
    <fieldset>
      <legend className={SECTION_TITLE_CLASS}>Rows with no value</legend>
      <div className="flex gap-3">
        {EMPTY_GROUP_POSITIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-1"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={state.emptyGroupPosition === option.value}
              onChange={() => state.setEmptyGroupPosition(option.value)}
              className="border-gray-300 text-orange-500 accent-orange-500 focus:ring-orange-300"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SettingsContent({
  state,
  columnIds,
  columnWidths,
  ungroupableColumnIds,
  onClose,
}: Required<WidgetTableSettingsProps> & { onClose: () => void }) {
  const fieldOptions = useFieldOptions(columnIds);
  const groupOptions = useMemo(
    () => fieldOptions.filter((id) => !ungroupableColumnIds.includes(id)),
    [fieldOptions, ungroupableColumnIds]
  );
  const groupBy = state.grouping[0] ?? null;

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">
          Table settings
        </span>
        <button
          type="button"
          aria-label="Close table settings"
          className={ICON_BUTTON_CLASS}
          onClick={onClose}
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
      <h5 className={SECTION_TITLE_CLASS}>Columns</h5>
      <ColumnList state={state} columnWidths={columnWidths} />
      <AddColumnSearch state={state} fieldOptions={fieldOptions} />
      <h5 className={SECTION_TITLE_CLASS}>Group rows by</h5>
      <GroupBySelect
        value={groupBy}
        onChange={(value) => state.setGrouping(value ? [value] : [])}
        fieldOptions={groupOptions}
        data-cy="dashboard-widget-table-settings-group-by"
      />
      {groupBy && <EmptyGroupPositionSetting state={state} />}
      <div className="mt-3 flex items-center gap-2 border-t border-gray-200 pt-2">
        {state.isCustomized && (
          <span className="text-gray-500">Customized for this widget</span>
        )}
        <button
          type="button"
          disabled={!state.isCustomized}
          onClick={() => state.reset()}
          className="ml-auto text-orange-600 hover:underline disabled:cursor-not-allowed disabled:text-gray-300 disabled:no-underline"
        >
          Reset to defaults
        </button>
      </div>
    </>
  );
}

/**
 * The ⚙ button and "Table settings" popover of an Alert Table widget.
 *
 * The popover lists the visible columns in display order, then the hidden
 * ones. Each has a checkbox; all but the pinned icon columns can be renamed,
 * and the visible ones can be dragged (or moved with the keyboard) to reorder.
 * A reorder only moves visible columns, so hidden ones keep their saved
 * places. Each visible, unpinned column also has a width editor, opened from
 * its row one at a time: a pixel input that shows the current width and
 * saves on Enter or blur, kept within the column's bounds; Auto-fit, which
 * measures `columnWidths.tableRef`; and, once a width is saved, Reset. A
 * search adds any alert field as a column. It also sets the grouping, where
 * rows with no value go, and resets the widget to the defaults. Every change
 * goes straight to `state`; a width change passes the whole sizing map.
 *
 * `columnIds` are the columns the widget can show; `ungroupableColumnIds` are
 * left out of the grouping options. The popover is a dialog named "Table
 * settings", rendered in a portal so the dashboard grid cannot clip or cover
 * it. Reorder announcements read the columns' labels, not their ids.
 */
export function WidgetTableSettings({
  state,
  columnIds,
  columnWidths,
  ungroupableColumnIds = NO_IDS,
}: WidgetTableSettingsProps) {
  const { refs, floatingStyles } = useFloating({
    strategy: "fixed",
    placement: "bottom-end",
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  return (
    <Popover className="flex">
      <PopoverButton
        ref={refs.setReference}
        aria-label="Table settings"
        title="Table settings"
        className="inline-flex items-center justify-center rounded-tremor-small border border-tremor-border bg-white p-2 text-gray-600 shadow-tremor-input hover:bg-tremor-background-muted hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 data-[open]:border-orange-500 data-[open]:bg-orange-50 data-[open]:text-orange-600"
        data-cy="dashboard-widget-table-settings-btn"
      >
        <FiSettings className="h-4 w-4" />
      </PopoverButton>
      <PopoverPanel
        portal
        role="dialog"
        aria-label="Table settings"
        ref={refs.setFloating}
        style={floatingStyles}
        className="z-50 max-h-[85vh] w-72 overflow-y-auto rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-900 shadow-xl"
        data-cy="dashboard-widget-table-settings"
      >
        {({ close }) => (
          <SettingsContent
            state={state}
            columnIds={columnIds}
            columnWidths={columnWidths}
            ungroupableColumnIds={ungroupableColumnIds}
            onClose={close}
          />
        )}
      </PopoverPanel>
    </Popover>
  );
}
