import React from "react";
import { createSelectable, TSelectableItemProps } from "react-selectable-fast";
import { TableRow } from "@tremor/react";
import clsx from "clsx";

interface Props {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    onClick?: (e: React.MouseEvent) => void;
    onMouseDown?: (e: React.MouseEvent) => void;
    onMouseEnter?: () => void;
    "data-cy"?: string;
    "data-cy-id"?: string;
    "data-ringing"?: "true";
}

const Row = ({
    children,
    className,
    style,
    onClick,
    onMouseDown,
    onMouseEnter,
    selectableRef,
    isSelecting,
    isSelected,
    "data-cy": dataCy,
    "data-cy-id": dataCyId,
    "data-ringing": dataRinging,
}: Props & TSelectableItemProps) => {
    return (
        <TableRow
            ref={selectableRef}
            className={clsx(
                className,
                isSelecting && "!bg-blue-100/50",
                isSelected && "!bg-blue-200/50"
            )}
            style={style}
            onClick={onClick}
            onMouseDown={onMouseDown}
            onMouseEnter={onMouseEnter}
            data-cy={dataCy}
            data-cy-id={dataCyId}
            data-ringing={dataRinging}
            data-selection={
                isSelected ? "selected" : isSelecting ? "selecting" : undefined
            }
        >
            {children}
        </TableRow>
    );
};

export const SelectableRow = createSelectable(Row);
