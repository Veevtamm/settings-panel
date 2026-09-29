"use client";

import { springSettleMs, springValue, type SpringConfig } from "../lib/spring";
import { cn } from "../lib/utils";
import { CURVE_SIZE, FIELD, fieldChrome } from "./chrome";
import { L, tx, type PanelLocale } from "./locale";
import { SettingNumber } from "./number";

const GRAPH_H = 180;
const PAD = 12;
const SAMPLES = 160;

const COPY = {
  stiffness: L("Жёсткость", "Stiffness"),
  stiffnessInfo: L(
    "Сила, с которой пружина тянет к цели: больше — быстрее и резче",
    "How hard the spring pulls to the target: higher — faster and snappier",
  ),
  damping: L("Затухание", "Damping"),
  dampingInfo: L(
    "Трение: меньше — дольше качается вокруг цели, больше — подходит без перелёта",
    "Friction: lower — swings around the target longer, higher — arrives without overshoot",
  ),
  mass: L("Масса", "Mass"),
  massInfo: L(
    "Инерция: тяжелее — медленнее разгон и шире размах",
    "Inertia: heavier — slower start and wider swing",
  ),
  duration: L("Длительность", "Duration"),
  durationInfo: L(
    "Сколько идёт движение, пока не осядет в 0,1% от цели. Считается, не хранится",
    "Time until the motion settles within 0.1% of the target. Derived, not stored",
  ),
};

/** Response plot: dashed line = target, solid = spring position over its settle time. */
function SpringGraph({ value, accent }: { value: SpringConfig; accent: string }) {
  const settle = springSettleMs(value) / 1000;
  const points = Array.from({ length: SAMPLES + 1 }, (_, i) => {
    const t = (settle * i) / SAMPLES;
    return [t, springValue(value, t)] as const;
  });
  const peak = Math.max(1, ...points.map(([, y]) => y));
  const low = Math.min(0, ...points.map(([, y]) => y));
  const span = peak - low || 1;
  const w = CURVE_SIZE;
  const toX = (t: number) => PAD + (settle > 0 ? t / settle : 0) * (w - 2 * PAD);
  const toY = (y: number) => PAD + ((peak - y) / span) * (GRAPH_H - 2 * PAD);
  const d = points
    .map(([t, y], i) => `${i === 0 ? "M" : "L"}${toX(t).toFixed(2)} ${toY(y).toFixed(2)}`)
    .join(" ");
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${w} ${GRAPH_H}`}
      className="block h-auto w-full"
    >
      <line
        x1={PAD}
        x2={w - PAD}
        y1={toY(1)}
        y2={toY(1)}
        stroke="var(--sp-line-hover)"
        strokeDasharray="4 4"
      />
      <line
        x1={PAD}
        x2={w - PAD}
        y1={toY(0)}
        y2={toY(0)}
        stroke="var(--sp-line)"
      />
      <path d={d} fill="none" stroke={accent} strokeWidth={1.5} />
    </svg>
  );
}

export function SpringEditor({
  value,
  defaultValue,
  onChange,
  accent,
  locale,
  reduceMotion,
}: {
  value: SpringConfig;
  defaultValue?: SpringConfig;
  onChange: (next: SpringConfig) => void;
  accent: string;
  locale: PanelLocale;
  reduceMotion: boolean;
}) {
  const field = (
    key: keyof SpringConfig,
    label: typeof COPY.stiffness,
    info: typeof COPY.stiffness,
    range: { min: number; max: number; step: number },
  ) => (
    <SettingNumber
      label={tx(label, locale)}
      info={tx(info, locale)}
      locale={locale}
      value={value[key]}
      defaultValue={defaultValue?.[key]}
      {...range}
      scrub
      reduceMotion={reduceMotion}
      onChange={(next) => onChange({ ...value, [key]: next })}
      modified={defaultValue != null && defaultValue[key] !== value[key]}
      onResetValue={
        defaultValue != null
          ? () => onChange({ ...value, [key]: defaultValue[key] })
          : undefined
      }
    />
  );
  return (
    <div className="flex w-full flex-col gap-2">
      <div
        className={cn("w-full overflow-hidden rounded", fieldChrome)}
        style={{ background: FIELD }}
      >
        <SpringGraph value={value} accent={accent} />
      </div>
      {field("stiffness", COPY.stiffness, COPY.stiffnessInfo, {
        min: 1,
        max: 1000,
        step: 1,
      })}
      {field("damping", COPY.damping, COPY.dampingInfo, {
        min: 0,
        max: 100,
        step: 0.5,
      })}
      {field("mass", COPY.mass, COPY.massInfo, { min: 0.1, max: 10, step: 0.1 })}
      <SettingNumber
        label={tx(COPY.duration, locale)}
        info={tx(COPY.durationInfo, locale)}
        locale={locale}
        value={0}
        min={0}
        max={0}
        onChange={() => {}}
        reduceMotion={reduceMotion}
        readOnly
        readOnlyLabel={`≈ ${springSettleMs(value)}`}
        unit="ms"
      />
    </div>
  );
}
