"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  readPanelLayout,
  writePanelSettings,
  type ChromeWindowId,
} from "../lib/panel-theme";

export type FloatWindowId = "scene" | ChromeWindowId;
import {
  DEFAULT_DOCK_CORNER,
  DOCK_BAR_H,
  DOCK_DRAG_PX,
  DOCK_INSET,
  PANEL_DOCK_GAP,
  PANEL_ENTER_MS,
  PANEL_HEIGHT_MIN,
  PANEL_WIDTH,
  bindPointerDrag,
  lockPanelTextSelect,
  pointerHeld,
  clampDockPos,
  clampPanelHeight,
  clampPanelPos,
  clampPanelWidth,
  dockPosForCorner,
  dockedPanelPos,
  dockedPanelX,
  isPanelMoveTarget,
  nearestDockCorner,
  panelMaxHeightPx,
  shouldMagnetPanel,
  type DockCorner,
} from "./chrome";
import { useViewportSize } from "./use-chrome-visible";

/** Last painted dock size — next scene paints here instead of the default slot. */
const lastDockBarW = new Map<string, number>();

export function readLastDockBarW(storeId: string) {
  return lastDockBarW.get(storeId);
}

export function writeLastDockBarW(storeId: string, width: number) {
  lastDockBarW.set(storeId, width);
}

export function usePanelWindow({
  panelId,
  layoutPanelId,
  legacyPanelIds = [],
  barW,
  defaultDockCorner = DEFAULT_DOCK_CORNER,
}: {
  panelId: string;
  layoutPanelId?: string;
  legacyPanelIds?: readonly string[];
  /** Measured Dock Bar width (grows as buttons appear). */
  barW: number;
  defaultDockCorner?: DockCorner;
}) {
  const layoutStoreId = layoutPanelId ?? panelId;
  const legacyPanelKey = legacyPanelIds.join("\0");
  const [panelWidth, setPanelWidth] = useState(PANEL_WIDTH);
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  const [panelFloat, setPanelFloat] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [chromeFloat, setChromeFloat] = useState<
    Partial<Record<ChromeWindowId, { x: number; y: number }>>
  >({});
  const [chromeMoving, setChromeMoving] = useState<ChromeWindowId | null>(
    null,
  );
  const windowZSeq = useRef(100);
  const [windowZ, setWindowZ] = useState<Partial<Record<FloatWindowId, number>>>(
    {},
  );
  const raiseWindow = (id: FloatWindowId) => {
    setWindowZ((prev) => {
      const max = Math.max(100, ...Object.values(prev));
      if (prev[id] === max) return prev;
      const next = max + 1;
      windowZSeq.current = next;
      return { ...prev, [id]: next };
    });
  };
  const chromeDockedXRef = useRef<(id: ChromeWindowId) => number>(
    () => DOCK_INSET,
  );
  const [dockCorner, setDockCorner] = useState<DockCorner>(defaultDockCorner);
  const [dockPos, setDockPos] = useState(() =>
    dockPosForCorner(defaultDockCorner, barW, 1280, 800),
  );
  const [dockDragging, setDockDragging] = useState(false);
  const [dockSnap, setDockSnap] = useState(false);
  const [panelResizing, setPanelResizing] = useState(false);
  const [panelMoving, setPanelMoving] = useState(false);
  const { vw: viewportW, vh: viewportH } = useViewportSize();
  const dockMovedRef = useRef(false);
  const barWRef = useRef(barW);
  const dockDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const panelResizeRef = useRef<{
    edge: "x" | "y" | "xy";
    cursor: "x" | "y" | "xy-nwse" | "xy-nesw";
    pointerId: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    growX: 1 | 2 | -1;
    growY: 1 | -1;
  } | null>(null);
  const panelMoveRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    width: number;
    height: number;
    moved: boolean;
    magnet: boolean;
    lastPos: { x: number; y: number } | null;
  } | null>(null);
  const chromeMoveRef = useRef<{
    id: ChromeWindowId;
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    width: number;
    height: number;
    moved: boolean;
    magnet: boolean;
    lastPos: { x: number; y: number } | null;
  } | null>(null);

  useEffect(() => {
    barWRef.current = barW;
  });

  useEffect(() => {
    if (!dockSnap) return;
    const id = window.setTimeout(() => setDockSnap(false), PANEL_ENTER_MS);
    return () => window.clearTimeout(id);
  }, [dockSnap]);

  useLayoutEffect(() => {
    const parsed = readPanelLayout(
      panelId,
      layoutPanelId,
      legacyPanelKey ? legacyPanelKey.split("\0") : [],
    );
    if (parsed.panelWidth != null) setPanelWidth(parsed.panelWidth);
    if (parsed.panelHeight != null) setPanelHeight(parsed.panelHeight);
    if (parsed.panelFloat) setPanelFloat(parsed.panelFloat);
    if (parsed.chromeFloat) setChromeFloat(parsed.chromeFloat);
    setDockCorner(parsed.dockSlot ?? defaultDockCorner);
  }, [defaultDockCorner, layoutPanelId, legacyPanelKey, panelId]);

  useEffect(() => {
    setPanelWidth((w) => clampPanelWidth(w, viewportW));
    const maxH = panelMaxHeightPx(
      dockCorner.startsWith("bottom"),
      dockPosForCorner(dockCorner, barWRef.current, viewportW, viewportH).y,
      viewportH,
    );
    setPanelHeight((h) => (h == null ? null : clampPanelHeight(h, maxH)));
    setPanelFloat((pos) => {
      if (pos == null) return null;
      const w = clampPanelWidth(panelWidth, viewportW);
      const h = panelHeight ?? PANEL_HEIGHT_MIN;
      const next = clampPanelPos(pos.x, pos.y, w, h, viewportW, viewportH);
      if (next.x === pos.x && next.y === pos.y) return pos;
      return next;
    });
    setChromeFloat((prev) => {
      const w = clampPanelWidth(panelWidth, viewportW);
      const h = PANEL_HEIGHT_MIN;
      let changed = false;
      const next = { ...prev };
      for (const id of Object.keys(prev) as ChromeWindowId[]) {
        const pos = prev[id];
        if (!pos) continue;
        const clamped = clampPanelPos(pos.x, pos.y, w, h, viewportW, viewportH);
        if (clamped.x !== pos.x || clamped.y !== pos.y) {
          next[id] = clamped;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [dockCorner, panelHeight, panelWidth, viewportH, viewportW]);

  const startPanelResize =
    (edge: "x" | "y" | "xy") =>
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const el = document.getElementById(panelId);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cornerNwse =
        dockCorner.endsWith("right") === dockCorner.startsWith("bottom");
      const centered = dockCorner.endsWith("center");
      panelResizeRef.current = {
        edge,
        cursor:
          edge === "x"
            ? "x"
            : edge === "y"
              ? "y"
              : cornerNwse
                ? "xy-nwse"
                : "xy-nesw",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startW: rect.width,
        // Height drag is a max-height ceiling. Start from that ceiling, not the
        // hugged rect — collapsed sections are shorter than panelHeight, and
        // measuring hug here would jump the cap (and the window) on the first move.
        startH:
          edge === "y" || edge === "xy"
            ? Math.max(rect.height, panelHeight ?? PANEL_HEIGHT_MIN)
            : rect.height,
        growX: dockCorner.endsWith("right") ? -1 : centered ? 2 : 1,
        growY: dockCorner.startsWith("bottom") ? -1 : 1,
      };
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* already released */
      }
      setPanelResizing(true);
    };

  useEffect(() => {
    if (!panelResizing) return;
    const drag = panelResizeRef.current;
    if (!drag) {
      setPanelResizing(false);
      return;
    }
    document.documentElement.dataset.panelResizing = drag.cursor;
    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;
      if (!pointerHeld(event)) {
        onUp(event);
        return;
      }
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const maxH = panelMaxHeightPx(
        dockCorner.startsWith("bottom"),
        dockPosForCorner(dockCorner, barWRef.current, vw, vh).y,
        vh,
      );
      if (drag.edge === "x" || drag.edge === "xy") {
        setPanelWidth(
          clampPanelWidth(
            drag.startW + drag.growX * (event.clientX - drag.startX),
            vw,
          ),
        );
      }
      if (drag.edge === "y" || drag.edge === "xy") {
        setPanelHeight(
          clampPanelHeight(
            drag.startH + drag.growY * (event.clientY - drag.startY),
            maxH,
          ),
        );
      }
    };
    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;
      panelResizeRef.current = null;
      setPanelResizing(false);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const maxH = panelMaxHeightPx(
        dockCorner.startsWith("bottom"),
        dockPosForCorner(dockCorner, barWRef.current, vw, vh).y,
        vh,
      );
      const w =
        drag.edge === "x" || drag.edge === "xy"
          ? clampPanelWidth(
              drag.startW + drag.growX * (event.clientX - drag.startX),
              vw,
            )
          : null;
      const h =
        drag.edge === "y" || drag.edge === "xy"
          ? clampPanelHeight(
              drag.startH + drag.growY * (event.clientY - drag.startY),
              maxH,
            )
          : null;
      if (w != null) setPanelWidth(w);
      if (h != null) setPanelHeight(h);
      writePanelSettings(layoutStoreId, {
        ...(w != null ? { panelWidth: w } : {}),
        ...(h != null ? { panelHeight: h } : {}),
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      delete document.documentElement.dataset.panelResizing;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dockCorner, layoutStoreId, panelResizing]);

  const startPanelMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    raiseWindow("scene");
    if (event.button !== 0 || panelResizing) return;
    if (!isPanelMoveTarget(event.target)) return;
    event.preventDefault();
    const pointerId = event.pointerId;
    const el = event.currentTarget;
    lockPanelTextSelect(el, pointerId);
    const rect = el.getBoundingClientRect();
    const drag = {
      pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
      magnet: panelFloat == null,
      lastPos: panelFloat,
    };
    panelMoveRef.current = drag;

    bindPointerDrag(pointerId, {
      onMove(ev) {
        const nextDrag = panelMoveRef.current;
        if (!nextDrag) return;
        const dx = ev.clientX - nextDrag.startX;
        const dy = ev.clientY - nextDrag.startY;
        if (!nextDrag.moved && Math.hypot(dx, dy) < DOCK_DRAG_PX) return;
        if (!nextDrag.moved) {
          nextDrag.moved = true;
          setPanelMoving(true);
        }
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const bw = barWRef.current;
        const bar = dockPosForCorner(dockCorner, bw, vw, vh);
        const next = clampPanelPos(
          nextDrag.originX + dx,
          nextDrag.originY + dy,
          nextDrag.width,
          nextDrag.height,
          vw,
          vh,
        );
        const docked = dockedPanelPos(
          dockCorner,
          { x: bar.x, y: bar.y, w: bw },
          nextDrag.width,
          nextDrag.height,
          vw,
        );
        const buttons = { x: bar.x, y: bar.y, w: bw, h: DOCK_BAR_H };
        const magnet = shouldMagnetPanel(
          { x: next.x, y: next.y, w: nextDrag.width, h: nextDrag.height },
          docked,
          buttons,
        );
        nextDrag.magnet = magnet;
        nextDrag.lastPos = magnet ? null : next;
        setPanelFloat(magnet ? null : next);
      },
      onEnd() {
        if (el.hasPointerCapture(pointerId)) {
          el.releasePointerCapture(pointerId);
        }
        delete document.documentElement.dataset.panelMoving;
        const nextDrag = panelMoveRef.current;
        panelMoveRef.current = null;
        setPanelMoving(false);
        if (!nextDrag?.moved) return;
        const suppressClick = (click: MouseEvent) => {
          click.preventDefault();
          click.stopPropagation();
        };
        window.addEventListener("click", suppressClick, true);
        window.setTimeout(() => {
          window.removeEventListener("click", suppressClick, true);
        }, 0);
        const stored = nextDrag.lastPos;
        writePanelSettings(layoutStoreId, { panelFloat: stored });
        setPanelFloat(stored);
      },
    });
  };

  const startChromeMove =
    (id: ChromeWindowId) => (event: ReactPointerEvent<HTMLDivElement>) => {
      raiseWindow(id);
      if (event.button !== 0 || panelResizing) return;
      if (!isPanelMoveTarget(event.target)) return;
      event.preventDefault();
      const pointerId = event.pointerId;
      const el = event.currentTarget;
      lockPanelTextSelect(el, pointerId);
      const rect = el.getBoundingClientRect();
      const drag = {
        id,
        pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: rect.left,
        originY: rect.top,
        width: rect.width,
        height: rect.height,
        moved: false,
        magnet: chromeFloat[id] == null,
        lastPos: chromeFloat[id] ?? null,
      };
      chromeMoveRef.current = drag;

      bindPointerDrag(pointerId, {
        onMove(ev) {
          const nextDrag = chromeMoveRef.current;
          if (!nextDrag || nextDrag.id !== id) return;
          const dx = ev.clientX - nextDrag.startX;
          const dy = ev.clientY - nextDrag.startY;
          if (!nextDrag.moved && Math.hypot(dx, dy) < DOCK_DRAG_PX) return;
          if (!nextDrag.moved) {
            nextDrag.moved = true;
            setChromeMoving(id);
          }
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const bw = barWRef.current;
          const bar = dockPosForCorner(dockCorner, bw, vw, vh);
          const next = clampPanelPos(
            nextDrag.originX + dx,
            nextDrag.originY + dy,
            nextDrag.width,
            nextDrag.height,
            vw,
            vh,
          );
          const docked = {
            x: chromeDockedXRef.current(id),
            y: dockCorner.startsWith("bottom")
              ? bar.y - PANEL_DOCK_GAP - nextDrag.height
              : bar.y + DOCK_BAR_H + PANEL_DOCK_GAP,
          };
          const buttons = { x: bar.x, y: bar.y, w: bw, h: DOCK_BAR_H };
          const magnet = shouldMagnetPanel(
            {
              x: next.x,
              y: next.y,
              w: nextDrag.width,
              h: nextDrag.height,
            },
            docked,
            buttons,
            false,
          );
          nextDrag.magnet = magnet;
          nextDrag.lastPos = magnet ? null : next;
          setChromeFloat((prev) => {
            if (magnet) {
              if (prev[id] == null) return prev;
              const copy = { ...prev };
              delete copy[id];
              return copy;
            }
            return { ...prev, [id]: next };
          });
        },
        onEnd() {
          if (el.hasPointerCapture(pointerId)) {
            el.releasePointerCapture(pointerId);
          }
          delete document.documentElement.dataset.panelMoving;
          const nextDrag = chromeMoveRef.current;
          chromeMoveRef.current = null;
          setChromeMoving(null);
          if (!nextDrag?.moved) return;
          const suppressClick = (click: MouseEvent) => {
            click.preventDefault();
            click.stopPropagation();
          };
          window.addEventListener("click", suppressClick, true);
          window.setTimeout(() => {
            window.removeEventListener("click", suppressClick, true);
          }, 0);
          const stored = nextDrag.lastPos;
          setChromeFloat((prev) => {
            const copy = { ...prev };
            if (stored == null) delete copy[id];
            else copy[id] = stored;
            writePanelSettings(layoutStoreId, {
              chromeFloat: Object.keys(copy).length > 0 ? copy : null,
            });
            return copy;
          });
        },
      });
    };

  const persistDock = (corner: DockCorner) => {
    setDockCorner(corner);
    writePanelSettings(layoutStoreId, { dockSlot: corner });
  };

  const resetChromeLayout = () => {
    setPanelFloat(null);
    setChromeFloat({});
    writePanelSettings(layoutStoreId, {
      panelFloat: null,
      chromeFloat: null,
    });
  };

  const onDockPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const hit = event.target;
    if (
      hit instanceof Element &&
      hit.closest("input, textarea, [data-dock-search]")
    ) {
      return;
    }
    const pointerId = event.pointerId;
    const barEl = event.currentTarget;
    const origin = dockPosForCorner(
      dockCorner,
      barWRef.current,
      window.innerWidth,
      window.innerHeight,
    );
    dockMovedRef.current = false;
    dockDragRef.current = {
      pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: origin.x,
      originY: origin.y,
      moved: false,
    };

    bindPointerDrag(pointerId, {
      onMove(ev) {
        const next = dockDragRef.current;
        if (!next) return;
        const dx = ev.clientX - next.startX;
        const dy = ev.clientY - next.startY;
        if (!next.moved && Math.hypot(dx, dy) < DOCK_DRAG_PX) return;
        if (!next.moved) {
          next.moved = true;
          dockMovedRef.current = true;
          setDockDragging(true);
          try {
            barEl.setPointerCapture(pointerId);
          } catch {
            /* already released */
          }
        }
        ev.preventDefault();
        setDockPos(
          clampDockPos(
            next.originX + dx,
            next.originY + dy,
            barWRef.current,
            window.innerWidth,
            window.innerHeight,
          ),
        );
      },
      onEnd(ev) {
        if (barEl.hasPointerCapture(pointerId)) {
          barEl.releasePointerCapture(pointerId);
        }
        const next = dockDragRef.current;
        dockDragRef.current = null;
        setDockDragging(false);
        if (!next?.moved) return;
        setDockSnap(true);
        const bw = barWRef.current;
        persistDock(
          nearestDockCorner(
            ev.clientX - bw / 2,
            ev.clientY - DOCK_BAR_H / 2,
            bw,
          ),
        );
      },
    });
  };

  const restPos = dockPosForCorner(dockCorner, barW, viewportW, viewportH);
  const shownPos = dockDragging ? dockPos : restPos;
  const layoutCorner = dockDragging
    ? nearestDockCorner(shownPos.x, shownPos.y, barW, viewportW, viewportH)
    : dockCorner;
  const dockRight = layoutCorner.endsWith("right");
  const dockBottom = layoutCorner.startsWith("bottom");
  const dockCenter = layoutCorner.endsWith("center");
  const maxPanelH =
    panelFloat != null
      ? Math.max(PANEL_HEIGHT_MIN, viewportH - panelFloat.y - DOCK_INSET)
      : panelMaxHeightPx(dockBottom, shownPos.y, viewportH);
  const frameW = clampPanelWidth(panelWidth, viewportW);
  const frameH =
    panelHeight == null ? null : clampPanelHeight(panelHeight, maxPanelH);
  const dockedX = dockedPanelX(
    layoutCorner,
    shownPos.x,
    barW,
    frameW,
    viewportW,
  );

  return {
    panelFloat,
    dockDragging,
    dockSnap,
    dockMovedRef,
    panelResizing,
    panelMoving,
    viewportW,
    viewportH,
    layoutCorner,
    dockRight,
    dockBottom,
    dockCenter,
    shownPos,
    dockedX,
    maxPanelH,
    frameW,
    frameH,
    startPanelResize,
    startPanelMove,
    startChromeMove,
    chromeFloat,
    chromeMoving,
    windowZ,
    raiseWindow,
    chromeDockedXRef,
    onDockPointerDown,
    resetChromeLayout,
  };
}
