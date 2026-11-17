import type { ReactNode } from "react";
import "react-grid-layout";

/**
 * Layout helpers react-grid-layout exports at runtime (`utils`) but its type
 * definitions leave out. Only the helpers the dashboard uses are declared.
 */
declare module "react-grid-layout" {
  namespace utils {
    type CompactType = "vertical" | "horizontal" | null;

    function synchronizeLayoutWithChildren(
      initialLayout: Layout[],
      children: ReactNode,
      cols: number,
      compactType: CompactType,
      allowOverlap?: boolean
    ): Layout[];

    function cloneLayout(layout: Layout[]): Layout[];

    function getLayoutItem(layout: Layout[], id: string): Layout | undefined;

    function moveElement(
      layout: Layout[],
      item: Layout,
      x: number | undefined,
      y: number | undefined,
      isUserAction: boolean,
      preventCollision: boolean,
      compactType: CompactType,
      cols: number,
      allowOverlap?: boolean
    ): Layout[];

    function compact(layout: Layout[], compactType: CompactType, cols: number): Layout[];
  }
}
