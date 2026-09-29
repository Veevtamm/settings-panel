"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";
import { SfSymbol, type SfSymbolName } from "../sf-symbol";
import { GLASS, fieldValueSans, pickEase, pickIdle, pickerChrome } from "./chrome";
import { PANEL_COPY, tx, type PanelLocale } from "./locale";

/**
 * G5: own Field 28 to the left of the numbered preset slots. Menu = link,
 * save a `.json`, open a `.json`. `done` shows `check` after the link is copied.
 */
export function SettingsTransferMenu({
  locale,
  done,
  onCopyLink,
  onSaveFile,
  onOpenFile,
}: {
  locale: PanelLocale;
  done: boolean;
  onCopyLink: () => void;
  onSaveFile: () => void;
  onOpenFile: (file: File) => void;
}) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{
    top: number;
    left: number;
    theme: string;
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      setBox({
        top: rect.bottom + 4,
        left: rect.left,
        theme:
          button.closest("[data-panel-theme]")?.getAttribute("data-panel-theme") ??
          "dark",
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = (
    icon: SfSymbolName,
    label: string,
    onClick: () => void,
    hint?: string,
  ) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setOpen(false);
        onClick();
      }}
      className={cn(
        "flex h-7 w-full items-center gap-2 rounded px-1.5 text-left outline-none",
        fieldValueSans,
        "text-[color:var(--sp-muted)] transition-colors duration-150 fine-hover:hover:bg-[color:var(--sp-fill-hover)] fine-hover:hover:text-[color:var(--sp-fg)] focus-visible:text-[color:var(--sp-fg)]",
      )}
    >
      <SfSymbol name={icon} className="size-5 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {hint ? (
        <span className="font-mono text-[12px] text-[color:var(--sp-muted)] opacity-60">
          {hint}
        </span>
      ) : null}
    </button>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={tx(PANEL_COPY.transferSettings, locale)}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "relative flex size-[28px] shrink-0 items-center justify-center overflow-hidden rounded outline-none",
          pickerChrome,
          pickEase,
          pickIdle,
        )}
      >
        <SfSymbol name={done ? "check" : "link"} className="size-5" />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onOpenFile(file);
        }}
      />
      {open && box
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              data-settings-panel=""
              data-panel-theme={box.theme}
              className="fixed z-[130] flex w-[220px] flex-col gap-0.5 rounded-lg border border-[color:var(--sp-line)] p-1 backdrop-blur-[8px] font-sans"
              style={{ top: box.top, left: box.left, background: GLASS }}
            >
              {item("link", tx(PANEL_COPY.copySettingsLink, locale), onCopyLink)}
              {item(
                "file",
                tx(PANEL_COPY.saveSettingsFile, locale),
                onSaveFile,
                ".json",
              )}
              {item("folder", tx(PANEL_COPY.openSettingsFile, locale), () =>
                fileRef.current?.click(),
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
