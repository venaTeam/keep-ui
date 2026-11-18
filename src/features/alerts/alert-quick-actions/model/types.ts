import { ComponentType, ElementType } from "react";
import { AlertDto } from "@/entities/alerts/model/types";

/** Props every quick-action dialog adapter receives. */
export interface QuickActionDialogProps {
  alerts: AlertDto[];
  presetName: string;
  onClose: () => void;
  onSuccess: () => void;
}

/** One quick action the Alert Table widget offers for an alert or a selection. */
export interface WidgetAlertAction {
  id: string;
  label: string;
  icon: ElementType;
  appliesTo: (alert: AlertDto) => boolean;
  bulk: boolean;
  partialLabel: (count: number) => string;
  Dialog: ComponentType<QuickActionDialogProps>;
}

/** The action whose dialog is open and the alerts it opened with. */
export interface OpenQuickAction {
  actionId: string;
  alerts: AlertDto[];
}

/** Opens a quick action's dialog for the given alerts; `opener` is the button a pointer pressed, or null for a keyboard press. */
export type OpenQuickActionHandler = (
  actionId: string,
  alerts: AlertDto[],
  opener: HTMLElement | null
) => void;
