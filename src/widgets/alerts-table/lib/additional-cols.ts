import { AlertDto, AlertKnownKeys } from "@/entities/alerts/model/types";

/**
 * Field keys of the given alerts that the alerts table has no fixed column
 * for, sorted and de-duplicated. An object-valued field contributes one
 * dotted key per sub-key (`labels.team`) instead of its own key.
 */
export function getAdditionalColsToGenerate(alerts: AlertDto[]): string[] {
  return [
    ...new Set(
      alerts.flatMap((alert) => {
        const keys = Object.keys(alert).filter(
          (key) => !AlertKnownKeys.includes(key)
        );
        return keys.flatMap((key) => {
          const value = alert[key as keyof AlertDto];
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
