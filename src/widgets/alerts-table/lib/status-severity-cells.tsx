import clsx from "clsx";
import { BellAlertIcon } from "@heroicons/react/24/outline";
import { severityMapping } from "@/entities/alerts/model";
import { getStatusColor, getStatusIcon } from "@/shared/lib/status-utils";
import { capitalize } from "@/utils/helpers";

type CellSize = "xs" | "sm";

interface SeverityClasses {
  square: string;
  badge: string;
}

const SEVERITY_CLASSES: Record<string, SeverityClasses> = {
  critical: { square: "bg-red-500", badge: "bg-red-100 text-red-800" },
  high: { square: "bg-orange-500", badge: "bg-orange-100 text-orange-800" },
  error: { square: "bg-orange-500", badge: "bg-orange-100 text-orange-800" },
  warning: { square: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-800" },
  low: { square: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-800" },
  info: { square: "bg-blue-500", badge: "bg-blue-100 text-blue-800" },
};

const UNKNOWN_SEVERITY_CLASSES: SeverityClasses = {
  square: "bg-gray-400",
  badge: "bg-gray-100 text-gray-800",
};

const STATUS_ICON_CLASS: Record<string, string> = {
  red: "text-red-600",
  green: "text-green-600",
  purple: "text-purple-600",
};

const BADGE_SIZE: Record<CellSize, { badge: string; square: string }> = {
  xs: { badge: "h-5 px-1.5 text-[11px]", square: "h-1.5 w-1.5" },
  sm: { badge: "h-[22px] px-2 text-xs", square: "h-2 w-2" },
};

const PILL_SIZE: Record<
  CellSize,
  { pill: string; label: string; icon: string; noisy: string; bell: string }
> = {
  xs: {
    pill: "h-5 text-[11px]",
    label: "gap-1 pl-1.5 pr-2",
    icon: "h-3.5 w-3.5",
    noisy: "gap-0.5 pl-1.5 pr-2",
    bell: "h-3 w-3",
  },
  sm: {
    pill: "h-[22px] text-xs",
    label: "gap-1 pl-1.5 pr-2.5",
    icon: "h-4 w-4",
    noisy: "gap-1 pl-2 pr-2.5",
    bell: "h-3.5 w-3.5",
  },
};

/**
 * Normalizes an alert severity to a lower-case name.
 *
 * Numbers and numeric strings are mapped through `severityMapping`
 * (5 → "critical"); other strings are trimmed and lower-cased.
 *
 * @returns the severity name, or `undefined` when there is none
 */
export function normalizeSeverity(severity: unknown): string | undefined {
  if (severity === undefined || severity === null) {
    return undefined;
  }
  const raw = String(severity).trim();
  if (!raw) {
    return undefined;
  }
  const numeric = Number(raw);
  if (Number.isInteger(numeric) && severityMapping[numeric]) {
    return severityMapping[numeric];
  }
  return raw.toLowerCase();
}

/**
 * Whether this alert is one that makes its preset's alarm ring right now.
 *
 * Mirrors `NOISE_BASE_CEL` in
 * `src/features/presets/custom-preset-links/ui/PresetsNoise.tsx`
 * (`status == 'firing' && deleted == false && severity == 'critical'`, armed
 * only for noisy presets). Change both together. The alert's own `isNoisy`
 * flag and `NOISY_ALERTS_ENABLED` are deliberately not consulted, because the
 * sound does not consult them either.
 */
export function isAlertRingingNow(
  alert: { status?: string; severity?: unknown; deleted?: boolean },
  presetNoisy: boolean
): boolean {
  return (
    presetNoisy &&
    alert.status?.toLowerCase() === "firing" &&
    normalizeSeverity(alert.severity) === "critical" &&
    !alert.deleted
  );
}

/**
 * Severity as a word on a light tint of the severity color, so it never
 * depends on color alone. Unknown values keep their own text in gray.
 */
export function AlertSeverityBadge({
  severity,
  size = "xs",
}: {
  severity: unknown;
  size?: CellSize;
}) {
  const name = normalizeSeverity(severity);
  if (!name) {
    return null;
  }
  const classes = SEVERITY_CLASSES[name] ?? UNKNOWN_SEVERITY_CLASSES;
  const sizing = BADGE_SIZE[size];

  return (
    <span
      data-testid="alert-severity-badge"
      className={clsx(
        "inline-flex items-center gap-1.5 rounded font-semibold whitespace-nowrap",
        sizing.badge,
        classes.badge
      )}
    >
      <span
        aria-hidden="true"
        className={clsx("rounded-sm shrink-0", sizing.square, classes.square)}
      />
      {capitalize(name)}
    </span>
  );
}

/**
 * Status as a neutral pill with the status icon and its word. When `noisy`,
 * a dark "Noisy" segment is attached so the state reads by word and shape.
 */
export function AlertStatusPill({
  status,
  noisy = false,
  size = "xs",
}: {
  status?: string;
  noisy?: boolean;
  size?: CellSize;
}) {
  if (!status) {
    return null;
  }
  const StatusIcon = getStatusIcon(status);
  const iconColor = STATUS_ICON_CLASS[getStatusColor(status)] ?? "text-gray-600";
  const sizing = PILL_SIZE[size];

  return (
    <span
      data-testid="alert-status-pill"
      className={clsx(
        "inline-flex items-stretch rounded-full border border-gray-300 bg-white overflow-hidden whitespace-nowrap box-border",
        sizing.pill
      )}
    >
      <span
        className={clsx(
          "inline-flex items-center font-medium text-gray-800",
          sizing.label
        )}
      >
        <StatusIcon
          aria-hidden="true"
          className={clsx("shrink-0", sizing.icon, iconColor)}
        />
        {capitalize(status.toLowerCase())}
      </span>
      {noisy && (
        <span
          data-testid="alert-noisy-segment"
          className={clsx(
            "inline-flex items-center bg-gray-900 text-white font-semibold",
            sizing.noisy
          )}
        >
          <BellAlertIcon
            aria-hidden="true"
            className={clsx("shrink-0", sizing.bell)}
          />
          Noisy
        </span>
      )}
    </span>
  );
}
