"use client";

import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { movePanelRow, panelRowSlot, samePanelRowOrder } from "../lib/panel-rows";
import { DOCK_DRAG_PX, EASE_OUT, SECTION_MS, bindPointerDrag } from "./chrome";

type Lift = "black" | "white" | "bare";

/** Drag a `[data-sort-id]` list. The copy follows the pointer; the row left behind closes up. */
export function useRowOrderDrag(
  order: readonly string[],
  onOrder: (next: string[]) => void,
  options?: { axis?: "x" | "y"; lift?: Lift },
): {
  listRef: RefObject<HTMLDivElement | null>;
  onPointerDown: (id: string, event: ReactPointerEvent<HTMLElement>) => void;
  consumeDrag: () => boolean;
  lift: ReactNode;
} {
  const axis = options?.axis ?? "y";
  const liftTone = options?.lift ?? "black";
  const orderRef = useRef(order);
  orderRef.current = order;
  const onOrderRef = useRef(onOrder);
  onOrderRef.current = onOrder;
  const listRef = useRef<HTMLDivElement>(null);
  const liftRef = useRef<HTMLDivElement>(null);
  const liftPlaceRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const sourceRef = useRef<HTMLElement | null>(null);
  const draggedRef = useRef(false);
  const flipFrom = useRef<Map<string, number> | null>(null);
  const [lift, setLift] = useState<{ html: string; width: number; height: number } | null>(null);
  const orderKey = order.join("\0");

  function placeLift(x: number, y: number) {
    const place = liftPlaceRef.current;
    const node = liftRef.current;
    if (!place || !node) return;
    place.x = x;
    place.y = y;
    node.style.left = `${x - place.offsetX}px`;
    node.style.top = `${y - place.offsetY}px`;
  }

  useLayoutEffect(() => {
    const place = liftPlaceRef.current;
    if (!lift || !place) return;
    placeLift(place.x, place.y);
  }, [lift]);

  useLayoutEffect(() => {
    const from = flipFrom.current;
    flipFrom.current = null;
    const root = listRef.current;
    if (!from || !root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const nodes: HTMLElement[] = [];
    for (const node of root.querySelectorAll<HTMLElement>("[data-sort-id]")) {
      if (node.hasAttribute("data-tl-lift")) continue;
      const prev = from.get(node.dataset.sortId ?? "");
      if (prev == null) continue;
      const box = node.getBoundingClientRect();
      const delta = prev - (axis === "x" ? box.left : box.top);
      if (Math.abs(delta) < 0.5) continue;
      node.style.transition = "none";
      node.style.transform = axis === "x" ? `translateX(${delta}px)` : `translateY(${delta}px)`;
      nodes.push(node);
    }
    if (nodes.length === 0) return;
    root.getBoundingClientRect();
    for (const node of nodes) {
      node.style.transition = `transform ${SECTION_MS}ms ${EASE_OUT}`;
      node.style.transform = "";
    }
    const clear = window.setTimeout(() => {
      for (const node of nodes) node.style.transition = "";
    }, SECTION_MS);
    return () => window.clearTimeout(clear);
  }, [axis, orderKey]);

  function onPointerDown(id: string, event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0 || orderRef.current.length < 2) return;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    bindPointerDrag(pointerId, {
      onMove(ev) {
        if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < DOCK_DRAG_PX) return;
        const root = listRef.current;
        const item = root?.querySelector<HTMLElement>(`[data-sort-id="${CSS.escape(id)}"]`);
        if (!root || !item) return;
        if (!moved) {
          moved = true;
          draggedRef.current = true;
          document.documentElement.dataset.phaseDrag = "grab";
          const rect = item.getBoundingClientRect();
          liftPlaceRef.current = {
            x: ev.clientX,
            y: ev.clientY,
            offsetX: ev.clientX - rect.left,
            offsetY: ev.clientY - rect.top,
          };
          sourceRef.current = item;
          item.dataset.tlLift = "";
          setLift({ html: item.innerHTML, width: rect.width, height: rect.height });
        } else {
          placeLift(ev.clientX, ev.clientY);
        }
        const horizontal = axis === "x";
        const origin = horizontal ? root.getBoundingClientRect().left : root.getBoundingClientRect().top;
        const boxes = [...root.children]
          .filter((node): node is HTMLElement => node instanceof HTMLElement && node.hasAttribute("data-sort-id"))
          .map((node) => {
            const start = origin + (horizontal ? node.offsetLeft : node.offsetTop);
            const size = horizontal ? node.offsetWidth : node.offsetHeight;
            return { id: node.dataset.sortId ?? "", top: start, bottom: start + size };
          });
        const hit = panelRowSlot(boxes, id, horizontal ? ev.clientX : ev.clientY);
        const current = orderRef.current.filter((itemId) => boxes.some((box) => box.id === itemId));
        const next = hit ? movePanelRow(current, id, hit.index) : current;
        if (!hit || samePanelRowOrder(current, next)) return;
        const from = new Map<string, number>();
        for (const node of root.querySelectorAll<HTMLElement>("[data-sort-id]")) {
          const box = node.getBoundingClientRect();
          from.set(node.dataset.sortId ?? "", horizontal ? box.left : box.top);
        }
        flipFrom.current = from;
        onOrderRef.current(next);
      },
      onEnd() {
        delete document.documentElement.dataset.phaseDrag;
        if (sourceRef.current) delete sourceRef.current.dataset.tlLift;
        sourceRef.current = null;
        liftPlaceRef.current = null;
        setLift(null);
      },
    });
  }

  function consumeDrag() {
    if (!draggedRef.current) return false;
    draggedRef.current = false;
    return true;
  }

  const liftNode = lift
    ? createPortal(
        liftTone === "bare" ? (
          <div
            ref={liftRef}
            data-settings-panel=""
            className="pointer-events-none fixed z-[110] origin-top-left scale-[1.03] overflow-hidden rounded shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
            style={{ width: lift.width, height: lift.height }}
            dangerouslySetInnerHTML={{ __html: lift.html }}
          />
        ) : (
          <div
            ref={liftRef}
            data-settings-panel=""
            className="pointer-events-none fixed z-[110] origin-top-left scale-[1.03]"
            style={{ width: lift.width, height: lift.height }}
          >
            <div
              className={`size-full overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.28)] ${liftTone === "white" ? "bg-white" : "bg-black"}`}
              style={{ borderRadius: 8 }}
              dangerouslySetInnerHTML={{ __html: lift.html }}
            />
          </div>
        ),
        document.body,
      )
    : null;

  return { listRef, onPointerDown, consumeDrag, lift: liftNode };
}
