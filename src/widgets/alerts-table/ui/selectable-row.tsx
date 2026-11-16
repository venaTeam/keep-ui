import React, { useCallback } from "react";
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
    rowRef?: (element: HTMLElement | null) => void;
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
    rowRef,
    selectableRef,
    isSelecting,
    isSelected,
    "data-cy": dataCy,
    "data-cy-id": dataCyId,
    "data-ringing": dataRinging,
}: Props & TSelectableItemProps) => {
    const ref = useCallback(
        (element: HTMLElement | null) => {
            selectableRef(element);
            rowRef?.(element);
        },
        [selectableRef, rowRef]
    );

    return (
        <TableRow
            ref={ref}
            className={clsx(
                className,
                isSelecting && !dataRinging && "!bg-blue-100/50",
                isSelected && !dataRinging && "!bg-blue-200/50"
            )}
            style={style}
            onClick={onClick}
            onMouseDown={onMouseDown}
            onMouseEnter={onMouseEnter}
            data-cy={dataCy}
            data-cy-id={dataCyId}
            data-ringing={dataRinging}
        >
            {children}
        </TableRow>
    );
};

export const SelectableRow = createSelectable(Row);
