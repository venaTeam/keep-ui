import { AlertDto, AlertKnownKeys } from "@/entities/alerts/model/types";

/**
 * Field keys of the given alerts that the alerts table has no fixed column
 * for, sorted and de-duplicated. An object-valued field contributes one
 * dotted key per sub-key (`labels.team`) instead of its own key.
 *
 * A list is an object too, so by default a list field contributes one key
 * per item (`enriched_fields.0`), which saved presets-page column configs
 * may reference. With `arraysAsLeaves` a list field contributes its own key.
 */
export function getAdditionalColsToGenerate(
  alerts: AlertDto[],
  { arraysAsLeaves = false }: { arraysAsLeaves?: boolean } = {}
): string[] {
  return [
    ...new Set(
      alerts.flatMap((alert) => {
        const keys = Object.keys(alert).filter(
          (key) => !AlertKnownKeys.includes(key)
        );
        return keys.flatMap((key) => {
          const value = alert[key as keyof AlertDto];
          if (arraysAsLeaves && Array.isArray(value)) {
            return key;
          }
          if (typeof value === "object" && value !== null) {
            return Object.keys(value as object).map(
              (subKey) => `${key}.${subKey}`
            );
          }
          return key;
        });
      })
    ),
  ].sort();
}
