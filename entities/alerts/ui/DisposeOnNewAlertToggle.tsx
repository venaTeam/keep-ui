import { Button } from "@tremor/react";

export const DEFAULT_DISPOSE_ON_NEW_ALERT = false;

interface DisposeOnNewAlertToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  entityLabel: string; // e.g. "dismissal", "status", "assignment"
  className?: string;
  "data-cy"?: string;
}

export function DisposeOnNewAlertToggle({
  value,
  onChange,
  entityLabel,
  className,
  "data-cy": dataCy,
}: DisposeOnNewAlertToggleProps) {
  return (
    <Button
      variant={value ? "primary" : "secondary"}
      size="xs"
      className={className}
      onClick={() => onChange(!value)}
      tooltip={
        value
          ? `Dispose the ${entityLabel} when a new alert comes in.`
          : `Keep the ${entityLabel} when a new alert comes in.`
      }
      data-cy={dataCy}
    >
      {value ? "Disposing on new alerts" : "Keeping on new alerts"}
    </Button>
  );
}
