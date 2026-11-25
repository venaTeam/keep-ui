import { MdMenuBook, MdOpenInNew } from "react-icons/md";
import "./alert-link-icon-cell.css";
import clsx from "clsx";
import { Tooltip } from "@/shared/ui";
import {
  isGrafanaRuleUrl,
  LinkIconColumnId,
} from "@/widgets/alerts-table/lib/alert-link-columns";

/**
 * Icon link for a rule or runbook URL: the Grafana logo for a Grafana alert
 * rule, a generic external-link icon for any other rule, and a book for a
 * runbook. When disabled the icon is dimmed and does not navigate. The
 * tooltip stacks at z-60, above the presets page's z-10 CEL search bar layer,
 * and never catches the pointer, so moving down the icon column reaches the
 * next row's icon even where the tooltip opens below: its content is
 * `pointer-events-none`, and `alert-link-icon-cell.css` makes Radix's floating
 * wrapper around the `alert-link-tooltip` content pointer-transparent as well.
 */
export function AlertLinkIconCell({
  columnId,
  url,
  disabled = false,
}: {
  columnId: LinkIconColumnId;
  url: string;
  disabled?: boolean;
}) {
  const isGrafana = columnId === "alert_rule_url" && isGrafanaRuleUrl(url);
  const action =
    columnId === "runbook_url"
      ? "Open runbook"
      : isGrafana
        ? "Open alert rule in Grafana"
        : "Open alert rule";

  const icon =
    columnId === "runbook_url" ? (
      <MdMenuBook className="size-4" aria-hidden="true" />
    ) : isGrafana ? (
      <img src="/icons/grafana-icon.png" alt="" width={16} height={16} />
    ) : (
      <MdOpenInNew className="size-4" aria-hidden="true" />
    );

  const hitArea =
    "inline-flex items-center justify-center size-6 rounded text-blue-600";

  return (
    <Tooltip
      asChild
      className="alert-link-tooltip pointer-events-none z-60"
      content={
        <>
          <div className="font-semibold">{action}</div>
          <div className="break-all font-mono text-xs">{url}</div>
        </>
      }
    >
      {disabled ? (
        <span
          aria-disabled="true"
          aria-label={action}
          data-cy={`alert-link-icon-${columnId}`}
          className={clsx(hitArea, "opacity-45 cursor-not-allowed")}
        >
          {icon}
        </span>
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={action}
          data-cy={`alert-link-icon-${columnId}`}
          onClick={(e) => e.stopPropagation()}
          className={clsx(hitArea, "hover:bg-blue-50")}
        >
          {icon}
        </a>
      )}
    </Tooltip>
  );
}
