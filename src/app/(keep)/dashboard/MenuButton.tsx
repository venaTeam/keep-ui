import React, { Fragment, useRef, useState } from "react";
import { Menu, Portal, Transition } from "@headlessui/react";
import { Icon } from "@tremor/react";
import { PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import { FiSave } from "react-icons/fi";

interface MenuButtonProps {
  onEdit: () => void;
  onDelete: () => void;
  onSave?: () => void;
  icon?: React.ElementType;
  compact?: boolean;
}

const MENU_WIDTH = 144; // matches w-36

const MenuButton: React.FC<MenuButtonProps> = ({
  onEdit,
  onDelete,
  onSave,
  icon = EllipsisVerticalIcon,
  compact = false,
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null
  );

  const stopPropagation = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
  };

  const updateCoords = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setCoords({
        top: rect.bottom + 4,
        left: Math.max(8, rect.right - MENU_WIDTH),
      });
    }
  };

  const itemsClassName =
    "w-36 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none";

  const transitionProps = {
    as: Fragment,
    enter: "transition ease-out duration-100",
    enterFrom: "transform opacity-0 scale-95",
    enterTo: "transform opacity-100 scale-100",
    leave: "transition ease-in duration-75",
    leaveFrom: "transform opacity-100 scale-100",
    leaveTo: "transform opacity-0 scale-95",
  };

  const menuItems = (
    <div className="px-1 py-1">
      <Menu.Item>
        {({ active }) => (
          <button
            onClick={(e) => {
              stopPropagation(e);
              onEdit();
            }}
            className={`${
              active ? "bg-slate-200" : "text-gray-900"
            } group flex w-full items-center rounded-md px-2 py-2 text-xs`}
            data-cy="dashboard-widget-menu-edit"
          >
            <PencilIcon className="mr-2 h-4 w-4" aria-hidden="true" />
            Edit
          </button>
        )}
      </Menu.Item>
      <Menu.Item>
        {({ active }) => (
          <button
            onClick={(e) => {
              stopPropagation(e);
              onDelete();
            }}
            className={`${
              active ? "bg-slate-200" : "text-gray-900"
            } group flex w-full items-center rounded-md px-2 py-2 text-xs`}
            data-cy="dashboard-widget-menu-delete"
          >
            <TrashIcon className="mr-2 h-4 w-4" aria-hidden="true" />
            Delete
          </button>
        )}
      </Menu.Item>
      {onSave && (
        <Menu.Item>
          {({ active }) => (
            <button
              onClick={(e) => {
                stopPropagation(e);
                onSave();
              }}
              className={`${
                active ? "bg-slate-200" : "text-gray-900"
              } group flex w-full items-center rounded-md px-2 py-2 text-xs`}
              data-cy="dashboard-widget-menu-save"
            >
              <FiSave className="mr-2 h-4 w-4" aria-hidden="true" />
              Save
            </button>
          )}
        </Menu.Item>
      )}
    </div>
  );

  return (
    <div className={compact ? "text-right" : "w-44 text-right"}>
      <Menu as="div" className="relative inline-block text-left z-10">
        {({ open }) => (
          <>
            <Menu.Button
              ref={buttonRef}
              className={`inline-flex w-full justify-center rounded-md text-sm ${
                compact ? "" : "mt-2"
              }`}
              onClick={(e) => {
                stopPropagation(e);
                if (compact) {
                  updateCoords();
                }
              }}
              data-cy="dashboard-widget-menu-btn"
            >
              <Icon
                size="sm"
                icon={icon}
                className="hover:bg-gray-100 w-8 h-8"
                color="gray"
              />
            </Menu.Button>
            {compact ? (
              // Render in a portal with fixed positioning so the dropdown is not
              // clipped by the small, overflow-bounded counter widget box.
              <Portal>
                <Transition show={open} {...transitionProps}>
                  <Menu.Items
                    static
                    style={
                      coords
                        ? { top: coords.top, left: coords.left }
                        : undefined
                    }
                    className={`fixed z-50 ${itemsClassName}`}
                  >
                    {menuItems}
                  </Menu.Items>
                </Transition>
              </Portal>
            ) : (
              <Transition {...transitionProps}>
                <Menu.Items className={`absolute right-0 mt-2 ${itemsClassName}`}>
                  {menuItems}
                </Menu.Items>
              </Transition>
            )}
          </>
        )}
      </Menu>
    </div>
  );
};

export default MenuButton;
