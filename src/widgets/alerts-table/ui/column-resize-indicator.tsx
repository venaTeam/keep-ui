"use client";

import { RefObject } from "react";
import { Table } from "@tanstack/react-table";
import { AlertDto } from "@/entities/alerts/model";

interface ColumnResizeIndicatorProps {
  table: Table<AlertDto>;
  containerRef: RefObject<HTMLDivElement | null>;
}

export function ColumnResizeIndicator({
  table,
  containerRef,
}: ColumnResizeIndicatorProps) {
  const { isResizingColumn, startOffset, deltaOffset } =
    table.getState().columnSizingInfo;
  const container = containerRef.current;

  if (!isResizingColumn || startOffset == null || !container) {
    return null;
  }

  const left =
    startOffset + (deltaOffset ?? 0) - container.getBoundingClientRect().left;

  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 w-px bg-blue-400 z-30"
      style={{ left }}
      aria-hidden
    />
  );
}
