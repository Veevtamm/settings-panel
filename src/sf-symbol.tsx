"use client";

import type { SVGProps } from "react";
import { cn } from "./lib/utils";
import {
  LUCIDE_GLYPHS,
  LUCIDE_ICON_NAMES,
  type LucideIconName,
} from "./lucide-glyphs";

/**
 * Lucide glyphs from Tools **Panel / Icon** (16×16 in a 20×20 slot, stroke 1).
 * Old SF Symbol keys still resolve so `sectionIcons` and scene schemas keep working.
 */
const SF_TO_LUCIDE = {
  beziercurve: "spline",
  function: "function-square",
  "circle.hexagongrid": "hexagon",
  "chevron.up": "chevron-up",
  aspectratio: "ratio",
  photo: "image",
  elements: "layout-grid",
  doc: "file",
  xmark: "x",
  "doc.on.doc": "file",
  "slider.horizontal": "sliders-horizontal",
  "slider.horizontal.3": "sliders-horizontal",
  "arrow.counterclockwise": "rotate-ccw",
  "widget.small": "contrast",
  gearshape: "settings",
  trash: "trash-2",
  "square.grid.2x2": "grid-3x3",
  "rectangle.split.3x1": "columns-3",
  "switch.2": "sliders-horizontal",
  "slider.horizontal.below.rectangle": "sliders-horizontal",
  "info.square": "info",
  "align.horizontal.left": "align-start-vertical",
  "align.horizontal.center": "align-center-vertical",
  "align.horizontal.right": "align-end-vertical",
  "text.alignleft": "align-left",
  "text.aligncenter": "align-center",
  "text.alignright": "align-right",
  "text.justify": "align-justify",
  "textformat.abc": "type",
  paintpalette: "palette",
  checkmark: "check",
  "eye.slash": "eye-off",
  eyedropper: "pipette",
  "line.3.horizontal": "grip-vertical",
  "rectangle.3.group": "layout-grid",
  "rectangle.portrait": "rectangle-vertical",
  rectangle: "rectangle-horizontal",
  playpause: "circle-play",
  "backward.end": "skip-back",
  "forward.end": "skip-forward",
  "pin.slash": "pin-off",
  "arrow.down.and.line.horizontal.and.arrow.up": "list-chevrons-down-up",
  "arrow.up.and.line.horizontal.and.arrow.down": "list-chevrons-up-down",
  "pointer.arrow.ipad.slash": "mouse-pointer-click",
  "pointer.arrow.ipad": "mouse-pointer-click",
  "pointer.arrow.rays": "mouse-pointer-click",
  "pointer.arrow.ipad.rays": "mouse-pointer-click",
  "sun.max": "sun",
} as const satisfies Record<string, LucideIconName>;

export type SfSymbolName = LucideIconName | keyof typeof SF_TO_LUCIDE;

export const SF_SYMBOL_NAMES = [...LUCIDE_ICON_NAMES] as SfSymbolName[];

export function resolvePanelIcon(name: string): LucideIconName | undefined {
  if (name in LUCIDE_GLYPHS) return name as LucideIconName;
  if (name in SF_TO_LUCIDE) return SF_TO_LUCIDE[name as keyof typeof SF_TO_LUCIDE];
  return undefined;
}

export function isSfSymbolName(value: unknown): value is SfSymbolName {
  return typeof value === "string" && resolvePanelIcon(value) != null;
}

type SfSymbolProps = {
  name: SfSymbolName;
  className?: string;
} & Omit<SVGProps<SVGSVGElement>, "children" | "viewBox" | "xmlns" | "fill">;

export function SfSymbol({ name, className, ...props }: SfSymbolProps) {
  const lucide = resolvePanelIcon(name);
  const inner = lucide ? LUCIDE_GLYPHS[lucide] : undefined;

  return (
    <svg
      aria-hidden
      className={cn("size-5 shrink-0", className)}
      fill="none"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {inner ? (
        <g
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          transform="translate(2 2) scale(0.66666667)"
          dangerouslySetInnerHTML={{ __html: inner }}
        />
      ) : null}
    </svg>
  );
}
