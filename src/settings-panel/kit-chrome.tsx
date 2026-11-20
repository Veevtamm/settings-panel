"use client";

import { Children, createContext, isValidElement, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactElement, ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import { evalNumberExpression } from "../lib/eval-number-expression";
import { usePrefersReducedMotion } from "../lib/prefers-reduced-motion";
import { PanelIcon as Icon } from "../panel-icon";
import type { LucideIconName } from "../lucide-glyphs";
import type { PanelTheme } from "../lib/panel-theme";
import {
  DOCK_DRAG_PX,
  DOCK_INSET,
  EASE_OUT,
  clampDockPos,
  dockPosForCorner,
  nearestDockCorner,
  PANEL_ENTER_MS,
  PANEL_EXIT_MS,
  PANEL_HEIGHT_MIN,
  PANEL_WIDTH_MAX,
  panelMaxHeightPx,
  SCRUB_MAX_TICK_STOPS,
  SECTION_MS,
  bindPointerDrag,
  type DockCorner,
} from "./chrome";
import { tx } from "./locale";
import { panelPopClassName, panelPopStyle } from "./motion-ui";
import { useDeferredMount } from "./row";
import { useRowOrderDrag } from "./row-order-drag";

export function trimNum(value: number) {
  return String(Math.round(value * 1000) / 1000);
}

const AREAL_STACK = '"ABC Areal Variable", "ABC Areal", "Geist", ui-sans-serif, system-ui, sans-serif';
const arealType = {
  fontFamily: AREAL_STACK,
  fontWeight: 400,
  letterSpacing: "normal",
} as const;

/** Primitive pair behind `--color-black` / `--color-white`. Components use those roles, not these hexes. */
export const PANEL_INK = "#0B0B0B";
export const PANEL_PAPER = "#E4E4E4";

/** Destructive text: delete, trash, a wrong code. */
export const dangerTextClass = "text-[color:var(--sp-danger)]";
/** Destructive fill. The label stays light on the red in both themes. */
export const dangerFillClass = "bg-[var(--sp-danger)] text-[color:var(--sp-on-danger)]";
/** Project menu plate. Same ink and paper as the rows; the theme swaps them. */
export const menuSurfaceClass = "border border-white bg-black text-white";
export const menuHoverClass = "fine-hover:hover:inset-ring fine-hover:hover:inset-ring-white";

const row = "group/row relative flex shrink-0 text-[14px] leading-none text-white";
export const rowLabel = "decoration-1 underline-offset-[3px] group-hover/row:underline";
const fieldUnderline = "underline decoration-1 underline-offset-[3px]";
export const rowLayout = "h-auto min-h-8 flex-wrap items-center justify-between gap-x-2 gap-y-1 px-1";
export const stackLayout = "h-auto flex-col items-stretch justify-start gap-1 p-1";
const wrapLayout = "h-auto min-h-8 flex-wrap items-start gap-x-2 gap-y-1 px-1";

export const rowLayouts = {
  row: rowLayout,
  stack: stackLayout,
  wrap: wrapLayout,
} as const;

export type RowLayout = keyof typeof rowLayouts;
export const NEW_PANEL_W_MIN = 296;
export const NEW_PANEL_W_MAX = PANEL_WIDTH_MAX;
export const NEW_PANEL_H_MIN = PANEL_HEIGHT_MIN;

export function panelHeightCap(anchor: DockAnchor | null) {
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  if (!anchor) return Math.max(NEW_PANEL_H_MIN, vh - 64);
  return panelMaxHeightPx(anchor.corner.startsWith("bottom"), anchor.y, vh);
}

export function useScrollRoot() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  return { el, setEl };
}

export function PanelIcon({
  name,
  className,
  strokeWidth = 1.8,
  tone,
}: {
  name: LucideIconName;
  className?: string;
  strokeWidth?: number;
  /** `danger` paints the glyph with `--sp-danger`. Size and position stay on `className`. */
  tone?: "danger";
}) {
  return <Icon name={name} className={className} strokeWidth={strokeWidth} tone={tone} />;
}

const startSort = createContext<((id: string, event: ReactPointerEvent<HTMLElement>) => void) | null>(null);
export const PanelLocale = createContext<"ru" | "en">("ru");

const KitThemeContext = createContext<PanelTheme>("light");

/** Ink and paper for the dock and the windows. Dark swaps the two before paint. */
export function KitTheme({ theme, children }: { theme: PanelTheme; children: ReactNode }) {
  return <KitThemeContext.Provider value={theme}>{children}</KitThemeContext.Provider>;
}

function surfaceAttrs(theme: PanelTheme) {
  return {
    "data-new-ui": "",
    "data-settings-panel": "",
    "data-panel-theme": theme,
  } as const;
}

export function tr(locale: "ru" | "en", ru: string, en: string) {
  return tx({ ru, en }, locale);
}

export function ChangedName({ changed, label, onReset }: { changed: boolean; label: string; onReset: () => void }) {
  const locale = useContext(PanelLocale);
  const reduce = usePrefersReducedMotion();
  const mark = useRef<HTMLSpanElement>(null);
  const motion = reduce ? "" : "transition-[width,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]";
  useLayoutEffect(() => {
    const row = mark.current?.closest<HTMLElement>("[data-row]");
    if (row) row.dataset.changed = changed ? "true" : "false";
  }, [changed]);
  return (
    <span ref={mark} className="flex min-w-0 items-center">
      <span className={`flex shrink-0 overflow-hidden ${motion}`} style={{ width: changed ? 20 : 0, opacity: changed ? 1 : 0 }}>
        <button
          type="button"
          aria-label={locale === "en" ? `Reset ${label}` : `Вернуть ${label}`}
          tabIndex={changed ? 0 : -1}
          onClick={(event) => {
            event.stopPropagation();
            onReset();
          }}
          className="flex size-4 shrink-0 items-center justify-center"
        >
          <i className="size-1 rounded-full bg-white" />
        </button>
      </span>
      <span className={rowLabel}>{label}</span>
    </span>
  );
}

export function RowHint({ text, children }: { text: string; children: ReactNode }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);
  const timer = useRef<number | null>(null);

  const tipRef = useRef<HTMLParagraphElement>(null);

  function show() {
    const node = anchor.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setBox({ top: rect.bottom + 6, left: rect.left });
  }

  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!box || !tip) return;
    const rect = tip.getBoundingClientRect();
    const pad = 8;
    let top = box.top;
    let left = box.left;
    if (rect.bottom > window.innerHeight - pad) {
      const host = anchor.current?.getBoundingClientRect();
      if (host) top = Math.max(pad, host.top - 6 - rect.height);
    }
    if (rect.right > window.innerWidth - pad) left -= rect.right - (window.innerWidth - pad);
    if (left < pad) left = pad;
    if (top !== box.top || left !== box.left) setBox({ top, left });
  }, [box]);

  function enter() {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(show, 500);
  }

  function leave() {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = null;
    setBox(null);
  }

  useEffect(() => () => {
    if (timer.current != null) window.clearTimeout(timer.current);
  }, []);

  return (
    <div ref={anchor} className="w-fit" onMouseEnter={enter} onMouseLeave={leave}>
      {children}
      {box
        ? createPortal(
            <p
              ref={tipRef}
              data-chrome=""
              className="pointer-events-none fixed z-[200] flex h-[22px] w-fit items-center rounded border border-white bg-black px-1 text-[11px] leading-[8px] text-white"
              style={{ top: box.top, left: box.left, ...arealType }}
            >
              {text}
            </p>,
            document.body,
          )
        : null}
    </div>
  );
}

function DragGrip({ className = "-left-2" }: { className?: string }) {
  const sort = useContext(startSort);
  const locale = useContext(PanelLocale);
  if (!sort) return null;
  return (
    <span
      data-grip=""
      role="button"
      aria-label={locale === "en" ? "Drag" : "Перетащить"}
      className={`group/grip pointer-events-auto absolute inset-y-0 z-10 flex w-2 cursor-grab touch-none items-center justify-center ${className}`}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const item = event.currentTarget.closest("[data-sort-id]");
        const id = item?.getAttribute("data-sort-id");
        if (!id) return;
        event.preventDefault();
        event.stopPropagation();
        sort(id, event);
      }}
    >
      <span className="hidden flex-col gap-[3px] group-hover/grip:flex">
        <i className="size-0.5 rounded-full bg-black" />
        <i className="size-0.5 rounded-full bg-black" />
        <i className="size-0.5 rounded-full bg-black" />
      </span>
    </span>
  );
}

export function Row({
  children,
  layout = "row",
  radius = true,
  bind,
}: {
  children: ReactNode;
  /** `row` — value on the right. `stack` — control under the label. `wrap` — chips that wrap. */
  layout?: RowLayout;
  radius?: boolean;
  bind?: string;
}) {
  return (
    <div data-row="" data-bind={bind} className={`${row} ${radius ? "rounded-lg" : ""} bg-black ${rowLayouts[layout]}`}>
      <DragGrip />
      {children}
    </div>
  );
}

function itemId(child: ReactElement, index: number) {
  return typeof child.key === "string" ? child.key.replace(/^\.\$/, "") : `item-${index}`;
}

export function Sortable({
  className,
  capsule = false,
  children,
}: {
  className?: string;
  capsule?: boolean;
  children: ReactNode;
}) {
  const items = Children.toArray(children).filter(isValidElement);
  const ids = items.map(itemId);
  const [order, setOrder] = useState(ids);
  const byId = new Map(items.map((item, index) => [ids[index], item]));
  const ordered = [...order.filter((id) => byId.has(id)), ...ids.filter((id) => !order.includes(id))];
  const drag = useRowOrderDrag(ordered, setOrder, { lift: capsule ? "black" : "white" });

  return (
    <startSort.Provider value={drag.onPointerDown}>
      <div ref={drag.listRef} data-capsule={capsule ? "" : undefined} className={`relative ${capsule ? "rounded-lg bg-black" : ""} ${className ?? ""}`}>
        {ordered.map((id) => (
          <div key={id} data-sort-id={id}>
            {byId.get(id)}
          </div>
        ))}
      </div>
      {drag.lift}
    </startSort.Provider>
  );
}

export function FloatWindow({
  children,
  resetKey,
  hidden = false,
  style,
  resizable,
}: {
  children: ReactNode;
  resetKey: number;
  hidden?: boolean;
  style?: CSSProperties;
  resizable?: {
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
    onResize: (next: { width?: number; height?: number }) => void;
  };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const theme = useContext(KitThemeContext);
  const [pos, setPos] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useEffect(() => {
    setPos(null);
  }, [resetKey]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const el = ref.current;
    const target = event.target;
    if (!el || !(target instanceof Element)) return;
    if (target.closest("button, input, textarea, a, [data-plot], [data-row], [data-resize], [role='slider'], [data-color-drag]")) return;
    const rect = el.getBoundingClientRect();
    const edge = event.clientY - rect.top <= 8;
    const originX = event.clientX;
    const originY = event.clientY;
    const offsetX = originX - rect.left;
    const offsetY = originY - rect.top;
    let moving = false;
    const place = (clientX: number, clientY: number) => {
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      setPos({
        x: Math.min(window.innerWidth - width - 12, Math.max(12, clientX - offsetX)),
        y: Math.min(window.innerHeight - 44 - 12, Math.max(12, clientY - offsetY)),
        w: width,
        h: height,
      });
    };
    if (edge) event.preventDefault();
    bindPointerDrag(event.pointerId, {
      onMove(ev) {
        if (!moving && !edge && Math.hypot(ev.clientX - originX, ev.clientY - originY) < 4) return;
        if (!moving) {
          moving = true;
          place(originX, originY);
        }
        place(ev.clientX, ev.clientY);
      },
      onEnd() {},
    });
  }

  function startResize(edge: "bottom" | "bottom-left" | "bottom-right", event: ReactPointerEvent<HTMLDivElement>) {
    if (!resizable || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const originX = event.clientX;
    const originY = event.clientY;
    const startW = rect.width;
    const startH = rect.height;
    const startTop = rect.top;
    const startRight = rect.right;
    const fromLeft = edge === "bottom-left";
    const fromRight = edge === "bottom-right";
    const clampW = (value: number) => Math.min(resizable.maxWidth, Math.max(resizable.minWidth, value));
    const room = Math.max(resizable.minHeight, window.innerHeight - startTop - 12);
    const clampH = (value: number) => Math.min(resizable.maxHeight, room, Math.max(resizable.minHeight, value));
    bindPointerDrag(event.pointerId, {
      onMove(ev) {
        const dx = ev.clientX - originX;
        const dy = ev.clientY - originY;
        const next: { width?: number; height?: number } = {};
        if (fromRight) next.width = clampW(startW + dx);
        if (fromLeft) {
          next.width = clampW(startW - dx);
          if (pos) setPos({ x: startRight - next.width, y: startTop, w: next.width, h: clampH(startH + dy) });
        }
        next.height = clampH(startH + dy);
        resizable.onResize(next);
      },
      onEnd() {},
    });
  }

  if (hidden && !pos) return null;

  const node = (
    <div
      ref={ref}
      {...surfaceAttrs(theme)}
      onPointerDown={hidden ? undefined : onPointerDown}
      className={hidden ? "pointer-events-none relative" : "pointer-events-auto relative [&:not(:has(section))]:absolute [&:not(:has(section))]:size-0"}
      style={{
        ...arealType,
        ...style,
        ...(pos ? { position: "fixed", left: pos.x, top: pos.y, zIndex: 95 } : null),
        ...(hidden ? { visibility: "hidden" } : null),
      }}
    >
      <div className="absolute inset-x-0 top-0 z-20 h-2 cursor-grab touch-none" />
      {resizable ? (
        <>
          <div data-resize="" className="absolute inset-x-3 bottom-0 z-40 h-1.5 cursor-ns-resize touch-none" onPointerDown={(event) => startResize("bottom", event)} />
          <div data-resize="" className="absolute bottom-0 left-0 z-40 size-3 cursor-nesw-resize touch-none" onPointerDown={(event) => startResize("bottom-left", event)} />
          <div data-resize="" className="absolute bottom-0 right-0 z-40 size-3 cursor-nwse-resize touch-none" onPointerDown={(event) => startResize("bottom-right", event)} />
        </>
      ) : null}
      {children}
    </div>
  );

  if (!pos) return node;
  return (
    <>
      <div aria-hidden className="pointer-events-none shrink-0" style={{ width: pos.w, height: pos.h, visibility: "hidden" }} />
      {createPortal(node, document.body)}
    </>
  );
}

export function Pop({ open, children }: { open: boolean; children: ReactNode }) {
  const reduce = usePrefersReducedMotion();
  const mounted = useDeferredMount(open, reduce, PANEL_EXIT_MS);
  if (!mounted) return null;
  return (
    <div className={panelPopClassName({ open, fromBottom: false, skip: reduce })} style={panelPopStyle({ open, skip: reduce })}>
      {children}
    </div>
  );
}

export function ValueField({
  value,
  unit,
  current,
  min,
  max,
  step = 1,
  block = false,
  onEditingChange,
  onCommit,
}: {
  value: string;
  unit?: string;
  /** Set on number fields: math, arrow keys. Shift steps ×10. */
  current?: number;
  min?: number;
  max?: number;
  step?: number;
  /** Fill the parent chip: the whole box edits, the number sits in the center. */
  block?: boolean;
  onEditingChange?: (editing: boolean) => void;
  onCommit: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const cancel = useRef(false);
  const shown = editing ? draft : value;
  const numeric = current != null;

  useEffect(() => {
    onEditingChange?.(editing);
  }, [editing, onEditingChange]);

  function clamp(next: number) {
    const low = min ?? -Infinity;
    const high = max ?? Infinity;
    return Math.min(high, Math.max(low, next));
  }

  function emit(raw: string) {
    if (!numeric) {
      onCommit(raw);
      return;
    }
    const parsed = evalNumberExpression(raw, current);
    if (parsed == null) return;
    onCommit(String(clamp(parsed)));
  }

  function stepBy(dir: 1 | -1, times: number) {
    if (!numeric) return;
    onCommit(String(clamp(Number((current + dir * step * times).toFixed(6)))));
    setEditing(false);
  }

  return (
    <span className={block ? "relative flex h-full w-full items-center justify-center" : "relative inline-flex h-[18px] items-center gap-1"}>
      <span className={`inline-flex h-[18px] items-center ${block ? "" : "group/value relative"}`}>
        <span className={`text-[14px] leading-[18px] whitespace-nowrap ${block ? (editing ? "text-black" : "text-white group-hover/chip:text-black") : "text-white decoration-1 underline-offset-[3px] group-hover/value:underline"} ${!block && editing ? fieldUnderline : ""}`}>{shown || "0"}</span>
        <input
          value={shown}
          onFocus={(event) => {
            setDraft(value);
            setEditing(true);
            event.currentTarget.select();
          }}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => {
            const raw = event.currentTarget.value.trim();
            if (!cancel.current && raw !== "") emit(raw);
            cancel.current = false;
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            else if (event.key === "Escape") {
              cancel.current = true;
              setEditing(false);
              event.currentTarget.blur();
            } else if (numeric && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
              event.preventDefault();
              stepBy(event.key === "ArrowUp" ? 1 : -1, event.shiftKey ? 10 : 1);
            }
          }}
          className={`absolute m-0 appearance-none border-0 bg-transparent p-0 text-[14px] leading-none text-transparent outline-none ${block && editing ? "caret-black" : "caret-white"} ${block ? "inset-0 h-full w-full text-center" : "inset-0 h-full w-full text-left"}`}
        />
      </span>
      {unit ? <span className="text-[14px] leading-[18px] whitespace-nowrap text-white/50">{unit}</span> : null}
    </span>
  );
}

export const PANEL_SECTION_IDS = ["scene", "card", "title", "bars"] as const;

export const SectionFoldContext = createContext<{
  closed: ReadonlySet<string>;
  toggle: (id: string) => void;
} | null>(null);

export function ParametersPanel({
  title,
  canCollapse,
  onToggleFold,
  collapseLabel,
  expandLabel,
  className = "",
  style,
  bodyRef,
  bodyStyle,
  children,
}: {
  title: string;
  canCollapse: boolean;
  onToggleFold: () => void;
  collapseLabel: string;
  expandLabel: string;
  className?: string;
  style?: CSSProperties;
  bodyRef?: (node: HTMLDivElement | null) => void;
  bodyStyle?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <section data-chrome="" className={`relative flex flex-col overflow-hidden rounded-2xl bg-white text-black ${className}`} style={style}>
      <header className="flex items-center justify-between px-3 pt-2 pb-0.5">
        <span className="flex h-5 min-w-0 items-center gap-1">
          <PanelIcon name="sliders-horizontal" className="size-5" />
          <span className="text-[14px] leading-4">{title}</span>
        </span>
        <button type="button" aria-label={canCollapse ? collapseLabel : expandLabel} onClick={onToggleFold} className="flex size-5 items-center justify-center">
          <PanelIcon name={canCollapse ? "list-chevrons-down-up" : "list-chevrons-up-down"} className="size-5" />
        </button>
      </header>
      <div
        ref={bodyRef}
        className="mt-1.5 min-h-0 overflow-y-auto overscroll-y-contain px-2 pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={bodyStyle}
      >
        {children}
      </div>
    </section>
  );
}

export function Section({
  foldId,
  title,
  icon,
  action,
  changed = false,
  children,
}: {
  foldId?: string;
  title: string;
  icon?: LucideIconName;
  action?: ReactNode;
  changed?: boolean;
  children: ReactNode;
}) {
  const locale = useContext(PanelLocale);
  const fold = useContext(SectionFoldContext);
  const reduce = usePrefersReducedMotion();
  const [localOpen, setLocalOpen] = useState(true);
  const open = fold && foldId ? !fold.closed.has(foldId) : localOpen;
  const mounted = useDeferredMount(open, reduce, SECTION_MS);
  function toggleOpen() {
    if (fold && foldId) fold.toggle(foldId);
    else setLocalOpen((value) => !value);
  }

  return (
    <div className="flex flex-col" data-section={title} data-changed={changed ? "true" : "false"}>
      <div className="relative -ml-2 flex h-4 w-[calc(100%+8px)] items-center pl-3 pr-1 text-black">
        <DragGrip className="left-0" />
        <button type="button" onClick={toggleOpen} className="flex min-w-0 flex-1 items-center gap-1 text-left">
          {icon ? <PanelIcon name={icon} className="size-5" /> : null}
          <span className="text-[14px] leading-4">{title}</span>
        </button>
        <span className="flex items-center gap-2">
          {action}
          <button type="button" aria-label={locale === "en" ? (open ? "Collapse" : "Expand") : (open ? "Свернуть" : "Развернуть")} onClick={toggleOpen}>
            <PanelIcon name={open ? "chevron-up" : "chevron-down"} className="size-5" />
          </button>
        </span>
      </div>
      <div
        className={`-ml-2 grid w-[calc(100%+8px)] ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"} ${reduce ? "" : "transition-[grid-template-rows]"}`}
        style={reduce ? undefined : { transitionDuration: `${SECTION_MS}ms`, transitionTimingFunction: EASE_OUT }}
        inert={open ? undefined : true}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={reduce ? undefined : `transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
            style={
              reduce
                ? undefined
                : {
                    transitionDuration: open ? `${SECTION_MS}ms` : `${Math.round(SECTION_MS * 0.7)}ms`,
                    transitionTimingFunction: EASE_OUT,
                  }
            }
          >
            {mounted ? (
              <div className="pt-1.5 pl-2">
                <Sortable capsule>{children}</Sortable>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export type DockAnchor = {
  x: number;
  y: number;
  w: number;
  h: number;
  corner: DockCorner;
};

export const DockAnchorContext = createContext<DockAnchor | null>(null);

export function DockedWindows({ children }: { children: ReactNode }) {
  const dock = useContext(DockAnchorContext);
  if (!dock) return null;
  const below = !dock.corner.startsWith("bottom");
  const centered = dock.corner.endsWith("center");
  const right = dock.corner.endsWith("right");
  return (
    <div
      className="pointer-events-none fixed z-[90] flex gap-2"
      style={{
        top: below ? dock.y + dock.h + 8 : undefined,
        bottom: below ? undefined : window.innerHeight - dock.y + 8,
        left: right ? undefined : centered ? window.innerWidth / 2 : dock.x,
        right: right ? window.innerWidth - (dock.x + dock.w) : undefined,
        transform: centered ? "translateX(-50%)" : undefined,
        alignItems: below ? "flex-start" : "flex-end",
      }}
    >
      {children}
    </div>
  );
}

export function Toast({ text, detail }: { text: string; detail?: string }) {
  return (
    <p
      data-toast=""
      role="status"
      className="pointer-events-none flex h-[22px] w-fit items-center gap-1 rounded border border-white bg-black px-1 text-[11px] leading-[8px] text-white"
    >
      <span>{text}</span>
      {detail ? <span className="text-white/50">{detail}</span> : null}
    </p>
  );
}

export function ScreenDock({ children, toast, onAnchor }: { children: ReactNode; toast?: ReactNode; onAnchor: (anchor: DockAnchor) => void }) {
  const barRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const draggingRef = useRef(false);
  const [corner, setCorner] = useState<DockCorner>("top-center");
  const [pos, setPos] = useState({ x: DOCK_INSET, y: DOCK_INSET, w: 180, h: 36 });
  const [placed, setPlaced] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [slide, setSlide] = useState(false);
  const barSize = useRef({ w: 0, h: 0 });

  function size() {
    const bar = barRef.current;
    return { w: bar?.offsetWidth ?? 180, h: bar?.offsetHeight ?? 32 };
  }

  useLayoutEffect(() => {
    const place = () => {
      if (draggingRef.current) return;
      const { w, h } = size();
      if (w !== barSize.current.w || h !== barSize.current.h) {
        barSize.current = { w, h };
        setSlide(false);
      }
      const next = dockPosForCorner(corner, w, window.innerWidth, window.innerHeight, h);
      if (corner.endsWith("center")) next.x = Math.max(DOCK_INSET, (window.innerWidth - w) / 2);
      setPos({ ...next, w, h });
    };
    place();
    setPlaced(true);
    const bar = barRef.current;
    const observer = bar ? new ResizeObserver(place) : null;
    if (bar && observer) observer.observe(bar);
    window.addEventListener("resize", place);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [corner]);

  useEffect(() => {
    if (!placed) return;
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, [placed]);

  useLayoutEffect(() => {
    if (!placed) return;
    onAnchor({ x: pos.x, y: pos.y, w: pos.w, h: pos.h, corner });
  }, [placed, pos, corner, onAnchor]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    moved.current = false;
    const originX = event.clientX;
    const originY = event.clientY;
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetX = originX - rect.left;
    const offsetY = originY - rect.top;
    bindPointerDrag(event.pointerId, {
      onMove(ev) {
        if (!moved.current && Math.hypot(ev.clientX - originX, ev.clientY - originY) < DOCK_DRAG_PX) return;
        moved.current = true;
        draggingRef.current = true;
        setDragging(true);
        const { w, h } = size();
        const next = clampDockPos(
          ev.clientX - offsetX,
          ev.clientY - offsetY,
          w,
          window.innerWidth,
          window.innerHeight,
          h,
        );
        setPos({ ...next, w, h });
      },
      onEnd() {
        draggingRef.current = false;
        setDragging(false);
        if (!moved.current) return;
        const { w, h } = size();
        const rect = barRef.current?.getBoundingClientRect();
        const next = nearestDockCorner(
          rect?.left ?? pos.x,
          rect?.top ?? pos.y,
          w,
          window.innerWidth,
          window.innerHeight,
          h,
        );
        setCorner(next);
        setSlide(true);
        const snapped = dockPosForCorner(next, w, window.innerWidth, window.innerHeight, h);
        if (next.endsWith("center")) snapped.x = Math.max(DOCK_INSET, (window.innerWidth - w) / 2);
        setPos({ ...snapped, w, h });
      },
    });
  }

  const theme = useContext(KitThemeContext);
  return (
    <div
      ref={barRef}
      data-chrome=""
      data-dock-bar=""
      {...surfaceAttrs(theme)}
      className={`fixed z-[100] flex h-9 items-center gap-1 rounded-lg bg-white p-1 ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={{
        ...arealType,
        top: pos.y,
        left: pos.x,
        visibility: placed ? "visible" : "hidden",
        transition: !animate || dragging || !slide ? undefined : `top ${PANEL_ENTER_MS}ms ${EASE_OUT}, left ${PANEL_ENTER_MS}ms ${EASE_OUT}`,
      }}
      onPointerDown={onPointerDown}
      onClickCapture={(event) => {
        if (!moved.current) return;
        event.preventDefault();
        event.stopPropagation();
        moved.current = false;
      }}
    >
      {children}
      {toast ? (
        <div className="pointer-events-none absolute top-full left-1/2 z-20 mt-2 -translate-x-1/2">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

export function TargetPick({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  if (options.length === 0) return null;
  return (
    <div ref={anchor} onClick={() => setOpen((current) => !current)} className="cursor-pointer overflow-hidden rounded-lg bg-black text-[14px] leading-none text-white">
      <div className="flex h-8 items-center justify-between px-1">
        <span>{label}</span>
        <span className="flex items-center gap-1">
          {value}
          <PanelIcon name="chevrons-up-down" className="size-5" />
        </span>
      </div>
      <FloatingMenu open={open} anchor={anchor} onClose={() => setOpen(false)}>
        <Menu
          options={[...options]}
          value={value}
          onChange={(next) => {
            onChange(next);
            setOpen(false);
          }}
        />
      </FloatingMenu>
    </div>
  );
}

export function CommandMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
    </svg>
  );
}

export function KeyCap({ children }: { children: ReactNode }) {
  return (
    <span className="pointer-events-none flex size-6 items-center justify-center rounded text-[14px] leading-none text-white opacity-50 inset-ring inset-ring-white">
      {children}
    </span>
  );
}

export function StepMark({ kind }: { kind: "plus" | "minus" }) {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
      <rect x="3.5" y="7.4" width="9" height="1.2" rx="0.6" fill="currentColor" />
      {kind === "plus" ? <rect x="7.4" y="3.5" width="1.2" height="9" rx="0.6" fill="currentColor" /> : null}
    </svg>
  );
}

export function DockButton({
  name,
  active,
  disabled = false,
  onClick,
  label,
  badge,
}: {
  name: LucideIconName;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  label: string;
  badge?: number;
}) {
  const close = Boolean(active) && !disabled;
  return (
    <span className={`relative ${badge != null ? "z-10" : ""}`}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
        className={`group/dock flex size-7 items-center justify-center rounded ${disabled ? "text-black/50" : active ? "bg-black text-white" : "text-black fine-hover:hover:inset-ring fine-hover:hover:inset-ring-black"}`}
      >
        <PanelIcon name={name} className={`size-5 ${close ? "fine-hover:group-hover/dock:hidden" : ""}`} />
        {close ? <PanelIcon name="x" className="hidden size-5 fine-hover:group-hover/dock:block" /> : null}
      </button>
      {badge != null ? (
        <span className="pointer-events-none absolute top-[-7px] left-[21px] flex size-3.5 items-center justify-center rounded-full bg-black text-[10px] leading-none text-white">
          {badge}
        </span>
      ) : null}
    </span>
  );
}

function tickValues(min: number, max: number, step?: number) {
  if (step == null || step <= 0 || max <= min) return [];
  const count = Math.round((max - min) / step) + 1;
  if (count < 2 || count > SCRUB_MAX_TICK_STOPS) return [];
  return Array.from({ length: count }, (_, index) => Number((min + index * step).toFixed(6)));
}

/** Value under the thumb. Stops at the row edges so the digits are not clipped. */
function FollowCaption({
  center,
  className,
  children,
}: {
  center: string;
  className: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const next = ref.current?.offsetWidth ?? 0;
    setWidth((current) => (current === next ? current : next));
  });
  return (
    <span
      ref={ref}
      className={className}
      style={{
        left: width
          ? `clamp(0px, calc(${center} - ${width / 2}px), calc(100% - ${width}px))`
          : center,
      }}
    >
      {children}
    </span>
  );
}

export function Track({
  min,
  max,
  start,
  end = start,
  dual = false,
  handle = "bar",
  step,
  home,
  homeEnd,
  onChange,
}: {
  min: number;
  max: number;
  start: number;
  end?: number;
  dual?: boolean;
  handle?: "bar" | "square";
  /** Marks and snap appear only when this step yields 2–14 stops. */
  step?: number;
  /** Default, drawn as the tall mark. Hidden while a handle sits on it. */
  home?: number;
  homeEnd?: number;
  onChange: (start: number, end: number) => void;
}) {
  const span = max - min || 1;
  const toRatio = (value: number) => (value - min) / span;
  const bar = handle === "bar";
  const handleSize = bar ? 4 : 18;
  const inset = 3;
  const travel = `100% - ${handleSize + inset * 2}px`;
  // Bar: tick and handle centers sit 4px in from the inner edges (Figma New / Range).
  const handleLeft = (ratio: number) =>
    bar ? `calc(2px + (100% - 8px) * ${ratio})` : `calc(${inset}px + (${travel}) * ${ratio})`;
  const dragRef = useRef<"start" | "end" | null>(null);
  const marks = tickValues(min, max, step);
  const startRatio = toRatio(start);
  const endRatio = toRatio(end);
  const handlesClose = dual && Math.abs(endRatio - startRatio) < 0.22;
  const captionRatios = dual ? (handlesClose ? [(startRatio + endRatio) / 2] : [startRatio, endRatio]) : [startRatio];
  const showMin = captionRatios.every((ratio) => ratio > 0.18);
  const showMax = captionRatios.every((ratio) => ratio < 0.82);

  function tickLeft(ratio: number) {
    return bar
      ? `calc(3px + (100% - 8px) * ${ratio})`
      : `calc(${inset + handleSize / 2 - 1}px + (${travel}) * ${ratio})`;
  }

  function valueLeft(ratio: number) {
    return bar
      ? `calc(4px + (100% - 8px) * ${ratio})`
      : `calc(${inset + handleSize / 2}px + (${travel}) * ${ratio})`;
  }

  function onFill(ratio: number) {
    if (!dual) return ratio < startRatio - 0.001;
    const from = Math.min(startRatio, endRatio);
    const to = Math.max(startRatio, endRatio);
    return ratio > from + 0.001 && ratio < to - 0.001;
  }

  function valueFromX(clientX: number, el: HTMLDivElement) {
    const rect = el.getBoundingClientRect();
    const border = (rect.width - el.clientWidth) / 2;
    const inner = el.clientWidth;
    const travelPx = bar ? Math.max(inner - 8, 1) : Math.max(inner - handleSize - inset * 2, 1);
    const origin = bar ? 4 : inset + handleSize / 2;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left - border - origin) / travelPx));
    const raw = min + ratio * span;
    if (marks.length === 0) return Math.round(raw);
    return marks.reduce((best, stop) => (Math.abs(stop - raw) < Math.abs(best - raw) ? stop : best));
  }

  function commit(which: "start" | "end", value: number) {
    if (!dual || which === "start") onChange(dual ? Math.min(value, end) : value, dual ? end : value);
    else onChange(start, Math.max(value, start));
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    const value = valueFromX(event.clientX, event.currentTarget);
    const which = !dual || Math.abs(value - start) <= Math.abs(value - end) ? "start" : "end";
    dragRef.current = which;
    event.currentTarget.setPointerCapture(event.pointerId);
    commit(which, value);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    if (event.pointerType !== "touch" && (event.buttons & 1) === 0) {
      dragRef.current = null;
      return;
    }
    commit(dragRef.current, valueFromX(event.clientX, event.currentTarget));
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function markHidden(value: number) {
    const onMark = (current: number) => Math.abs(current - value) < 0.001;
    return onMark(start) || (dual && onMark(end));
  }

  function homeMark(value: number | undefined) {
    if (value == null || value < min || value > max) return null;
    const ratio = toRatio(value);
    return (
      <span
        key={value}
        className={`pointer-events-none absolute top-1 h-4 w-0.5 rounded-[1px] ${onFill(ratio) ? "bg-black" : "bg-white"}`}
        style={{ left: tickLeft(ratio), opacity: markHidden(value) ? 0 : 1 }}
      />
    );
  }

  const caption = "pointer-events-none absolute top-0 text-[11px] leading-4 whitespace-nowrap text-white/50";

  return (
    <div className="flex w-full flex-col gap-1">
    <div
      role="slider"
      aria-label={dual ? "Диапазон" : "Значение"}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={start}
      aria-valuetext={dual ? `${start}–${end}` : String(start)}
      className="relative isolate box-border h-6 cursor-ew-resize touch-none overflow-hidden rounded inset-ring inset-ring-white select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="pointer-events-none absolute inset-y-0 rounded bg-white"
        style={
          dual
            ? bar
              ? {
                  left: `calc((100% - 8px) * ${toRatio(Math.min(start, end))} - 1px)`,
                  width: `calc((100% - 8px) * ${Math.abs(toRatio(end) - toRatio(start))} + 10px)`,
                }
              : {
                  left: `calc((${travel}) * ${toRatio(Math.min(start, end))})`,
                  width: `calc((${travel}) * ${Math.abs(toRatio(end) - toRatio(start))} + ${handleSize + inset * 2}px)`,
                }
            : {
                left: 0,
                width: bar
                  ? `calc((100% - 8px) * ${toRatio(start)} + 9px)`
                  : `calc((${travel}) * ${toRatio(start)} + ${handleSize + inset * 2}px)`,
              }
        }
      />
      {marks.map((value, index) => (
        <span
          key={value}
          className="pointer-events-none absolute top-2 h-2 w-0.5 rounded-[1px] bg-white/50"
          style={{
            left: tickLeft(index / Math.max(marks.length - 1, 1)),
            opacity: markHidden(value) ? 0 : 1,
          }}
        />
      ))}
      {homeMark(home)}
      {dual ? homeMark(homeEnd) : null}
      <span
        className={`pointer-events-none absolute top-[3px] bg-black ${handle === "square" ? "size-[18px] rounded-[1px]" : "h-[18px] w-1 rounded-[1px]"}`}
        style={{ left: handleLeft(toRatio(start)) }}
      />
      {dual ? (
        <span
          className="pointer-events-none absolute top-[3px] h-[18px] w-1 rounded-[1px] bg-black"
          style={{ left: handleLeft(toRatio(end)) }}
        />
      ) : null}
    </div>
    <div aria-hidden className="relative h-4">
      <span className={`${caption} left-1 ${showMin ? "" : "opacity-0"}`}>{trimNum(min)}</span>
      {handlesClose ? (
        <FollowCaption center={valueLeft((startRatio + endRatio) / 2)} className={caption}>
          {trimNum(start)}–{trimNum(end)}
        </FollowCaption>
      ) : (
        <>
          <FollowCaption center={valueLeft(startRatio)} className={caption}>
            {trimNum(start)}
          </FollowCaption>
          {dual ? (
            <FollowCaption center={valueLeft(endRatio)} className={caption}>
              {trimNum(end)}
            </FollowCaption>
          ) : null}
        </>
      )}
      <span className={`${caption} right-1 ${showMax ? "" : "opacity-0"}`}>{trimNum(max)}</span>
    </div>
    </div>
  );
}

/** Stroke outlines from the Figma icons: one filled shape, so 50% opacity stays even. */
const PICK_GLYPH: Record<string, [number, number, string]> = {
  square: [2, 2, "M 12 1.93 C 12 1.53 11.67 1.2 11.27 1.2 L 1.93 1.2 C 1.53 1.2 1.2 1.53 1.2 1.93 L 1.2 11.27 C 1.2 11.67 1.53 12 1.93 12 L 11.27 12 C 11.67 12 12 11.67 12 11.27 L 12 1.93 Z M 13.2 11.27 C 13.2 12.33 12.33 13.2 11.27 13.2 L 1.93 13.2 C 0.87 13.2 0 12.33 0 11.27 L 0 1.93 C 0 0.87 0.87 0 1.93 0 L 11.27 0 C 12.33 0 13.2 0.87 13.2 1.93 L 13.2 11.27 Z"],
  "rectangle-vertical": [4, 1.33, "M 8 1.93 C 8 1.53 7.67 1.2 7.27 1.2 L 1.93 1.2 C 1.53 1.2 1.2 1.53 1.2 1.93 L 1.2 12.6 C 1.2 13 1.53 13.33 1.93 13.33 L 7.27 13.33 C 7.67 13.33 8 13 8 12.6 L 8 1.93 Z M 9.2 12.6 C 9.2 13.67 8.33 14.53 7.27 14.53 L 1.93 14.53 C 0.87 14.53 0 13.67 0 12.6 L 0 1.93 C 0 0.87 0.87 0 1.93 0 L 7.27 0 C 8.33 0 9.2 0.87 9.2 1.93 L 9.2 12.6 Z"],
  "rectangle-horizontal": [1.33, 4, "M 13.33 1.93 C 13.33 1.53 13 1.2 12.6 1.2 L 1.93 1.2 C 1.53 1.2 1.2 1.53 1.2 1.93 L 1.2 7.27 C 1.2 7.67 1.53 8 1.93 8 L 12.6 8 C 13 8 13.33 7.67 13.33 7.27 L 13.33 1.93 Z M 14.53 7.27 C 14.53 8.33 13.67 9.2 12.6 9.2 L 1.93 9.2 C 0.87 9.2 0 8.33 0 7.27 L 0 1.93 C 0 0.87 0.87 0 1.93 0 L 12.6 0 C 13.67 0 14.53 0.87 14.53 1.93 L 14.53 7.27 Z"],
  "align-start-vertical": [1.33, 1.33, "M 0 13.93 L 0 0.6 C 0 0.27 0.27 0 0.6 0 C 0.93 0 1.2 0.27 1.2 0.6 L 1.2 13.93 C 1.2 14.26 0.93 14.53 0.6 14.53 C 0.27 14.53 0 14.26 0 13.93 Z M 8.67 9.93 C 8.67 9.53 8.34 9.2 7.93 9.2 L 4.6 9.2 C 4.19 9.2 3.87 9.53 3.87 9.93 L 3.87 11.27 C 3.87 11.67 4.19 12 4.6 12 L 7.93 12 C 8.34 12 8.67 11.67 8.67 11.27 L 8.67 9.93 Z M 13.33 3.27 C 13.33 2.86 13 2.53 12.6 2.53 L 4.6 2.53 C 4.19 2.53 3.87 2.86 3.87 3.27 L 3.87 4.6 C 3.87 5 4.19 5.33 4.6 5.33 L 12.6 5.33 C 13 5.33 13.33 5 13.33 4.6 L 13.33 3.27 Z M 9.87 11.27 C 9.87 12.33 9 13.2 7.93 13.2 L 4.6 13.2 C 3.53 13.2 2.67 12.33 2.67 11.27 L 2.67 9.93 C 2.67 8.87 3.53 8 4.6 8 L 7.93 8 C 9 8 9.87 8.87 9.87 9.93 L 9.87 11.27 Z M 14.53 4.6 C 14.53 5.67 13.67 6.53 12.6 6.53 L 4.6 6.53 C 3.53 6.53 2.67 5.67 2.67 4.6 L 2.67 3.27 C 2.67 2.2 3.53 1.33 4.6 1.33 L 12.6 1.33 C 13.67 1.33 14.53 2.2 14.53 3.27 L 14.53 4.6 Z"],
  "align-center-vertical": [1.33, 1.33, "M 6.67 13.93 L 6.67 0.6 C 6.67 0.27 6.94 0 7.27 0 C 7.6 0 7.87 0.27 7.87 0.6 L 7.87 13.93 C 7.87 14.26 7.6 14.53 7.27 14.53 C 6.94 14.53 6.67 14.26 6.67 13.93 Z M 2 11.27 L 2 9.93 C 2 8.87 2.87 8 3.93 8 L 4.6 8 C 4.93 8 5.2 8.27 5.2 8.6 C 5.2 8.93 4.93 9.2 4.6 9.2 L 3.93 9.2 C 3.53 9.2 3.2 9.53 3.2 9.93 L 3.2 11.27 C 3.2 11.46 3.28 11.65 3.41 11.79 C 3.55 11.92 3.74 12 3.93 12 L 4.6 12 C 4.93 12 5.2 12.27 5.2 12.6 C 5.2 12.93 4.93 13.2 4.6 13.2 L 3.93 13.2 C 3.42 13.2 2.93 13 2.57 12.63 C 2.2 12.27 2 11.78 2 11.27 Z M 11.33 11.27 L 11.33 9.93 C 11.33 9.74 11.26 9.55 11.12 9.41 C 10.98 9.28 10.79 9.2 10.6 9.2 L 9.93 9.2 C 9.6 9.2 9.33 8.93 9.33 8.6 C 9.33 8.27 9.6 8 9.93 8 L 10.6 8 C 11.11 8 11.6 8.2 11.97 8.57 C 12.33 8.93 12.53 9.42 12.53 9.93 L 12.53 11.27 C 12.53 11.78 12.33 12.27 11.97 12.63 C 11.6 13 11.11 13.2 10.6 13.2 L 9.93 13.2 C 9.6 13.2 9.33 12.93 9.33 12.6 C 9.33 12.27 9.6 12 9.93 12 L 10.6 12 C 10.79 12 10.98 11.92 11.12 11.79 C 11.26 11.65 11.33 11.46 11.33 11.27 Z M 0 4.6 L 0 3.27 C 0 2.2 0.87 1.33 1.93 1.33 L 4.6 1.33 C 4.93 1.33 5.2 1.6 5.2 1.93 C 5.2 2.26 4.93 2.53 4.6 2.53 L 1.93 2.53 C 1.53 2.53 1.2 2.86 1.2 3.27 L 1.2 4.6 C 1.2 4.79 1.28 4.98 1.41 5.12 C 1.55 5.26 1.74 5.33 1.93 5.33 L 4.6 5.33 C 4.93 5.33 5.2 5.6 5.2 5.93 C 5.2 6.26 4.93 6.53 4.6 6.53 L 1.93 6.53 C 1.42 6.53 0.93 6.33 0.57 5.97 C 0.2 5.6 0 5.11 0 4.6 Z M 13.33 4.6 L 13.33 3.27 C 13.33 3.07 13.26 2.89 13.12 2.75 C 12.98 2.61 12.79 2.53 12.6 2.53 L 9.93 2.53 C 9.6 2.53 9.33 2.26 9.33 1.93 C 9.33 1.6 9.6 1.33 9.93 1.33 L 12.6 1.33 C 13.11 1.33 13.6 1.54 13.97 1.9 C 14.33 2.26 14.53 2.75 14.53 3.27 L 14.53 4.6 C 14.53 5.11 14.33 5.6 13.97 5.97 C 13.6 6.33 13.11 6.53 12.6 6.53 L 9.93 6.53 C 9.6 6.53 9.33 6.26 9.33 5.93 C 9.33 5.6 9.6 5.33 9.93 5.33 L 12.6 5.33 C 12.79 5.33 12.98 5.26 13.12 5.12 C 13.26 4.98 13.33 4.79 13.33 4.6 Z"],
  "align-end-vertical": [1.33, 1.33, "M 13.33 13.93 L 13.33 0.6 C 13.33 0.27 13.6 0 13.93 0 C 14.26 0 14.53 0.27 14.53 0.6 L 14.53 13.93 C 14.53 14.26 14.26 14.53 13.93 14.53 C 13.6 14.53 13.33 14.26 13.33 13.93 Z M 10.67 9.93 C 10.67 9.53 10.34 9.2 9.93 9.2 L 6.6 9.2 C 6.19 9.2 5.87 9.53 5.87 9.93 L 5.87 11.27 C 5.87 11.67 6.19 12 6.6 12 L 9.93 12 C 10.34 12 10.67 11.67 10.67 11.27 L 10.67 9.93 Z M 10.67 3.27 C 10.67 2.86 10.34 2.53 9.93 2.53 L 1.93 2.53 C 1.53 2.53 1.2 2.86 1.2 3.27 L 1.2 4.6 C 1.2 5 1.53 5.33 1.93 5.33 L 9.93 5.33 C 10.34 5.33 10.67 5 10.67 4.6 L 10.67 3.27 Z M 11.87 11.27 C 11.87 12.33 11 13.2 9.93 13.2 L 6.6 13.2 C 5.53 13.2 4.67 12.33 4.67 11.27 L 4.67 9.93 C 4.67 8.87 5.53 8 6.6 8 L 9.93 8 C 11 8 11.87 8.87 11.87 9.93 L 11.87 11.27 Z M 11.87 4.6 C 11.87 5.67 11 6.53 9.93 6.53 L 1.93 6.53 C 0.87 6.53 0 5.67 0 4.6 L 0 3.27 C 0 2.2 0.87 1.33 1.93 1.33 L 9.93 1.33 C 11 1.33 11.87 2.2 11.87 3.27 L 11.87 4.6 Z"],
  "align-left": [2, 3.33, "M 9.93 9.33 C 10.26 9.33 10.53 9.6 10.53 9.93 C 10.53 10.26 10.26 10.53 9.93 10.53 L 0.6 10.53 C 0.27 10.53 0 10.26 0 9.93 C 0 9.6 0.27 9.33 0.6 9.33 L 9.93 9.33 Z M 8.6 4.67 C 8.93 4.67 9.2 4.94 9.2 5.27 C 9.2 5.6 8.93 5.87 8.6 5.87 L 0.6 5.87 C 0.27 5.87 0 5.6 0 5.27 C 0 4.94 0.27 4.67 0.6 4.67 L 8.6 4.67 Z M 12.6 0 C 12.93 0 13.2 0.27 13.2 0.6 C 13.2 0.93 12.93 1.2 12.6 1.2 L 0.6 1.2 C 0.27 1.2 0 0.93 0 0.6 C 0 0.27 0.27 0 0.6 0 L 12.6 0 Z"],
  "align-center": [2, 3.33, "M 11.27 9.33 C 11.6 9.33 11.87 9.6 11.87 9.93 C 11.87 10.26 11.6 10.53 11.27 10.53 L 1.93 10.53 C 1.6 10.53 1.33 10.26 1.33 9.93 C 1.33 9.6 1.6 9.33 1.93 9.33 L 11.27 9.33 Z M 9.93 4.67 C 10.26 4.67 10.53 4.94 10.53 5.27 C 10.53 5.6 10.26 5.87 9.93 5.87 L 3.27 5.87 C 2.94 5.87 2.67 5.6 2.67 5.27 C 2.67 4.94 2.94 4.67 3.27 4.67 L 9.93 4.67 Z M 12.6 0 C 12.93 0 13.2 0.27 13.2 0.6 C 13.2 0.93 12.93 1.2 12.6 1.2 L 0.6 1.2 C 0.27 1.2 0 0.93 0 0.6 C 0 0.27 0.27 0 0.6 0 L 12.6 0 Z"],
  "align-right": [2, 3.33, "M 12.6 9.33 C 12.93 9.33 13.2 9.6 13.2 9.93 C 13.2 10.26 12.93 10.53 12.6 10.53 L 3.27 10.53 C 2.94 10.53 2.67 10.26 2.67 9.93 C 2.67 9.6 2.94 9.33 3.27 9.33 L 12.6 9.33 Z M 12.6 4.67 C 12.93 4.67 13.2 4.94 13.2 5.27 C 13.2 5.6 12.93 5.87 12.6 5.87 L 4.6 5.87 C 4.27 5.87 4 5.6 4 5.27 C 4 4.94 4.27 4.67 4.6 4.67 L 12.6 4.67 Z M 12.6 0 C 12.93 0 13.2 0.27 13.2 0.6 C 13.2 0.93 12.93 1.2 12.6 1.2 L 0.6 1.2 C 0.27 1.2 0 0.93 0 0.6 C 0 0.27 0.27 0 0.6 0 L 12.6 0 Z"],
  "align-justify": [2, 3.33, "M 12.6 9.33 C 12.93 9.33 13.2 9.6 13.2 9.93 C 13.2 10.26 12.93 10.53 12.6 10.53 L 0.6 10.53 C 0.27 10.53 0 10.26 0 9.93 C 0 9.6 0.27 9.33 0.6 9.33 L 12.6 9.33 Z M 12.6 4.67 C 12.93 4.67 13.2 4.94 13.2 5.27 C 13.2 5.6 12.93 5.87 12.6 5.87 L 0.6 5.87 C 0.27 5.87 0 5.6 0 5.27 C 0 4.94 0.27 4.67 0.6 4.67 L 12.6 4.67 Z M 12.6 0 C 12.93 0 13.2 0.27 13.2 0.6 C 13.2 0.93 12.93 1.2 12.6 1.2 L 0.6 1.2 C 0.27 1.2 0 0.93 0 0.6 C 0 0.27 0.27 0 0.6 0 L 12.6 0 Z"],
  "join-miter": [3.4, 3.4, "M 0 9.6 L 0 0.6 C 0 0.27 0.27 0 0.6 0 L 9.6 0 C 9.93 0 10.2 0.27 10.2 0.6 C 10.2 0.93 9.93 1.2 9.6 1.2 L 1.2 1.2 L 1.2 9.6 C 1.2 9.93 0.93 10.2 0.6 10.2 C 0.27 10.2 0 9.93 0 9.6 Z"],
  "join-round": [3.4, 3.4, "M 0 9.6 L 0 4.6 C 0 3.17 0.36 1.99 1.18 1.18 C 1.99 0.36 3.17 0 4.6 0 L 9.6 0 C 9.93 0 10.2 0.27 10.2 0.6 C 10.2 0.93 9.93 1.2 9.6 1.2 L 4.6 1.2 C 3.36 1.2 2.54 1.51 2.02 2.02 C 1.51 2.54 1.2 3.36 1.2 4.6 L 1.2 9.6 C 1.2 9.93 0.93 10.2 0.6 10.2 C 0.27 10.2 0 9.93 0 9.6 Z"],
  "join-bevel": [3.4, 3.4, "M 0 9.6 L 0 4.6 C 0 4.44 0.06 4.29 0.18 4.18 L 4.18 0.18 L 4.27 0.1 C 4.36 0.04 4.48 0 4.6 0 L 9.6 0 C 9.93 0 10.2 0.27 10.2 0.6 C 10.2 0.93 9.93 1.2 9.6 1.2 L 4.85 1.2 L 1.2 4.85 L 1.2 9.6 C 1.2 9.93 0.93 10.2 0.6 10.2 C 0.27 10.2 0 9.93 0 9.6 Z"],
  "order-start": [3.4, 2.4, "M 0 10.6 L 0 0.6 C 0 0.27 0.27 0 0.6 0 C 0.93 0 1.2 0.27 1.2 0.6 L 1.2 10.6 C 1.2 10.93 0.93 11.2 0.6 11.2 C 0.27 11.2 0 10.93 0 10.6 Z M 5.6 8 C 5.93 8 6.2 8.27 6.2 8.6 C 6.2 8.93 5.93 9.2 5.6 9.2 L 2.6 9.2 C 2.27 9.2 2 8.93 2 8.6 C 2 8.27 2.27 8 2.6 8 L 5.6 8 Z M 7.6 5 C 7.93 5 8.2 5.27 8.2 5.6 C 8.2 5.93 7.93 6.2 7.6 6.2 L 2.6 6.2 C 2.27 6.2 2 5.93 2 5.6 C 2 5.27 2.27 5 2.6 5 L 7.6 5 Z M 10.6 2 C 10.93 2 11.2 2.27 11.2 2.6 C 11.2 2.93 10.93 3.2 10.6 3.2 L 2.6 3.2 C 2.27 3.2 2 2.93 2 2.6 C 2 2.27 2.27 2 2.6 2 L 10.6 2 Z"],
  "order-center": [2.4, 4.4, "M 7.6 6 C 7.93 6 8.2 6.27 8.2 6.6 C 8.2 6.93 7.93 7.2 7.6 7.2 L 3.6 7.2 C 3.27 7.2 3 6.93 3 6.6 C 3 6.27 3.27 6 3.6 6 L 7.6 6 Z M 9.1 3 C 9.43 3 9.7 3.27 9.7 3.6 C 9.7 3.93 9.43 4.2 9.1 4.2 L 2.1 4.2 C 1.77 4.2 1.5 3.93 1.5 3.6 C 1.5 3.27 1.77 3 2.1 3 L 9.1 3 Z M 10.6 0 C 10.93 0 11.2 0.27 11.2 0.6 C 11.2 0.93 10.93 1.2 10.6 1.2 L 0.6 1.2 C 0.27 1.2 0 0.93 0 0.6 C 0 0.27 0.27 0 0.6 0 L 10.6 0 Z"],
  "order-end": [3.4, 2.4, "M 8 10.6 L 8 0.6 C 8 0.27 8.27 0 8.6 0 C 8.93 0 9.2 0.27 9.2 0.6 L 9.2 10.6 C 9.2 10.93 8.93 11.2 8.6 11.2 C 8.27 11.2 8 10.93 8 10.6 Z M 6.6 8 C 6.93 8 7.2 8.27 7.2 8.6 C 7.2 8.93 6.93 9.2 6.6 9.2 L 5.6 9.2 C 5.27 9.2 5 8.93 5 8.6 C 5 8.27 5.27 8 5.6 8 L 6.6 8 Z M 6.6 5 C 6.93 5 7.2 5.27 7.2 5.6 C 7.2 5.93 6.93 6.2 6.6 6.2 L 3.6 6.2 C 3.27 6.2 3 5.93 3 5.6 C 3 5.27 3.27 5 3.6 5 L 6.6 5 Z M 6.6 2 C 6.93 2 7.2 2.27 7.2 2.6 C 7.2 2.93 6.93 3.2 6.6 3.2 L 0.6 3.2 C 0.27 3.2 0 2.93 0 2.6 C 0 2.27 0.27 2 0.6 2 L 6.6 2 Z"],
};

export function PickGlyph({ name }: { name: string }) {
  const glyph = PICK_GLYPH[name];
  if (!glyph) return <PanelIcon name={name as LucideIconName} className="size-5" />;
  const [x, y, d] = glyph;
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
      <path d={d} fill="currentColor" fillRule="evenodd" transform={`translate(${x} ${y})`} />
    </svg>
  );
}

export function Segment<T extends string>({
  value,
  options,
  onChange,
  equal = false,
}: {
  value: T;
  options: { id: T; label: string; icon?: LucideIconName; glyph?: ReactNode }[];
  onChange: (id: T) => void;
  equal?: boolean;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const root = useRef<HTMLSpanElement>(null);
  const index = Math.max(0, options.findIndex((option) => option.id === value));
  const optionKey = options.map((option) => option.id).join("\0");
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const button = buttons.current[index];
    const parent = root.current;
    if (!button || !parent) return;
    const parentBox = parent.getBoundingClientRect();
    const buttonBox = button.getBoundingClientRect();
    setThumb({ left: buttonBox.left - parentBox.left, width: buttonBox.width });
  }, [index, optionKey]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <span ref={root} className="relative flex h-6 shrink-0 overflow-hidden rounded inset-ring inset-ring-white text-[14px] whitespace-nowrap">
      {thumb ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 rounded bg-white motion-reduce:transition-none"
          style={{
            left: thumb.left,
            width: thumb.width,
            transition: animate ? `left ${SECTION_MS}ms ${EASE_OUT}, width ${SECTION_MS}ms ${EASE_OUT}` : undefined,
          }}
        />
      ) : null}
      {options.map((option, optionIndex) => {
        const selected = value === option.id;
        const drawn = Boolean(option.icon || option.glyph);
        return (
          <button
            key={option.id}
            ref={(node) => {
              buttons.current[optionIndex] = node;
            }}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.id)}
            className={`relative z-10 flex items-center justify-center transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${drawn ? "group/pick size-6" : "px-1.5"} ${equal ? "flex-1" : ""} ${selected ? "text-black" : drawn ? "text-white" : "text-white/50 fine-hover:hover:text-white"}`}
          >
            {drawn ? (
              <span className={selected ? undefined : "opacity-50 transition-opacity duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] fine-hover:group-hover/pick:opacity-100 motion-reduce:transition-none"}>
                {option.glyph ?? <PickGlyph name={option.icon ?? ""} />}
              </span>
            ) : (
              option.label
            )}
          </button>
        );
      })}
    </span>
  );
}

const ANCHORS = [
  "top left", "top", "top right",
  "left", "center", "right",
  "bottom left", "bottom", "bottom right",
] as const;
export type Anchor = (typeof ANCHORS)[number];

/** Figma New / Anchor glyphs: 12 box, path offset [x, y]. */
const ANCHOR_GLYPH: Record<Anchor, [number, number, string]> = {
  "top left": [1, 1, "M1 0h8q1 0 1 1v4q0 1-1 1H7q-1 0-1 1v2q0 1-1 1H1q-1 0-1-1V1q0-1 1-1Z"],
  top: [1, 1, "M1 0h8q1 0 1 1v4q0 1-1 1H1q-1 0-1-1V1q0-1 1-1Z"],
  "top right": [1, 1, "M1 0h8q1 0 1 1v8q0 1-1 1H5q-1 0-1-1V7q0-1-1-1H1q-1 0-1-1V1q0-1 1-1Z"],
  left: [1, 1, "M1 0h4q1 0 1 1v8q0 1-1 1H1q-1 0-1-1V1q0-1 1-1Z"],
  center: [3, 3, "M1 0h4q1 0 1 1v4q0 1-1 1H1q-1 0-1-1V1q0-1 1-1Z"],
  right: [5, 1, "M1 0h4q1 0 1 1v8q0 1-1 1H1q-1 0-1-1V1q0-1 1-1Z"],
  "bottom left": [1, 1, "M1 0h4q1 0 1 1v2q0 1 1 1h2q1 0 1 1v4q0 1-1 1H1q-1 0-1-1V1q0-1 1-1Z"],
  bottom: [1, 5, "M1 0h8q1 0 1 1v4q0 1-1 1H1q-1 0-1-1V1q0-1 1-1Z"],
  "bottom right": [1, 1, "M5 0h4q1 0 1 1v8q0 1-1 1H1q-1 0-1-1V5q0-1 1-1h2q1 0 1-1V1q0-1 1-1Z"],
};

export function AnchorPick({ value, onChange }: { value: Anchor; onChange: (next: Anchor) => void }) {
  const index = ANCHORS.indexOf(value);
  return (
    <span className="relative grid h-[72px] w-full grid-cols-3 overflow-hidden rounded">
      <span
        aria-hidden
        className="pointer-events-none absolute h-6 w-1/3 rounded bg-white motion-reduce:transition-none"
        style={{
          left: `${(index % 3) * (100 / 3)}%`,
          top: Math.floor(index / 3) * 24,
          transition: `left ${SECTION_MS}ms ${EASE_OUT}, top ${SECTION_MS}ms ${EASE_OUT}`,
        }}
      />
      {ANCHORS.map((anchor) => {
        const selected = anchor === value;
        const [x, y, d] = ANCHOR_GLYPH[anchor];
        return (
          <button
            key={anchor}
            type="button"
            aria-label={anchor}
            aria-pressed={selected}
            onClick={() => onChange(anchor)}
            className={`group/pick relative z-10 flex h-6 items-center justify-center rounded ${selected ? "text-black" : "text-white"}`}
          >
            <svg
              viewBox="0 0 12 12"
              aria-hidden
              className={`size-3 ${selected ? "" : "opacity-50 transition-opacity duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/pick:opacity-100 motion-reduce:transition-none"}`}
            >
              <path d={d} transform={`translate(${x} ${y})`} fill="currentColor" />
            </svg>
          </button>
        );
      })}
      <span aria-hidden className="pointer-events-none absolute inset-0 z-20 rounded border border-white" />
    </span>
  );
}

export function IconPick<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; icon: LucideIconName }[];
  onChange: (id: T) => void;
}) {
  return (
    <Segment
      value={value}
      onChange={onChange}
      options={options.map((option) => ({ id: option.id, label: option.id, icon: option.icon }))}
    />
  );
}

export function Menu({
  options,
  groups,
  value,
  selected,
  onChange,
  onCreate,
  onItemAction,
  onRemove,
  mark,
}: {
  options?: string[];
  groups?: string[][];
  value: string;
  /** Несколько выбранных. Галочка и клик тогда не заменяют одно значение. */
  selected?: readonly string[];
  onChange: (next: string) => void;
  onCreate?: (label: string) => void;
  /** Появляется меню пункта. Без него три точки не рисуются. */
  onItemAction?: (option: string) => void;
  /** Крестик справа вместо трёх точек: убрать пункт из списка. */
  onRemove?: (option: string) => void;
  /** Left glyph. The check then sits on the right, as in the curve list. */
  mark?: (option: string) => ReactNode;
}) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const sections = groups ?? [options ?? []];
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  function syncEdges() {
    const el = scroller.current;
    if (!el) return;
    setEdges({
      top: el.scrollTop > 1,
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 1,
    });
  }

  const rowCount = sections.reduce((count, section) => count + section.length, 0);
  useLayoutEffect(() => {
    syncEdges();
  }, [rowCount]);

  const mask =
    edges.top || edges.bottom
      ? `linear-gradient(to bottom, ${edges.top ? "transparent" : "#000"} 0, #000 12px, #000 calc(100% - 16px), ${edges.bottom ? "transparent" : "#000"} 100%)`
      : undefined;

  return (
    <div className="flex flex-col bg-black p-1 text-[14px] leading-none text-white">
      <div
        ref={scroller}
        onScroll={syncEdges}
        className="overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ maxHeight: 24 * 6, maskImage: mask, WebkitMaskImage: mask }}
      >
      {sections.map((section, index) => (
        <div key={section[0] ?? index} className="flex flex-col">
          {section.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className="group/item flex h-6 items-center gap-1 rounded px-0.5 fine-hover:hover:inset-ring fine-hover:hover:inset-ring-white"
            >
              {mark ? (
                <span className="flex size-5 items-center justify-center">
                  {mark(option)}
                </span>
              ) : (
                <PanelIcon name="check" className={`size-5 ${(selected ? selected.includes(option) : option === value) ? "" : "opacity-0"}`} />
              )}
              <span className="min-w-0 flex-1 text-left">{option}</span>
              {mark ? (
                <PanelIcon name="check" className={`size-5 ${option === value ? "" : "opacity-0"}`} />
              ) : onRemove ? (
                <span
                  role="button"
                  aria-label={`Удалить ${option}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove(option);
                  }}
                  className="pointer-events-none flex size-4 shrink-0 items-center justify-center opacity-0 group-hover/item:pointer-events-auto group-hover/item:opacity-100"
                >
                  <PanelIcon name="x" className="size-4" strokeWidth={1.75} />
                </span>
              ) : onItemAction ? (
                <span
                  role="button"
                  aria-label={`Действие · ${option}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onItemAction(option);
                  }}
                  className="flex size-5 shrink-0 items-center justify-center opacity-0 group-hover/item:opacity-50"
                >
                  <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
                    <g fill="currentColor" transform="translate(2 2) scale(0.666667)">
                      <circle cx="5" cy="12" r="1" />
                      <circle cx="12" cy="12" r="1" />
                      <circle cx="19" cy="12" r="1" />
                    </g>
                  </svg>
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ))}
      </div>
      {creating ? (
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => {
            const label = event.currentTarget.value.trim();
            if (label) onCreate?.(label);
            setCreating(false);
            setDraft("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              event.stopPropagation();
              setCreating(false);
              setDraft("");
            }
          }}
          className="h-6 bg-transparent px-1 text-white outline-none"
        />
      ) : onCreate ? (
        <button type="button" onClick={() => setCreating(true)} className="mt-1 flex h-6 items-center gap-1 rounded px-0.5 fine-hover:hover:inset-ring fine-hover:hover:inset-ring-white">
          <PanelIcon name="plus" className="size-5" />
          New input
        </button>
      ) : null}
    </div>
  );
}

export function FloatingMenu({
  open,
  anchor,
  onClose,
  children,
}: {
  open: boolean;
  anchor: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
}) {
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [above, setAbove] = useState(false);
  const [span, setSpan] = useState(0);
  const [phase, setPhase] = useState<"measure" | "hold" | "play">("measure");
  const menuRef = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();
  const mounted = useDeferredMount(open, reduce, PANEL_EXIT_MS);
  const [shown, setShown] = useState(false);

  useLayoutEffect(() => {
    if (!mounted) {
      setShown(false);
      setPhase("measure");
      setAbove(false);
      setSpan(0);
      setBox(null);
      return;
    }
    if (!open) {
      setShown(false);
      return;
    }
    setShown(false);
    setPhase("measure");
  }, [mounted, open]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const node = anchor.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const panel = node.closest("section");
      if (panel) {
        const bounds = panel.getBoundingClientRect();
        const inside = rect.bottom > bounds.top && rect.top < bounds.bottom;
        if (!inside) {
          onClose();
          return;
        }
      }
      setBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    };
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      onClose();
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, anchor, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!open || !menu || !box || phase !== "measure") return;
    const height = menu.offsetHeight;
    const pad = 8;
    const width = Math.max(0, box.width - 4);
    let left = box.left;
    const right = left + 2 + width;
    if (right > window.innerWidth - pad) left -= right - (window.innerWidth - pad);
    if (left + 2 < pad) left = pad - 2;
    const spaceBelow = window.innerHeight - (box.top + box.height + 2) - pad;
    const spaceAbove = box.top - 2 - pad;
    const nextAbove = height > spaceBelow && spaceAbove >= height;
    const placed = nextAbove === above && height === span && Math.abs(left - box.left) <= 0.5;
    if (Math.abs(left - box.left) > 0.5) setBox({ ...box, left });
    if (nextAbove !== above) setAbove(nextAbove);
    if (height !== span) setSpan(height);
    if (placed) setPhase("hold");
  }, [open, box, above, span, phase]);

  useLayoutEffect(() => {
    if (!open || phase !== "hold") return;
    setPhase("play");
  }, [open, phase]);

  useLayoutEffect(() => {
    if (!open || phase !== "play") return;
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, [open, phase]);

  if (!mounted || !box) return null;
  const close = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    onClose();
  };
  return createPortal(
    <>
      <button type="button" aria-label="Закрыть меню" data-no-press="" className="fixed z-[110] cursor-default" style={{ top: 0, left: 0, right: 0, height: box.top }} onClick={close} />
      <button type="button" aria-label="Закрыть меню" data-no-press="" className="fixed z-[110] cursor-default" style={{ top: box.top + box.height, left: 0, right: 0, bottom: 0 }} onClick={close} />
      <button type="button" aria-label="Закрыть меню" data-no-press="" className="fixed z-[110] cursor-default" style={{ top: box.top, left: 0, width: box.left, height: box.height }} onClick={close} />
      <button type="button" aria-label="Закрыть меню" data-no-press="" className="fixed z-[110] cursor-default" style={{ top: box.top, left: box.left + box.width, right: 0, height: box.height }} onClick={close} />
      <div
        ref={menuRef}
        data-chrome=""
        className={`fixed z-[120] overflow-hidden rounded-lg border border-white ${above ? "origin-bottom" : "origin-top"} ${phase === "play" && !reduce ? "transition-[opacity,transform]" : ""} ${shown ? "opacity-100" : "pointer-events-none opacity-0"}`}
        style={{
          ...arealType,
          top: above ? box.top - 2 - span : box.top + box.height + 2,
          left: box.left + 2,
          width: Math.max(0, box.width - 4),
          visibility: phase === "play" ? "visible" : "hidden",
          transform: shown ? undefined : above ? "translateY(4px) scale(0.98)" : "translateY(-4px) scale(0.98)",
          transitionDuration: reduce || phase !== "play" ? undefined : shown ? `${PANEL_ENTER_MS}ms` : `${PANEL_EXIT_MS}ms`,
          transitionTimingFunction: EASE_OUT,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

