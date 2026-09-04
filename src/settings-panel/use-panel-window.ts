"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  parsePanelSettingsObject,
  writePanelSettings,
} from "../lib/panel-theme";
import {
  DOCK_BTN,
  DOCK_DRAG_PX,
  DOCK_INSET,
  PANEL_HEIGHT_MIN,
  PANEL_WIDTH,
  clampDockPos,
  clampPanelHeight,
  clampPanelPos,
  clampPanelWidth,
  dockPosForCorner,
  dockedPanelPos,
  isPanelMoveTarget,
  nearestDockCorner,
  panelMaxHeightPx,
  shouldMagnetPanel,
  type DockCorner,
} from "./chrome";
import { readMigratedPanelUi } from "./model";

export function usePanelWindow({
  panelId,
  legacyPanelIds = [],
  dockStackH,
}: {
  panelId: string;
  legacyPanelIds?: readonly string[];
  /** Gear column height for magnet (trigger + reset/copy + extra dock). */
  dockStackH: number;
}) {
  const legacyPanelKey = legacyPanelIds.join("\0");
  const [panelWidth, setPanelWidth] = useState(PANEL_WIDTH);
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  const [panelFloat, setPanelFloat] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [dockCorner, setDockCorner] = useState<DockCorner>("top-left");
  const [dockPos, setDockPos] = useState(() => dockPosForCorner("top-left"));
  const [dockDragging, setDockDragging] = useState(false);
  const [panelResizing, setPanelResizing] = useState(false);
  const [panelMoving, setPanelMoving] = useState(false);
  const [viewportW, setViewportW] = useState(1280);
  const [viewportH, setViewportH] = useState(800);
  const dockMovedRef = useRef(false);
  const dockStackHRef = useRef(dockStackH);
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
    growX: 1 | -1;
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

  useEffect(() => {
    dockStackHRef.current = dockStackH;
  });

  useLayoutEffect(() => {
    const raw = readMigratedPanelUi(
      panelId,
      ":panel-settings",
      legacyPanelKey ? legacyPanelKey.split("\0") : [],
    );
    const parsed = parsePanelSettingsObject(raw);
    if (parsed.panelWidth != null) setPanelWidth(parsed.panelWidth);
    if (parsed.panelHeight != null) setPanelHeight(parsed.panelHeight);
    if (parsed.panelFloat) setPanelFloat(parsed.panelFloat);
    const corner: DockCorner =
      parsed.dockCorner ??
      (parsed.dockX != null && parsed.dockY != null
        ? nearestDockCorner(parsed.dockX, parsed.dockY)
        : "top-left");
    setDockCorner(corner);
    setDockPos(dockPosForCorner(corner));
  }, [legacyPanelKey, panelId]);

  useEffect(() => {
    const onResize = () => {
      setViewportW(window.innerWidth);
      setViewportH(window.innerHeight);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    setPanelWidth((w) => clampPanelWidth(w, viewportW));
    const maxH = panelMaxHeightPx(
      dockCorner.startsWith("bottom"),
      dockPosForCorner(dockCorner, viewportW, viewportH).y,
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
        startH: rect.height,
        growX: dockCorner.endsWith("right") ? -1 : 1,
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
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const maxH = panelMaxHeightPx(
        dockCorner.startsWith("bottom"),
        dockPosForCorner(dockCorner, vw, vh).y,
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
        dockPosForCorner(dockCorner, vw, vh).y,
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
      writePanelSettings(panelId, {
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
  }, [dockCorner, panelId, panelResizing]);

  const startPanelMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || panelResizing) return;
    if (!isPanelMoveTarget(event.target)) return;
    const pointerId = event.pointerId;
    const el = event.currentTarget;
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

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const nextDrag = panelMoveRef.current;
      if (!nextDrag) return;
      const dx = ev.clientX - nextDrag.startX;
      const dy = ev.clientY - nextDrag.startY;
      if (!nextDrag.moved && Math.hypot(dx, dy) < DOCK_DRAG_PX) return;
      if (!nextDrag.moved) {
        nextDrag.moved = true;
        setPanelMoving(true);
        document.documentElement.dataset.panelMoving = "";
        try {
          el.setPointerCapture(pointerId);
        } catch {
          /* already released */
        }
      }
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const gear = dockPosForCorner(dockCorner, vw, vh);
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
        gear,
        nextDrag.width,
        nextDrag.height,
      );
      const stackH = dockStackHRef.current;
      const buttons = {
        x: gear.x,
        y: dockCorner.startsWith("bottom")
          ? gear.y + DOCK_BTN - stackH
          : gear.y,
        w: DOCK_BTN,
        h: stackH,
      };
      const magnet = shouldMagnetPanel(
        { x: next.x, y: next.y, w: nextDrag.width, h: nextDrag.height },
        docked,
        buttons,
      );
      nextDrag.magnet = magnet;
      nextDrag.lastPos = magnet ? null : next;
      setPanelFloat(magnet ? null : next);
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
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
      writePanelSettings(panelId, { panelFloat: stored });
      setPanelFloat(stored);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const persistDock = (corner: DockCorner) => {
    setDockCorner(corner);
    setDockPos(
      dockPosForCorner(corner, window.innerWidth, window.innerHeight),
    );
    writePanelSettings(panelId, { dockCorner: corner });
  };

  const onDockPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (event.button !== 0) return;
    const pointerId = event.pointerId;
    const origin = dockPosForCorner(
      dockCorner,
      window.innerWidth,
      window.innerHeight,
    );
    dockMovedRef.current = false;
    const drag = {
      pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: origin.x,
      originY: origin.y,
      moved: false,
    };
    dockDragRef.current = drag;

    try {
      event.currentTarget.setPointerCapture(pointerId);
    } catch {
      /* already released */
    }

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const next = dockDragRef.current;
      if (!next) return;
      const dx = ev.clientX - next.startX;
      const dy = ev.clientY - next.startY;
      if (!next.moved && Math.hypot(dx, dy) < DOCK_DRAG_PX) return;
      if (!next.moved) {
        next.moved = true;
        dockMovedRef.current = true;
        setDockDragging(true);
      }
      ev.preventDefault();
      setDockPos(
        clampDockPos(
          next.originX + dx,
          next.originY + dy,
          window.innerWidth,
          window.innerHeight,
        ),
      );
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      const next = dockDragRef.current;
      dockDragRef.current = null;
      setDockDragging(false);
      if (next?.moved) {
        persistDock(
          nearestDockCorner(
            next.originX + (ev.clientX - next.startX),
            next.originY + (ev.clientY - next.startY),
          ),
        );
      }
    };

    window.addEventListener("pointermove", onMove, { capture: true });
    window.addEventListener("pointerup", onUp, { capture: true });
    window.addEventListener("pointercancel", onUp, { capture: true });
  };

  const restPos = dockPosForCorner(dockCorner, viewportW, viewportH);
  const shownPos = dockDragging ? dockPos : restPos;
  const layoutCorner = dockDragging
    ? nearestDockCorner(shownPos.x, shownPos.y, viewportW, viewportH)
    : dockCorner;
  const dockRight = layoutCorner.endsWith("right");
  const dockBottom = layoutCorner.startsWith("bottom");
  const maxPanelH =
    panelFloat != null
      ? Math.max(PANEL_HEIGHT_MIN, viewportH - panelFloat.y - DOCK_INSET)
      : panelMaxHeightPx(dockBottom, shownPos.y, viewportH);
  const frameW = clampPanelWidth(panelWidth, viewportW);
  const frameH =
    panelHeight == null ? null : clampPanelHeight(panelHeight, maxPanelH);

  return {
    panelFloat,
    dockDragging,
    dockMovedRef,
    panelResizing,
    panelMoving,
    viewportH,
    layoutCorner,
    dockRight,
    dockBottom,
    shownPos,
    maxPanelH,
    frameW,
    frameH,
    startPanelResize,
    startPanelMove,
    onDockPointerDown,
  };
}
