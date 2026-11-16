"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { PanelIcon } from "../panel-icon";

export type ProjectRowStatus = "draft" | "hidden";

/** Black project block from the kit list. Cover is 36, the second line is 11. */
export function ProjectRow({
  title,
  meta,
  status,
  tone = "bg-white/20",
  image,
  alone = false,
  edge,
  cue = true,
  onPointerDown,
}: {
  title: string;
  meta: string;
  status?: ProjectRowStatus;
  tone?: string;
  image?: string;
  alone?: boolean;
  edge?: "first" | "last";
  /** Chevron on hover. The kit list shows it; a list that does not open a project hides it. */
  cue?: boolean;
  onPointerDown?: (event: ReactPointerEvent<HTMLSpanElement>) => void;
}) {
  const radius = alone ? "rounded-lg" : edge === "first" ? "rounded-t-lg" : edge === "last" ? "rounded-b-lg" : "";
  const soft = status === "draft" ? "opacity-50" : "";
  return (
    <div className={`group relative flex h-11 w-[284px] items-center gap-2 bg-black p-1 text-white ${radius}`}>
      {onPointerDown ? (
        <span
          data-grip=""
          role="button"
          aria-label="Перетащить"
          onPointerDown={onPointerDown}
          className="group/grip absolute inset-y-0 -left-2 z-10 flex w-2 cursor-grab touch-none items-center justify-center"
        >
          <span className="hidden flex-col gap-[3px] group-hover/grip:flex">
            <i className="size-0.5 rounded-full bg-black" />
            <i className="size-0.5 rounded-full bg-black" />
            <i className="size-0.5 rounded-full bg-black" />
          </span>
        </span>
      ) : null}
      <span className="relative size-9 shrink-0 overflow-hidden rounded">
        {image ? (
          <img
            src={image}
            alt=""
            className={`absolute inset-0 size-full object-cover ${soft} ${status === "hidden" ? "scale-125 blur-[8px]" : ""}`}
          />
        ) : (
          <span
            className={`absolute rounded ${tone} ${status === "draft" ? "inset-0 opacity-50" : status === "hidden" ? "inset-[-4px] blur-[8px]" : "inset-0"}`}
          />
        )}
        {status === "draft" ? (
          <svg viewBox="0 0 36 36" className="absolute inset-0 size-full" aria-hidden>
            <rect x="0.5" y="0.5" width="35" height="35" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
          </svg>
        ) : null}
        {status === "hidden" ? (
          <PanelIcon name="eye-off" className="absolute top-1/2 left-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2" strokeWidth={1.25} />
        ) : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[14px] leading-4">{title}</span>
        <span className="text-[11px] leading-3 text-white/45">{meta}</span>
      </span>
      {cue ? (
        <PanelIcon
          name="chevron-right"
          className="size-4 shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 motion-reduce:transition-none"
        />
      ) : null}
    </div>
  );
}
