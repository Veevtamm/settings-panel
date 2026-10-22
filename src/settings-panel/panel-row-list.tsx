"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  movePanelRow,
  orderPanelRows,
  panelRowSlot,
  samePanelRowOrder,
} from "../lib/panel-rows";
import { cn } from "../lib/utils";
import { DOCK_DRAG_PX, bindPointerDrag } from "./chrome";
import { ROW_HOVER } from "./row";

function readRowFile(panelId: string): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(`${panelId}:row-order`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const file: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
        file[key] = value;
      }
    }
    return file;
  } catch {
    return {};
  }
}

function writeRowOrder(panelId: string, sectionKey: string, ids: readonly string[]) {
  try {
    const file = readRowFile(panelId);
    file[sectionKey] = [...ids];
    localStorage.setItem(`${panelId}:row-order`, JSON.stringify(file));
  } catch {
    /* quota / private mode */
  }
}

export function PanelRowList({
  panelId,
  sectionKey,
  theme,
  font,
  rows,
}: {
  panelId?: string;
  sectionKey?: string;
  theme?: string;
  font?: string;
  rows: readonly { id: string; node: ReactNode }[];
}) {
  const [saved, setSaved] = useState<string[] | undefined>(() =>
    panelId && sectionKey ? readRowFile(panelId)[sectionKey] : undefined,
  );
  useEffect(() => {
    setSaved(panelId && sectionKey ? readRowFile(panelId)[sectionKey] : undefined);
  }, [panelId, sectionKey]);

  const ordered = orderPanelRows(rows, saved);
  const listRef = useRef<HTMLDivElement>(null);
  const liftRef = useRef<HTMLDivElement>(null);
  const liftRowRef = useRef<HTMLElement | null>(null);
  const liftPlaceRef = useRef<{
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [lift, setLift] = useState<{
    className: string;
    html: string;
    width: number;
    height: number;
  } | null>(null);
  const [dropLine, setDropLine] = useState<{ top: number } | null>(null);

  function placeLift(x: number, y: number) {
    const place = liftPlaceRef.current;
    if (!place) return;
    place.x = x;
    place.y = y;
    const node = liftRef.current;
    if (!node) return;
    node.style.left = `${x - place.offsetX}px`;
    node.style.top = `${y - place.offsetY}px`;
  }

  useLayoutEffect(() => {
    const place = liftPlaceRef.current;
    if (!lift || !place) return;
    placeLift(place.x, place.y);
  }, [lift]);

  function clearLift() {
    const row = liftRowRef.current;
    if (row) delete row.dataset.tlLift;
    liftRowRef.current = null;
    liftPlaceRef.current = null;
    setLift(null);
  }

  function arm(event: ReactPointerEvent<HTMLElement>, id: string) {
    if (!panelId || !sectionKey || event.button !== 0 || ordered.length < 2) return;
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("input, textarea, button, a, label, [role='slider'], [data-no-row-drag]")
    ) {
      return;
    }
    event.stopPropagation();
    const row = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    let slot: { index: number } | null = null;
    bindPointerDrag(pointerId, {
      onMove(ev) {
        if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < DOCK_DRAG_PX) {
          return;
        }
        const root = listRef.current;
        if (!root) return;
        if (!moved) {
          moved = true;
          document.documentElement.dataset.phaseDrag = "grab";
          const rect = row.getBoundingClientRect();
          liftPlaceRef.current = {
            x: ev.clientX,
            y: ev.clientY,
            offsetX: ev.clientX - rect.left,
            offsetY: ev.clientY - rect.top,
          };
          liftRowRef.current = row;
          row.dataset.tlLift = "";
          setLift({
            className: row.className,
            html: row.innerHTML,
            width: rect.width,
            height: rect.height,
          });
        } else {
          placeLift(ev.clientX, ev.clientY);
        }
        const boxes = [...root.querySelectorAll<HTMLElement>("[data-panel-row]")].map(
          (node) => {
            const box = node.getBoundingClientRect();
            return { id: node.dataset.panelRow ?? "", top: box.top, bottom: box.bottom };
          },
        );
        const hit = panelRowSlot(boxes, id, ev.clientY);
        const current = ordered.map((item) => item.id);
        const next = hit ? movePanelRow(current, id, hit.index) : current;
        const changes = hit != null && !samePanelRowOrder(current, next);
        slot = changes && hit ? { index: hit.index } : null;
        const rect = root.getBoundingClientRect();
        setDropLine(
          changes && hit ? { top: hit.lineY - rect.top } : null,
        );
      },
      onEnd() {
        delete document.documentElement.dataset.phaseDrag;
        setDropLine(null);
        clearLift();
        if (!moved || !slot || !panelId || !sectionKey) return;
        const next = movePanelRow(
          ordered.map((item) => item.id),
          id,
          slot.index,
        );
        if (samePanelRowOrder(ordered.map((item) => item.id), next)) return;
        setSaved(next);
        writeRowOrder(panelId, sectionKey, next);
        const suppress = (click: MouseEvent) => {
          click.preventDefault();
          click.stopPropagation();
        };
        window.addEventListener("click", suppress, true);
        window.setTimeout(() => window.removeEventListener("click", suppress, true), 0);
      },
    });
  }

  return (
    <>
      <div ref={listRef} className="relative flex flex-col gap-2">
        {dropLine ? (
          <div
            aria-hidden
            className="pointer-events-none absolute z-30 h-[2px] -translate-y-1/2 rounded-full bg-[color:var(--sp-fg)]"
            style={{ top: dropLine.top, left: 0, right: 0 }}
          />
        ) : null}
        {ordered.map((row) => (
          <div
            key={row.id}
            data-panel-row={row.id}
            className={ROW_HOVER}
            onPointerDown={(event) => arm(event, row.id)}
          >
            {row.node}
          </div>
        ))}
      </div>
      {lift
        ? createPortal(
            <div
              ref={liftRef}
              data-settings-panel=""
              data-panel-theme={theme}
              data-panel-font={font}
              className={cn(
                lift.className,
                "pointer-events-none fixed z-[260] origin-top-left scale-[1.03] border border-[color:var(--sp-line)] shadow-[0_8px_24px_rgba(0,0,0,0.28)]",
              )}
              style={{
                width: lift.width,
                height: lift.height,
                background: "var(--sp-field)",
              }}
              dangerouslySetInnerHTML={{ __html: lift.html }}
            />,
            document.body,
          )
        : null}
    </>
  );
}
