import { WidgetType } from "../types";

/** Widget types whose body is an iframe or image: only their title follows typography. */
export const TITLE_ONLY_TYPES: ReadonlySet<WidgetType> = new Set<WidgetType>([
  WidgetType.IMAGE,
  WidgetType.HTML,
  WidgetType.GRAFANA_PANEL,
]);
