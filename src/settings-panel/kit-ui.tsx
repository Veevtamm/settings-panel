"use client";

import { useContext, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { formatBezierInput, parseBezierInput } from "../lib/cubic-bezier";
import { parseRgb } from "../lib/hex";
import {
  EASING_PRESET_GROUPS,
  EASING_PRESET_LABELS,
  easingForPreset,
  matchEasingPreset,
} from "../lib/easing-presets";
import { COPY_DONE_MS } from "./chrome";
import { hexToHsv, hsvToHex } from "./color";
import { PresetCurveIcon } from "./preset-curve";
import { matchSpringPreset, SPRING_PRESET_GROUPS, springSettleMs, springValue } from "../lib/spring";
import {
  ensureAxisHandles,
  isCornerHandle,
  moveAxisPoint,
  sampleAxisPath,
  segmentControls,
  type AxisHandle,
  type AxisPoint,
} from "../lib/axis-curve";
import {
  FloatingMenu,
  Menu,
  PANEL_INK,
  PANEL_PAPER,
  PanelIcon,
  PanelLocale,
  Row,
  Segment,
  StepMark,
  TargetPick,
  ValueField,
  trimNum,
  rowLabel,
  tr,
} from "./kit-chrome";
export {
  PANEL_INK,
  PANEL_PAPER,
  rowLabel,
  rowLayout,
  stackLayout,
  dangerFillClass,
  dangerTextClass,
  menuHoverClass,
  menuSurfaceClass,
  NEW_PANEL_W_MIN,
  NEW_PANEL_W_MAX,
  NEW_PANEL_H_MIN,
  panelHeightCap,
  useScrollRoot,
  PanelIcon,
  PanelLocale,
  KitTheme,
  tr,
  ChangedName,
  RowHint,
  Row,
  Sortable,
  FloatWindow,
  Pop,
  ValueField,
  PANEL_SECTION_IDS,
  SectionFoldContext,
  ParametersPanel,
  Section,
  DockAnchorContext,
  DockedWindows,
  Toast,
  ScreenDock,
  TargetPick,
  trimNum,
  CommandMark,
  KeyCap,
  StepMark,
  DockButton,
  Track,
  PickGlyph,
  Segment,
  AnchorPick,
  IconPick,
  Menu,
  FloatingMenu,
} from "./kit-chrome";
export type { DockAnchor, Anchor, RowLayout } from "./kit-chrome";
export { TextField } from "./text-field";
export { ProjectMenu, projectMenuItems, PROJECT_MENU_WIDTH } from "./project-menu";
export type { ProjectMenuItem } from "./project-menu";
export { SectionCollapse } from "./row";

export type Hsva = { h: number; s: number; v: number; a: number };
export type Point = { x: number; y: number };
type Curve = [number, number, number, number];

const PRESET_GROUPS = EASING_PRESET_GROUPS.map((group) =>
  group.ids.map((id) => {
    const bezier = parseBezierInput(easingForPreset(id) ?? "");
    return {
      id,
      label: EASING_PRESET_LABELS[id],
      curve: [bezier?.x1 ?? 0, bezier?.y1 ?? 0, bezier?.x2 ?? 1, bezier?.y2 ?? 1] as Curve,
    };
  }),
);

export function hexToHsva(hex: string, alpha: number): Hsva | null {
  const body = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(body)) return null;
  const hsv = hexToHsv(`#${body}`);
  return { h: hsv.h * 360, s: hsv.s, v: hsv.v, a: alpha };
}

export function hsvaToRgb(color: Hsva): [number, number, number] {
  const hue = ((color.h % 360) + 360) % 360;
  const rgb = parseRgb(hsvToHex({ h: hue / 360, s: color.s, v: color.v }));
  return [rgb?.r ?? 0, rgb?.g ?? 0, rgb?.b ?? 0];
}

export function hexAlpha(hex: string, percent: number) {
  const alpha = Math.round((Math.min(100, Math.max(0, percent)) / 100) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${alpha}`;
}

export function rgbToHex(rgb: [number, number, number]) {
  return rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function hsvaToHsl(color: Hsva) {
  const l = color.v * (1 - color.s / 2);
  const s = l === 0 || l === 1 ? 0 : (color.v - l) / Math.min(l, 1 - l);
  return [Math.round(color.h), Math.round(s * 100), Math.round(l * 100)] as const;
}

export type ColorFormat = "hex" | "rgb" | "hsl";

export function formatColor(color: Hsva, format: ColorFormat) {
  if (format === "rgb") return hsvaToRgb(color).join(" ");
  if (format === "hsl") return hsvaToHsl(color).join(" ");
  return rgbToHex(hsvaToRgb(color));
}

export function parseColorInput(raw: string, format: ColorFormat, alpha: number): Hsva | null {
  if (format === "hex") return hexToHsva(raw, alpha);
  const parts = raw.trim().split(/[\s,]+/).map((part) => Number(part.replace(",", ".")));
  if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) return null;
  if (format === "rgb") {
    return hexToHsva(
      rgbToHex(parts.slice(0, 3).map((part) => Math.round(Math.min(255, Math.max(0, part)))) as [number, number, number]),
      alpha,
    );
  }
  const hue = ((parts[0] % 360) + 360) % 360;
  const sat = Math.min(1, Math.max(0, parts[1] / 100));
  const light = Math.min(1, Math.max(0, parts[2] / 100));
  const chroma = sat * Math.min(light, 1 - light);
  const channel = (index: number) => {
    const k = (index + hue / 30) % 12;
    return light - chroma * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return hexToHsva(rgbToHex([0, 8, 4].map((index) => Math.round(channel(index) * 255)) as [number, number, number]), alpha);
}

function springSeries(stiffness: number, damping: number, mass: number) {
  const config = { stiffness, damping, mass };
  const settleMs = springSettleMs(config);
  const span = Math.max(settleMs / 1000, 0.35) * 1.2;
  const steps = 180;
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const t = (span * i) / steps;
    return { t, x: springValue(config, t) };
  });
  return { points, settleMs };
}

function plotPoint(point: Point) {
  return { x: 8 + point.x * 224, y: 8 + point.y * 144 };
}

function PlotGrid({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  return (
    <g stroke={SILVER} opacity="0.5">
      {[0.25, 0.5, 0.75].map((step) => (
        <g key={step} strokeWidth="0.5">
          <line x1={x + width * step} x2={x + width * step} y1={y} y2={y + height} />
          <line x1={x} x2={x + width} y1={y + height * step} y2={y + height * step} />
        </g>
      ))}
      <line x1={x} y1={y + height} x2={x + width} y2={y} strokeWidth="0.75" strokeDasharray="4 4" />
    </g>
  );
}

function axisPts(points: Point[]): AxisPoint[] {
  return points.map((point) => [point.x, point.y]);
}

function axisCurvePath(points: Point[], handles: AxisHandle[], smooth: boolean) {
  const samples = sampleAxisPath(axisPts(points), handles, 64, smooth ? 0 : 1);
  return samples
    .map((sample, index) => {
      const at = plotPoint({ x: sample.t, y: sample.x });
      return `${index === 0 ? "M" : "L"}${at.x} ${at.y}`;
    })
    .join(" ");
}

function axisArms(points: Point[], handles: AxisHandle[], index: number) {
  const pts = axisPts(points);
  const hs = ensureAxisHandles(pts, handles);
  if (isCornerHandle(hs[index])) return { inn: null, out: null };
  const out = index < pts.length - 1 ? segmentControls(pts, hs, index)[0] : null;
  const inn = index > 0 ? segmentControls(pts, hs, index - 1)[1] : null;
  return {
    out: out ? plotPoint({ x: out[0], y: out[1] }) : null,
    inn: inn ? plotPoint({ x: inn[0], y: inn[1] }) : null,
  };
}

/** Each whisker keeps its own offset. A 2-tuple handle is mirrored, so split it into the two sides currently on screen. */
function splitWhiskers(points: Point[], handles: AxisHandle[], index: number) {
  const pts = axisPts(points);
  const knot = pts[index] ?? [0, 0];
  const arms = axisArms(points, handles, index);
  const fromPlot = (arm: { x: number; y: number } | null, sign: 1 | -1): [number, number] => {
    if (!arm) return [0.08, 0];
    const x = (arm.x - 8) / 224;
    const y = (arm.y - 8) / 144;
    return [Math.round((x - knot[0]) * sign * 200) / 200, Math.round((y - knot[1]) * sign * 200) / 200];
  };
  return { out: fromPlot(arms.out, 1), inn: fromPlot(arms.inn, -1) };
}


const VOID = PANEL_INK;
const SILVER = PANEL_PAPER;

export function ColorPicker({
  color,
  onChange,
  format,
  onFormat,
  target,
  targets,
  onTarget,
}: {
  color: Hsva;
  onChange: (next: Hsva) => void;
  format: ColorFormat;
  onFormat: (next: ColorFormat) => void;
  target: string;
  targets: readonly string[];
  onTarget: (label: string) => void;
}) {
  const locale = useContext(PanelLocale);
  const hue = `hsl(${color.h} 100% 50%)`;
  const [picking, setPicking] = useState(false);

  function drag(event: ReactPointerEvent<HTMLDivElement>, apply: (x: number, y: number, rect: DOMRect) => void) {
    event.stopPropagation();
    event.preventDefault();
    const el = event.currentTarget;
    el.setPointerCapture(event.pointerId);
    const run = (clientX: number, clientY: number) => apply(clientX, clientY, el.getBoundingClientRect());
    run(event.clientX, event.clientY);
    const move = (ev: PointerEvent) => run(ev.clientX, ev.clientY);
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  }

  return (
    <>
      <TargetPick
        label={tr(locale, "Элемент", "Element")}
        value={target}
        options={targets}
        onChange={onTarget}
      />
      <section className="w-full overflow-hidden rounded-lg bg-black text-[14px] leading-none text-white">
      <div
        data-color-drag=""
        data-truecolor=""
        className="relative h-[140px] cursor-crosshair touch-none"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hue})` }}
        onPointerDown={(event) =>
          drag(event, (x, y, rect) => {
            const inset = 8;
            onChange({
              ...color,
              s: Math.min(1, Math.max(0, (x - rect.left - inset) / (rect.width - inset * 2))),
              v: Math.min(1, Math.max(0, 1 - (y - rect.top - inset) / (rect.height - inset * 2))),
            });
          })
        }
      >
        <span
          className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black bg-white"
          style={{
            left: `calc(8px + ${color.s} * (100% - 16px))`,
            top: `calc(8px + ${1 - color.v} * (100% - 16px))`,
          }}
        />
      </div>
      <div className="p-1">
        <div
          data-color-drag=""
          data-truecolor=""
          className="relative h-6 cursor-ew-resize touch-none overflow-hidden rounded"
          style={{ background: `linear-gradient(to right, ${Array.from({ length: 25 }, (_, index) => `hsl(${index * 15} 100% 50%)`).join(",")})` }}
          onPointerDown={(event) =>
            drag(event, (x, _y, rect) => {
              const travel = Math.max(rect.width - 8, 1);
              const ratio = Math.min(1, Math.max(0, (x - rect.left - 4) / travel));
              onChange({ ...color, h: ratio * 360 });
            })
          }
        >
          <span className="absolute top-[3px] h-[18px] w-1 rounded-[1px] bg-black" style={{ left: `calc(2px + (100% - 8px) * ${color.h / 360})` }} />
        </div>
      </div>
      <div className="p-1">
        <div
          data-color-drag=""
          data-truecolor=""
          className="relative h-6 cursor-ew-resize touch-none overflow-hidden rounded"
          style={{
            background: `linear-gradient(to right, hsl(${color.h} 100% 50% / 0), hsl(${color.h} 100% 50%))`,
          }}
          onPointerDown={(event) =>
            drag(event, (x, _y, rect) => {
              const travel = Math.max(rect.width - 8, 1);
              const ratio = Math.min(1, Math.max(0, (x - rect.left - 4) / travel));
              onChange({ ...color, a: ratio });
            })
          }
        >
          <span className="absolute top-[3px] h-[18px] w-1 rounded-[1px] bg-black" style={{ left: `calc(2px + (100% - 8px) * ${color.a})` }} />
        </div>
      </div>
      <div className="p-1">
        <Segment
          equal
          value={format}
          onChange={onFormat}
          options={(["hex", "rgb", "hsl"] as const).map((id) => ({ id, label: id.toUpperCase() }))}
        />
      </div>
      <div className="flex h-8 items-center justify-between px-1">
        <span>{tr(locale, "Цвет", "Colour")}</span>
        <span className="flex items-center gap-1">
          <ValueField
            value={formatColor(color, format)}
            onCommit={(raw) => {
              const next = parseColorInput(raw, format, color.a);
              if (next) onChange(next);
            }}
          />
          <button
            type="button"
            aria-label={tr(locale, "Пипетка", "Eyedropper")}
            aria-pressed={picking}
            onClick={() => {
              const Ctor = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
              if (!Ctor) return;
              setPicking(true);
              void new Ctor()
                .open()
                .then((result) => {
                  const next = hexToHsva(result.sRGBHex, color.a);
                  if (next) onChange(next);
                })
                .catch(() => undefined)
                .finally(() => setPicking(false));
            }}
            className={`flex size-6 items-center justify-center rounded transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] ${picking ? "bg-white text-black" : "text-white fine-hover:hover:inset-ring fine-hover:hover:inset-ring-white"}`}
          >
            <PanelIcon name="pipette" className="size-5" />
          </button>
        </span>
      </div>
      <div className="flex h-8 items-center justify-between px-1">
        <span>{tr(locale, "Непрозрачность", "Opacity")}</span>
        <ValueField
          value={String(Math.round(color.a * 100))}
          current={color.a * 100}
          min={0}
          max={100}
          unit="%"
          onCommit={(raw) => {
            const parsed = Number(raw);
            if (!Number.isFinite(parsed)) return;
            onChange({ ...color, a: Math.min(100, Math.max(0, parsed)) / 100 });
          }}
        />
      </div>
    </section>
    </>
  );
}

export function CoordChip({ value, onCommit }: { value: number; onCommit: (next: number) => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <span
      className={`group/chip flex h-6 min-w-0 items-center justify-center rounded inset-ring inset-ring-white transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${editing ? "bg-white" : "fine-hover:hover:bg-white"}`}
    >
      <ValueField
        block
        onEditingChange={setEditing}
        value={trimNum(value)}
        current={value}
        min={-2}
        max={2}
        step={0.01}
        onCommit={(next) => {
          const parsed = Number(next);
          if (Number.isFinite(parsed)) onCommit(parsed);
        }}
      />
    </span>
  );
}

export function MotionWindow({
  type,
  onType,
  curve,
  onCurve,
  spring,
  onSpring,
  target,
  targets = [],
  onTarget,
}: {
  type: "easing" | "physics";
  onType: (next: "easing" | "physics") => void;
  curve: [number, number, number, number];
  onCurve: (next: [number, number, number, number]) => void;
  spring: { stiffness: number; damping: number; mass: number };
  onSpring: (next: { stiffness: number; damping: number; mass: number }) => void;
  /** Current curve, shown as a dropdown above the plot. */
  target?: string;
  targets?: readonly string[];
  onTarget?: (label: string) => void;
}) {
  const locale = useContext(PanelLocale);
  const [menu, setMenu] = useState(false);
  const [springMenu, setSpringMenu] = useState(false);
  const [coordsCopied, setCoordsCopied] = useState(false);
  const easeAnchor = useRef<HTMLDivElement>(null);
  const springAnchor = useRef<HTMLDivElement>(null);
  const presetId = matchEasingPreset({ x1: curve[0], y1: curve[1], x2: curve[2], y2: curve[3] });
  const presetLabel = EASING_PRESET_LABELS[presetId as keyof typeof EASING_PRESET_LABELS] ?? EASING_PRESET_LABELS.custom;
  const presetGroups = PRESET_GROUPS.map((group) => group.map((item) => item.label));
  const series = springSeries(spring.stiffness, spring.damping, spring.mass);
  const types = [
    ["easing", tr(locale, "Кривая", "Easing")],
    ["physics", tr(locale, "Пружина", "Physics")],
  ] as const;

  const springHit = matchSpringPreset(spring);
  const springPreset = SPRING_PRESET_GROUPS.flatMap((group) => group.presets).find((preset) => preset.id === springHit);
  const springLabel = springPreset
    ? locale === "en"
      ? springPreset.en
      : springPreset.ru
    : "Custom";
  const springGroups = SPRING_PRESET_GROUPS.map((group) =>
    group.presets.map((preset) => (locale === "en" ? preset.en : preset.ru)),
  );

  function choose(label: string) {
    const next = PRESET_GROUPS.flat().find((item) => item.label === label);
    if (next) onCurve(next.curve);
    setMenu(false);
  }

  function chooseSpring(label: string) {
    const preset = SPRING_PRESET_GROUPS.flatMap((group) => group.presets).find(
      (item) => (locale === "en" ? item.en : item.ru) === label,
    );
    if (preset) onSpring({ stiffness: preset.stiffness, damping: preset.damping, mass: preset.mass });
    setSpringMenu(false);
  }

  const yMax = Math.max(1, curve[1], curve[3]) + 0.1;
  const yMin = Math.min(0, curve[1], curve[3]) - 0.1;
  const ySpan = Math.max(0.2, yMax - yMin);
  const plotPad = 8;
  const plotSpan = 224;
  const plotX = (t: number) => plotPad + t * plotSpan;
  const plotY = (v: number) => plotPad + ((yMax - v) / ySpan) * plotSpan;
  const start = { x: plotX(0), y: plotY(0) };
  const end = { x: plotX(1), y: plotY(1) };
  const p1 = { x: plotX(curve[0]), y: plotY(curve[1]) };
  const p2 = { x: plotX(curve[2]), y: plotY(curve[3]) };
  const bezier = `M ${start.x} ${start.y} C ${p1.x} ${p1.y} ${p2.x} ${p2.y} ${end.x} ${end.y}`;

  function dragHandle(which: 0 | 1) {
    return (event: ReactPointerEvent<SVGCircleElement>) => {
      const svg = event.currentTarget.ownerSVGElement;
      if (!svg) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      const apply = (ev: PointerEvent) => {
        if (ev.buttons === 0) return;
        const rect = svg.getBoundingClientRect();
        const x = ((ev.clientX - rect.left) / rect.width) * 240;
        const y = ((ev.clientY - rect.top) / rect.height) * 240;
        const t = Math.min(1, Math.max(0, (x - plotPad) / plotSpan));
        const v = Math.min(2, Math.max(-1, yMax - ((y - plotPad) / plotSpan) * ySpan));
        const next = [...curve] as Curve;
        next[which * 2] = t;
        next[which * 2 + 1] = Math.round(v * 1000) / 1000;
        onCurve(next);
      };
      apply(event.nativeEvent);
      const move = (ev: PointerEvent) => apply(ev);
      const up = () => {
        svg.removeEventListener("pointermove", move);
        svg.removeEventListener("pointerup", up);
      };
      svg.addEventListener("pointermove", move);
      svg.addEventListener("pointerup", up);
    };
  }

  return (
    <section data-chrome="" className="flex w-64 flex-col gap-1.5 rounded-2xl bg-white p-2 text-black">
      <header className="flex h-4 items-center px-1">
        <span className="flex min-w-0 items-center gap-1">
          <PanelIcon name="spline" className="size-5" />
          <span className="text-[14px] leading-4">{tr(locale, "Движение", "Motion")}</span>
        </span>
      </header>
      {type === "easing" && target && onTarget ? (
        <TargetPick label={tr(locale, "Элемент", "Element")} value={target} options={targets} onChange={onTarget} />
      ) : null}
      <div className="overflow-hidden rounded-lg bg-black">
        <svg data-plot="" viewBox={type === "physics" ? "0 0 240 120" : "0 0 240 240"} className={`block w-full ${type === "physics" ? "h-[120px]" : "aspect-square"}`}>
          {type === "physics" ? (
            <PlotGrid x={8} y={8} width={224} height={104} />
          ) : (
            <g stroke={SILVER} opacity="0.5">
              {[0.25, 0.5, 0.75].map((step) => (
                <g key={step} strokeWidth="0.5">
                  <line x1={plotX(step)} x2={plotX(step)} y1={plotY(0)} y2={plotY(1)} />
                  <line x1={plotX(0)} x2={plotX(1)} y1={plotY(step)} y2={plotY(step)} />
                </g>
              ))}
              <rect
                x={plotX(0)}
                y={plotY(1)}
                width={plotX(1) - plotX(0)}
                height={plotY(0) - plotY(1)}
                fill="none"
                strokeWidth="0.75"
              />
              <line x1={plotX(0)} y1={plotY(0)} x2={plotX(1)} y2={plotY(1)} strokeWidth="0.75" strokeDasharray="4 4" />
            </g>
          )}
          {type === "physics" ? (
            <>
              <line x1="8" x2="232" y1="20" y2="20" stroke={SILVER} strokeDasharray="2 3" strokeOpacity="0.5" />
              <path
                d={series.points
                  .filter((point) => point.t <= Math.max(series.settleMs / 1000, 0.35) * 1.2)
                  .map((point, index) => {
                    const end = Math.max(series.settleMs / 1000, 0.35) * 1.2;
                    const x = 8 + (point.t / end) * 224;
                    const y = 104 - point.x * 84;
                    return `${index === 0 ? "M" : "L"}${x} ${y}`;
                  })
                  .join(" ")}
                fill="none"
                stroke={SILVER}
                strokeWidth="1.5"
              />
            </>
          ) : (
            <>
              <path d={bezier} fill="none" stroke={SILVER} strokeWidth="1.5" />
              <line x1={start.x} y1={start.y} x2={p1.x} y2={p1.y} stroke={SILVER} strokeOpacity="0.5" />
              <line x1={end.x} y1={end.y} x2={p2.x} y2={p2.y} stroke={SILVER} strokeOpacity="0.5" />
              <circle cx={start.x} cy={start.y} r="3" fill={VOID} stroke={SILVER} strokeWidth="1.5" />
              <circle cx={end.x} cy={end.y} r="3" fill={VOID} stroke={SILVER} strokeWidth="1.5" />
              {([0, 1] as const).map((which) => {
                const point = which === 0 ? p1 : p2;
                return (
                  <circle
                    key={which}
                    cx={point.x}
                    cy={point.y}
                    r="5"
                    fill={VOID}
                    stroke={SILVER}
                    strokeWidth="1.5"
                    className="cursor-grab"
                    onPointerDown={dragHandle(which)}
                  />
                );
              })}
            </>
          )}
        </svg>
        <div className="p-1">
          <Segment
            equal
            value={type}
            onChange={onType}
            options={types.map(([id, label]) => ({ id, label }))}
          />
        </div>
        {type === "easing" ? (
          <Row bind="card" layout="stack">
            <span className="flex h-6 w-full items-center justify-between">
              <span className={rowLabel}>{tr(locale, "Координаты", "Coords")}</span>
              <button
                type="button"
                aria-label={locale === "en" ? "Copy coordinates" : "Копировать координаты"}
                onClick={() => {
                  const text = formatBezierInput({ x1: curve[0], y1: curve[1], x2: curve[2], y2: curve[3] });
                  void navigator.clipboard.writeText(text);
                  setCoordsCopied(true);
                  window.setTimeout(() => setCoordsCopied(false), COPY_DONE_MS);
                }}
                className="flex size-6 items-center justify-center rounded text-white transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] fine-hover:hover:inset-ring fine-hover:hover:inset-ring-white"
              >
                <PanelIcon name={coordsCopied ? "check" : "file"} className="size-5" />
              </button>
            </span>
            <span className="grid h-6 w-full grid-cols-4 gap-1">
              {curve.map((value, index) => (
                <CoordChip
                  key={index}
                  value={value}
                  onCommit={(next) => {
                    const copy = [...curve] as [number, number, number, number];
                    copy[index] = next;
                    onCurve(copy);
                  }}
                />
              ))}
            </span>
          </Row>
        ) : null}
        {type === "physics" ? (
          <>
            {(
              [
                [tr(locale, "Жёсткость", "Stiffness"), "stiffness", 1, 1000, 1],
                [tr(locale, "Затухание", "Damping"), "damping", 0, 100, 0.5],
                [tr(locale, "Масса", "Mass"), "mass", 0.1, 10, 0.1],
              ] as const
            ).map(([label, key, low, high, step]) => (
              <Row key={key} bind="card">
                <span className={rowLabel}>{label}</span>
                <ValueField
                  value={trimNum(spring[key])}
                  current={spring[key]}
                  min={low}
                  max={high}
                  step={step}
                  onCommit={(next) => {
                    const parsed = Number(next);
                    if (Number.isFinite(parsed)) onSpring({ ...spring, [key]: parsed });
                  }}
                />
              </Row>
            ))}
            <Row bind="card">
              <span className={rowLabel}>{tr(locale, "Длительность", "Duration")}</span>
              <span className="text-white/50">{series.settleMs} ms</span>
            </Row>
            <div ref={springAnchor} onClick={() => setSpringMenu((open) => !open)} className="cursor-pointer">
              <Row bind="card">
                <span className={rowLabel}>{tr(locale, "Пресет", "Preset")}</span>
                <span className="flex items-center gap-1">
                  {springLabel}
                  <PanelIcon name="chevrons-up-down" className="size-5" />
                </span>
              </Row>
              <FloatingMenu open={springMenu} anchor={springAnchor} onClose={() => setSpringMenu(false)}>
                <Menu groups={springGroups} value={springLabel} onChange={chooseSpring} />
              </FloatingMenu>
            </div>
          </>
        ) : null}
        {type !== "physics" ? (
          <div ref={easeAnchor} onClick={() => setMenu((open) => !open)} className="cursor-pointer">
            <Row bind="card">
              <span className={rowLabel}>{tr(locale, "Кривая", "Ease")}</span>
              <span className="flex items-center gap-1">
                {presetLabel}
                <PanelIcon name="chevrons-up-down" className="size-5" />
              </span>
            </Row>
            <FloatingMenu open={menu} anchor={easeAnchor} onClose={() => setMenu(false)}>
              <Menu
                mark={(option) => (
                  <PresetCurveIcon
                    id={PRESET_GROUPS.flat().find((item) => item.label === option)?.id ?? "custom"}
                    strokeWidth={1.37}
                  />
                )}
                groups={presetGroups}
                value={presetLabel}
                onChange={choose}
              />
            </FloatingMenu>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function AxisWindow({
  points,
  onPoints,
  handles,
  onHandles,
  selected,
  onSelect,
  style,
  onStyle,
  target,
  targets = [],
  onTarget,
}: {
  points: Point[];
  onPoints: (next: Point[]) => void;
  handles: AxisHandle[];
  onHandles: (next: AxisHandle[]) => void;
  selected: number;
  onSelect: (index: number) => void;
  style: "corner" | "smooth";
  onStyle: (next: "corner" | "smooth") => void;
  /** Current axis, shown as a dropdown above the plot. */
  target?: string;
  targets?: readonly string[];
  onTarget?: (label: string) => void;
}) {
  const locale = useContext(PanelLocale);

  function addPoint() {
    if (points.length >= 12) return;
    let gap = 0;
    let index = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      const size = points[i + 1].x - points[i].x;
      if (size > gap) {
        gap = size;
        index = i;
      }
    }
    const next = [...points];
    next.splice(index + 1, 0, {
      x: (points[index].x + points[index + 1].x) / 2,
      y: (points[index].y + points[index + 1].y) / 2,
    });
    onPoints(next);
    onSelect(index + 1);
  }

  function removePoint() {
    if (points.length <= 2) return;
    const index = selected > 0 && selected < points.length - 1 ? selected : 1;
    onPoints(points.filter((_, i) => i !== index));
    onSelect(Math.max(0, index - 1));
  }

  return (
    <section data-chrome="" className="flex w-64 flex-col gap-1.5 rounded-2xl bg-white p-2 text-black">
      <header className="flex h-4 items-center px-1">
        <span className="flex min-w-0 items-center gap-1">
          <PanelIcon name="waypoints" className="size-5" />
          <span className="text-[14px] leading-4">{tr(locale, "Ось", "Axis")}</span>
        </span>
      </header>
      {target && onTarget ? (
        <TargetPick label={tr(locale, "Элемент", "Element")} value={target} options={targets} onChange={onTarget} />
      ) : null}
      <div className="overflow-hidden rounded-lg bg-black">
        <svg
          data-plot=""
          viewBox="0 0 240 160"
          className="block h-40 w-full touch-none"
          onPointerDown={(event) => {
            event.stopPropagation();
            const svg = event.currentTarget;
            const rect = svg.getBoundingClientRect();
            const view = (clientX: number, clientY: number) => ({
              x: ((clientX - rect.left) / rect.width) * 240,
              y: ((clientY - rect.top) / rect.height) * 160,
            });
            const local = (clientX: number, clientY: number) => {
              const at = view(clientX, clientY);
              return {
                x: Math.min(1, Math.max(0, (at.x - 8) / 224)),
                y: Math.min(1, Math.max(0, (at.y - 8) / 144)),
              };
            };
            const start = view(event.clientX, event.clientY);
            const arms = style === "smooth" ? axisArms(points, handles, selected) : { inn: null, out: null };
            const distTo = (arm: { x: number; y: number } | null) => (arm ? Math.hypot(arm.x - start.x, arm.y - start.y) : Infinity);
            const outDist = distTo(arms.out);
            const inDist = distTo(arms.inn);
            const arm = outDist < 14 && outDist <= inDist ? "out" : inDist < 14 ? "in" : null;
            const hit = local(event.clientX, event.clientY);
            let nearest = selected;
            if (!arm) {
              let best = Infinity;
              points.forEach((point, index) => {
                const dx = point.x - hit.x;
                const dy = point.y - hit.y;
                const dist = dx * dx + dy * dy;
                if (dist < best) {
                  best = dist;
                  nearest = index;
                }
              });
              onSelect(nearest);
            }
            const sides = splitWhiskers(points, handles, selected);
            svg.setPointerCapture(event.pointerId);
            const move = (ev: PointerEvent) => {
              const place = local(ev.clientX, ev.clientY);
              if (arm) {
                const knot = points[selected];
                if (!knot) return;
                const prev = points[selected - 1];
                const next = points[selected + 1];
                const out = [...sides.out] as [number, number];
                const inn = [...sides.inn] as [number, number];
                if (arm === "out") {
                  const lo = knot.x + 0.04;
                  const hi = (next?.x ?? 1) - 0.04;
                  const x = hi > lo ? Math.min(hi, Math.max(lo, place.x)) : knot.x + 0.04;
                  out[0] = Math.round((x - knot.x) * 200) / 200;
                  out[1] = Math.round((place.y - knot.y) * 200) / 200;
                } else {
                  const lo = (prev?.x ?? 0) + 0.04;
                  const hi = knot.x - 0.04;
                  const x = hi > lo ? Math.min(hi, Math.max(lo, place.x)) : knot.x - 0.04;
                  inn[0] = Math.round((knot.x - x) * 200) / 200;
                  inn[1] = Math.round((knot.y - place.y) * 200) / 200;
                }
                const nextHandles = ensureAxisHandles(axisPts(points), handles);
                nextHandles[selected] = [out[0], out[1], inn[0], inn[1]];
                onHandles(nextHandles);
                return;
              }
              const moved = moveAxisPoint(axisPts(points), handles, nearest, place.x, place.y);
              onPoints(moved.pts.map(([x, y]) => ({ x, y })));
              onHandles(moved.handles);
            };
            const up = () => {
              svg.removeEventListener("pointermove", move);
              svg.removeEventListener("pointerup", up);
            };
            svg.addEventListener("pointermove", move);
            svg.addEventListener("pointerup", up);
          }}
        >
          <PlotGrid x={8} y={8} width={224} height={144} />
          <path d={axisCurvePath(points, handles, style === "smooth")} fill="none" stroke={SILVER} strokeWidth="1.5" />
          {style === "smooth" && points[selected] ? (
            <g stroke={SILVER} strokeOpacity="0.5" strokeWidth="1">
              {(() => {
                const at = plotPoint(points[selected]);
                const arms = axisArms(points, handles, selected);
                return (
                  <>
                    {arms.inn ? <line x1={at.x} y1={at.y} x2={arms.inn.x} y2={arms.inn.y} /> : null}
                    {arms.out ? <line x1={at.x} y1={at.y} x2={arms.out.x} y2={arms.out.y} /> : null}
                    {[arms.inn, arms.out].map((arm, index) =>
                      arm ? (
                        <rect
                          key={index}
                          x={arm.x - 3}
                          y={arm.y - 3}
                          width="6"
                          height="6"
                          fill={SILVER}
                          stroke={VOID}
                          transform={`rotate(45 ${arm.x} ${arm.y})`}
                        />
                      ) : null,
                    )}
                  </>
                );
              })()}
            </g>
          ) : null}
          {points.map((point, index) => {
            const at = plotPoint(point);
            return <circle key={index} cx={at.x} cy={at.y} r={index === selected ? 4 : 3} fill={VOID} stroke={SILVER} strokeWidth="1.5" />;
          })}
        </svg>
        <Row bind="bars">
          <span className={rowLabel}>{tr(locale, "Точки", "Points")}</span>
          <span className="flex h-6 w-24 items-center justify-between rounded inset-ring inset-ring-white text-white">
            <button type="button" aria-label="Меньше" onClick={removePoint} className="flex size-6 items-center justify-center rounded bg-white text-black">
              <StepMark kind="minus" />
            </button>
            {points.length}
            <button type="button" aria-label="Больше" onClick={addPoint} className="flex size-6 items-center justify-center rounded bg-white text-black">
              <StepMark kind="plus" />
            </button>
          </span>
        </Row>
        <Row bind="bars">
          <span className={rowLabel}>{tr(locale, "Линия", "Line")}</span>
          <Segment
            value={style}
            onChange={onStyle}
            options={[
              { id: "corner", label: tr(locale, "Угловая", "Corner") },
              { id: "smooth", label: tr(locale, "Гладкая", "Smooth") },
            ]}
          />
        </Row>
      </div>
    </section>
  );
}

export function GapChips({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [pulse, setPulse] = useState(0);
  const [pulseAt, setPulseAt] = useState<number | null>(null);
  const blink = (index: number) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setPulseAt(index);
    setPulse((n) => n + 1);
  };
  const blinkRef = useRef(blink);
  blinkRef.current = blink;
  const chips = value
    .split(/[,;\s]+/)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
  const shown = chips.length > 0 ? chips : [8];
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const onWheel = (event: WheelEvent) => {
      const chip = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-chip]");
      if (!chip) return;
      event.preventDefault();
      if (event.deltaY === 0) return;
      const index = Number(chip.dataset.chip);
      const current = shownRef.current;
      const next = current.map((item, itemIndex) =>
        itemIndex === index ? Math.min(32, Math.max(2, item + (event.deltaY < 0 ? 1 : -1))) : item,
      );
      onChange(next.join(", "));
      blinkRef.current(index);
    };
    list.addEventListener("wheel", onWheel, { passive: false });
    return () => list.removeEventListener("wheel", onWheel);
  }, [onChange]);

  return (
    <span ref={listRef} className="ml-auto flex w-full max-w-[108px] flex-wrap justify-end gap-1 py-1">
      {shown.map((item, index) => (
        <button
          key={pulseAt === index ? `${index}-${pulse}` : index}
          type="button"
          data-chip={index}
          onPointerEnter={(event) => {
            if (event.pointerType !== "mouse") return;
            blink(index);
          }}
          onDoubleClick={() => {
            if (shown.length < 2) return;
            onChange(shown.filter((_, itemIndex) => itemIndex !== index).join(", "));
          }}
          className={`flex size-6 shrink-0 items-center justify-center rounded font-mono text-[14px] text-white inset-ring inset-ring-white${pulseAt === index ? " sp-chip-flash" : ""}`}
        >
          {item}
        </button>
      ))}
      <button
        type="button"
        aria-label="Добавить зазор"
        disabled={shown.length >= 6}
        onClick={() => onChange([...shown, shown[shown.length - 1] ?? 8].join(", "))}
        className="group/add relative flex size-6 shrink-0 items-center justify-center rounded text-white transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] fine-hover:hover:bg-white fine-hover:hover:text-black motion-reduce:transition-none"
      >
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute inset-0 size-6 fine-hover:group-hover/add:hidden" fill="none" aria-hidden>
          <rect x="0.5" y="0.5" width="23" height="23" rx="3.5" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
        </svg>
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path fill="currentColor" d="M11.1 5h1.8v6.1H19v1.8h-6.1V19h-1.8v-6.1H5v-1.8h6.1V5Z" />
        </svg>
      </button>
    </span>
  );
}

export const ORIENT_RATIO = { square: 1, portrait: 4 / 3, landscape: 3 / 4 } as const;

