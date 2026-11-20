"use client";

import type { ReactNode } from "react";
import type { LucideIconName } from "../lucide-glyphs";
import { dangerTextClass, menuHoverClass, menuSurfaceClass, PanelIcon } from "./kit-chrome";

export const PROJECT_MENU_WIDTH = 220;

export type ProjectMenuItem = {
  id: string;
  label: string;
  icon: LucideIconName;
  /** Replaces the Lucide glyph, as the editor mark on «Редактировать». */
  glyph?: ReactNode;
  danger?: boolean;
};

/** The project menu: open the page, hide or show, delete. */
export function projectMenuItems(hidden: boolean): ProjectMenuItem[] {
  return [
    { id: "open", label: "Открыть страницу", icon: "link" },
    {
      id: "hide",
      label: hidden ? "Показать проект" : "Скрыть проект",
      icon: hidden ? "eye" : "eye-off",
    },
    { id: "delete", label: "Удалить проект", icon: "trash-2", danger: true },
  ];
}

/** Black list opened from a project row (right click) or the editor’s three dots. */
export function ProjectMenu({
  items,
  onSelect,
}: {
  items: readonly ProjectMenuItem[];
  onSelect?: (id: string) => void;
}) {
  return (
    <div role="menu" className={`w-[220px] rounded-lg p-1 text-[14px] leading-none ${menuSurfaceClass}`}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          onClick={() => onSelect?.(item.id)}
          className={`flex h-6 w-full items-center gap-1 rounded px-0.5 text-left ${menuHoverClass} ${item.danger ? dangerTextClass : ""}`}
        >
          {item.glyph ?? <PanelIcon name={item.icon} className="size-5" />}
          {item.label}
        </button>
      ))}
    </div>
  );
}
