import type { ReactNode } from "react";
import "react-grid-layout";

/**
 * Layout helpers react-grid-layout exports at runtime (`utils`) but its type
 * definitions leave out. Only the helpers the dashboard uses are declared.
 */
declare module "react-grid-layout" {
  namespace utils {
    function synchronizeLayoutWithChildren(
      initialLayout: Layout[],
      children: ReactNode,
      cols: number,
      compactType: "vertical" | "horizontal" | null,
      allowOverlap?: boolean
    ): Layout[];
  }
}
