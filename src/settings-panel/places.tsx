"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SfSymbol } from "../sf-symbol";
import { cn } from "../lib/utils";
import { GLASS, ICON, MUTED } from "./chrome";
import { PANEL_COPY, tx, type PanelLocale } from "./locale";
import { closePlayersHiddenByPlace } from "./model";
import type { SettingsGroup, SettingsPlace } from "./types";

/** Place marks on the scene — not a panel token. */
const PLACE_MARK = "#3B82F6";

export function placeParamCount<TSettings>(place: SettingsPlace<TSettings>) {
  return place.keys.length + (place.easingIds?.length ?? 0);
}

export function pointInSelector(selector: string, x: number, y: number) {
  const nodes = document.querySelectorAll(selector);
  for (const node of nodes) {
    const r = (node as HTMLElement).getBoundingClientRect();
    if (!r.width && !r.height) continue;
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
      return true;
    }
  }
  return false;
}

/** True if (x, y) sits in any `[data-settings-place=id]` box (works with pointer-events: none). */
export function pointInSettingsPlace(id: string, x: number, y: number) {
  return pointInSelector(`[data-settings-place="${id}"]`, x, y);
}

export function placeRects<TSettings>(place: SettingsPlace<TSettings>) {
  const rects: DOMRect[] = [];
  for (const sel of place.where ?? []) {
    document.querySelectorAll(sel).forEach((node) => {
      const r = (node as HTMLElement).getBoundingClientRect();
      const left = Math.max(0, r.left);
      const top = Math.max(0, r.top);
      const right = Math.min(window.innerWidth, r.right);
      const bottom = Math.min(window.innerHeight, r.bottom);
      if (right > left && bottom > top) {
        rects.push(new DOMRect(left, top, right - left, bottom - top));
      }
    });
  }
  return rects;
}

export function placeUnderPoint<TSettings>(
  places: readonly SettingsPlace<TSettings>[],
  x: number,
  y: number,
): SettingsPlace<TSettings> | null {
  const el = document.elementFromPoint(x, y);
  if (el instanceof Element) {
    if (
      el.closest("[data-settings-panel]") ||
      el.closest("[data-settings-place-layer]")
    ) {
      return null;
    }
  }
  for (const place of places) {
    if (place.hit) {
      if (place.hit(x, y)) return place;
      continue;
    }
    if (!el || !place.where) continue;
    for (const sel of place.where) {
      if (el.closest(sel)) return place;
    }
  }
  return null;
}

export function placeStillOnScreen<TSettings>(place: SettingsPlace<TSettings>) {
  if (place.hit) return true;
  return placeRects(place).length > 0;
}

export function writePlaceParam(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("place", id);
  else url.searchParams.delete("place");
  window.history.replaceState(window.history.state, "", url);
}

export function readPlaceParam() {
  return new URLSearchParams(window.location.search).get("place");
}

function typingInField(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(
      target.closest("input, textarea, select, [contenteditable=true]"),
    )
  );
}

export function PlacePointerButton({
  active,
  locale,
  onToggle,
}: {
  active: boolean;
  locale: PanelLocale;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={tx(
        active ? PANEL_COPY.cancelPickPlace : PANEL_COPY.pickPlace,
        locale,
      )}
      onClick={onToggle}
      className={cn(
        "inline-flex size-[34px] shrink-0 items-center justify-center rounded-md border px-0",
        "font-sans backdrop-blur-[8px] outline-none",
        "transition-[border-color,background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
        "focus-visible:border-[color:var(--sp-line-focus)] focus-visible:ring-1 focus-visible:ring-[color:var(--sp-line-mid)]",
        "active:scale-[0.97]",
        active
          ? "border-[color:var(--sp-line-strong)] hover:border-[color:var(--sp-line-focus)]"
          : "border-[color:var(--sp-line)] hover:border-[color:var(--sp-line-hover)] hover:bg-[color:var(--sp-fill-hover)]",
      )}
      style={{
        background: GLASS,
        color: active ? ICON : MUTED,
      }}
    >
      <SfSymbol name="pointer.arrow.rays" />
    </button>
  );
}

export function PlaceClearButton({
  locale,
  onClear,
}: {
  locale: PanelLocale;
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={tx(PANEL_COPY.showAllSettings, locale)}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onClear();
      }}
      className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center outline-none"
    >
      <SfSymbol name="xmark" className="size-5" style={{ color: ICON }} />
    </button>
  );
}

export function usePlacesPicker<TSettings>({
  places,
  groups,
  onSelectPlace,
}: {
  places: readonly SettingsPlace<TSettings>[];
  groups: readonly SettingsGroup<TSettings>[];
  /** Open the panel on the place section — the picker does not own panel chrome. */
  onSelectPlace: () => void;
}) {
  const [pickPlace, setPickPlace] = useState(false);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const selectedPlace = places.find((item) => item.id === placeId) ?? null;
  const groupsRef = useRef(groups);
  const onSelectRef = useRef(onSelectPlace);
  const placesRef = useRef(places);
  useEffect(() => {
    groupsRef.current = groups;
    onSelectRef.current = onSelectPlace;
    placesRef.current = places;
  });

  const applyPlace = (id: string | null) => {
    setPlaceId(id);
    writePlaceParam(id);
    const list = placesRef.current;
    const keys =
      id == null
        ? null
        : new Set(list.find((place) => place.id === id)?.keys ?? []);
    closePlayersHiddenByPlace(groupsRef.current, keys);
    if (id) onSelectRef.current();
  };

  useEffect(() => {
    if (places.length === 0) return;
    const id = readPlaceParam();
    if (!id || !places.some((place) => place.id === id)) return;
    applyPlace(id);
  }, [places]);

  useEffect(() => {
    if (!selectedPlace) return;
    const check = () => {
      if (!placeStillOnScreen(selectedPlace)) applyPlace(null);
    };
    const id = window.setInterval(check, 300);
    return () => window.clearInterval(id);
  }, [selectedPlace]);

  useEffect(() => {
    document.body.classList.toggle("settings-place-pick", pickPlace);
    return () => document.body.classList.remove("settings-place-pick");
  }, [pickPlace]);

  useEffect(() => {
    if (pickPlace) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || placeId == null) return;
      if (typingInField(event.target)) return;
      event.preventDefault();
      applyPlace(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pickPlace, placeId]);

  return { pickPlace, setPickPlace, placeId, selectedPlace, applyPlace };
}

export function PlaceHoverLayer<TSettings>({
  active,
  places,
  locale,
  panelTheme,
  onPick,
  onCancel,
}: {
  active: boolean;
  places: readonly SettingsPlace<TSettings>[];
  locale: PanelLocale;
  panelTheme: "dark" | "light";
  onPick: (id: string) => void;
  onCancel: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [hover, setHover] = useState<SettingsPlace<TSettings> | null>(null);
  const [rectTick, setRectTick] = useState(0);
  const labelRef = useRef<HTMLDivElement>(null);
  const hoverIdRef = useRef<string | null>(null);
  const rafRef = useRef(0);
  const onPickRef = useRef(onPick);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onPickRef.current = onPick;
    onCancelRef.current = onCancel;
  });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!active) {
      setHover(null);
      hoverIdRef.current = null;
      return;
    }
    const moveLabel = (x: number, y: number) => {
      const label = labelRef.current;
      if (!label) return;
      label.style.left = `${Math.min(x + 14, window.innerWidth - 22)}px`;
      label.style.top = `${Math.min(y + 14, window.innerHeight - 22)}px`;
    };
    const onMove = (event: PointerEvent) => {
      moveLabel(event.clientX, event.clientY);
      if (rafRef.current) return;
      const x = event.clientX;
      const y = event.clientY;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        const next = placeUnderPoint(places, x, y);
        const id = next?.id ?? null;
        if (id === hoverIdRef.current) return;
        hoverIdRef.current = id;
        setHover(next);
      });
    };
    const onClick = (event: MouseEvent) => {
      const next = placeUnderPoint(places, event.clientX, event.clientY);
      if (!next) return;
      event.preventDefault();
      event.stopPropagation();
      onCancelRef.current();
      onPickRef.current(next.id);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (typingInField(event.target)) return;
      event.preventDefault();
      onCancelRef.current();
    };
    const invalidateRects = () => setRectTick((n) => n + 1);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", invalidateRects);
    window.addEventListener("scroll", invalidateRects, true);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", invalidateRects);
      window.removeEventListener("scroll", invalidateRects, true);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, places]);

  if (!mounted || !active || !hover) return null;

  const rects = placeRects(hover);
  const n = rects.length;
  const caption = `${tx(hover.label, locale)}${
    n > 1 ? ` \u00d7 ${n}` : ""
  } · ${tx(PANEL_COPY.parameters(placeParamCount(hover)), locale)}`;

  return createPortal(
    <div
      data-settings-place-layer=""
      data-panel-theme={panelTheme}
      className="pointer-events-none fixed inset-0 z-[99]"
    >
      {rects.map((r, i) => {
        const huge =
          r.width * r.height >
          window.innerWidth * window.innerHeight * 0.8;
        if (huge) return null;
        return (
          <div
            key={`${rectTick}-${i}`}
            className="absolute box-border border border-dashed"
            style={{
              borderColor: PLACE_MARK,
              left: r.left,
              top: r.top,
              width: r.width,
              height: r.height,
            }}
          />
        );
      })}
      <div
        ref={labelRef}
        className="absolute max-w-[min(280px,calc(100vw-44px))] rounded-md border border-[color:var(--sp-line)] px-2 py-1 text-[12px] leading-[16px] text-[color:var(--sp-fg)] backdrop-blur-[8px]"
        style={{ background: GLASS }}
      >
        {caption}
      </div>
    </div>,
    document.body,
  );
}
