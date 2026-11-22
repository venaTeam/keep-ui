import { createContext, useContext } from "react";
import { useLocalStorage } from "@/utils/hooks/useLocalStorage";
import { DEFAULT_ROW_STYLE } from "./constants";

export type RowStyle = "relaxed" | "default";

const RowStyleOverrideContext = createContext<RowStyle | null>(null);

/**
 * Forces the row style returned by `useAlertRowStyle` for everything rendered
 * inside it, regardless of the viewer's stored preference. A `null` value
 * leaves the stored preference in effect.
 */
export const RowStyleOverrideProvider = RowStyleOverrideContext.Provider;

/**
 * Returns the alert table row style and a setter for the viewer's stored
 * preference. Inside a `RowStyleOverrideProvider` with a non-null value, the
 * returned row style is that value; the setter still writes the stored
 * preference.
 */
export const useAlertRowStyle = () => {
  const override = useContext(RowStyleOverrideContext);
  const [rowStyle, setRowStyle] = useLocalStorage<RowStyle>(
    "alert-table-row-style",
    DEFAULT_ROW_STYLE
  );

  return [override ?? rowStyle, setRowStyle] as const;
};
