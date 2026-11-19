import { createContext, useContext } from "react";

// Whether the dashboard is in edit mode. Panels read it to show their edit
// controls and to stop acting on clicks (navigation, links) while editing.
const DashboardEditModeContext = createContext(false);

export const DashboardEditModeProvider = DashboardEditModeContext.Provider;

export const useDashboardEditMode = () => useContext(DashboardEditModeContext);
