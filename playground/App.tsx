import { useEffect, useMemo, useRef, useState } from "react";
import {
  AxisCurveEditor,
  L,
  SettingsMomentHud,
  SettingsPanel,
  SettingsTimeline,
  TransitionPlayer,
  layoutClips,
  parseSkipCells,
  sampleAxisX,
  springLinearEasing,
  springSettleMs,
  useLocalSettingsStore,
  waapiSpan,
  type PlayerSetting,
} from "../src";
import { cubicBezierToCss } from "../src/lib/cubic-bezier";
import { staggerSpan } from "../src/lib/player-clips";
import { DEFAULTS, P, store, type PlaygroundSettings as S } from "./params";
import { EASING_TARGETS, MODULE_ROWS, PANEL_ID, SPRING_TARGETS, groupsFor } from "./schema";

const ORIENT_RATIO = { square: 1, portrait: 4 / 3, landscape: 3 / 4 } as const;

export function App() {
  const [settings, setSettings] = useLocalSettingsStore(store);
  const patch = (next: Partial<S>) => setSettings((prev) => ({ ...prev, ...next }));
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  });
  const cardRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(-1);

  const [player] = useState(
    () =>
      new TransitionPlayer({
        id: "reel",
        build: () => {
          const s = settingsRef.current;
          const card = cardRef.current;
          const bars = [...(barsRef.current?.children ?? [])] as HTMLElement[];
          const total = Math.max(1, s.reelTotalMs);
          const [inClip, barsClip] = layoutClips([
            { duration: s.reelInMs },
            {
              duration: staggerSpan(s.reelBarsMs, { count: s.columns, step: s.reelBarsStepMs }),
              start: s.reelBarsStartMs,
            },
          ]);
          if (!card || !inClip || !barsClip) return { animations: [], totalMs: total };
          return {
            totalMs: total,
            phases: [0, ...bars.map(() => 1)],
            animations: [
              card.animate(
                [{ transform: "none" }, { transform: "translateY(-16px) scale(1.06)" }],
                {
                  ...waapiSpan(inClip.start + s.cardLead, inClip.duration, total),
                  easing: cubicBezierToCss(s.easings.card!),
                },
              ),
              ...bars.map((bar, index) =>
                bar.animate([{ transform: "scaleX(0.3)" }, { transform: "scaleX(1)" }], {
                  ...waapiSpan(
                    barsClip.start + Math.min(index, Math.max(0, s.columns - 1)) * s.reelBarsStepMs,
                    s.reelBarsMs,
                    total,
                  ),
                  easing: cubicBezierToCss(s.easings.bars!),
                }),
              ),
            ],
          };
        },
      }),
  );
  useEffect(() => () => player.dispose(), [player]);
  useEffect(() => {
    player.rebuild();
  }, [player, settings]);

  const reel: PlayerSetting<S> = useMemo(() => {
    const base = P.reel;
    return {
      ...base,
      phases: base.phases.map((phase) =>
        phase.stagger
          ? { ...phase, stagger: { ...phase.stagger, count: settings.columns } }
          : phase,
      ) as typeof base.phases,
      controller: player,
    };
  }, [player, settings.columns]);
  const targets = [
    {
      player: reel,
      settings,
      defaultSettings: DEFAULTS,
      onSettingsChange: patch,
      easingIds: ["card", "bars"],
    },
  ];

  const hover = settings.springs.hover!;
  const ratio = ORIENT_RATIO[settings.orient as keyof typeof ORIENT_RATIO] ?? 1;
  const [ay, ax] = settings.anchor.includes(" ")
    ? settings.anchor.split(" ")
    : settings.anchor === "top" || settings.anchor === "bottom"
      ? [settings.anchor, "center"]
      : ["center", settings.anchor];
  const flex = (side: string | undefined) =>
    side === "top" || side === "left" ? "flex-start" : side === "bottom" || side === "right" ? "flex-end" : "center";
  const gaps = settings.barGaps
    .split(/[,;\s]+/)
    .map((part) => Number.parseInt(part, 10))
    .filter((n) => Number.isFinite(n));
  const gapAt = (index: number) => gaps[index] ?? gaps[gaps.length - 1] ?? 8;
  const skipped = parseSkipCells(settings.skipCells, MODULE_ROWS);
  const barPct = (index: number) => {
    const count = settings.columns;
    const t = count <= 1 ? 1 : index / (count - 1);
    const y = sampleAxisX(settings.axisPoints, settings.axisHandles, t);
    return Math.round(15 + Math.min(1, Math.max(0, y)) * 85);
  };
  const panelGroups = useMemo(
    () => groupsFor(settings),
    [settings],
  );

  return (
    <main
      className="flex min-h-dvh p-16"
      style={{
        background: settings.backgroundColor,
        alignItems: flex(ay),
        justifyContent: flex(ax),
      }}
    >
      {settings.showLayoutGrid ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0"
          style={{
            backgroundImage: `linear-gradient(${settings.gridLineColor} 1px, transparent 1px), linear-gradient(90deg, ${settings.gridLineColor} 1px, transparent 1px)`,
            backgroundSize: "64px 64px",
            opacity: 0.28,
          }}
        />
      ) : null}
      <div
        ref={cardRef}
        className="relative flex flex-col gap-3 transition-transform hover:scale-[1.04]"
        style={{
          width: settings.cardSize,
          minHeight: settings.cardSize * ratio,
          padding: `${settings.padY}px ${settings.padX}px`,
          borderRadius: settings.radius,
          background: settings.cardColor,
          opacity: settings.cardOpacity / 100,
          color: settings.textColor,
          textAlign: settings.align,
          boxShadow: settings.shadow ? "0 24px 60px rgba(0,0,0,0.35)" : "none",
          transitionDuration: `${springSettleMs(hover)}ms`,
          transitionTimingFunction: springLinearEasing(hover),
        }}
      >
        {settings.strokeWidth > 0 ? (
          <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full">
            <rect
              x={settings.strokeWidth / 2}
              y={settings.strokeWidth / 2}
              width={`calc(100% - ${settings.strokeWidth}px)`}
              height={`calc(100% - ${settings.strokeWidth}px)`}
              fill="none"
              stroke={settings.strokeColor}
              strokeWidth={settings.strokeWidth}
              strokeLinejoin={
                settings.strokeJoin === "bevel" || settings.strokeJoin === "round"
                  ? settings.strokeJoin
                  : "miter"
              }
              rx={Math.max(0, settings.radius - settings.strokeWidth / 2)}
            />
          </svg>
        ) : null}
        <h1
          className="font-sans leading-tight"
          style={{
            fontSize: settings.fontSize,
            fontWeight: Math.round((settings.wghtMin + settings.wghtMax) / 2),
          }}
        >
          {settings.title}
        </h1>
        <div
          ref={barsRef}
          className="flex flex-col"
          style={{
            alignItems:
              settings.fit === "center" ? "center" : settings.fit === "right" ? "flex-end" : "flex-start",
          }}
        >
          {Array.from({ length: settings.columns }, (_, index) => (
            <span
              key={index}
              className="block bg-current opacity-30"
              style={{
                height: settings.barsBlocks ? 16 : Math.max(2, Math.round(settings.fontSize / 12)),
                width: settings.barsFill ? "100%" : `${barPct(index)}%`,
                marginBottom: index === settings.columns - 1 ? 0 : gapAt(index),
                borderRadius:
                  settings.barCap === "sharp" ? 0 : settings.barCap === "soft" ? 2 : 999,
                transformOrigin:
                  settings.order === "end" ? "right" : settings.order === "center" ? "center" : "left",
              }}
            />
          ))}
        </div>
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${settings.columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: MODULE_ROWS * settings.columns }, (_, index) => {
            const row = Math.floor(index / settings.columns);
            const col = index % settings.columns;
            const hole = skipped[row]?.includes(col);
            return (
              <span
                key={index}
                className="h-4 rounded-[3px]"
                style={{ background: hole ? "transparent" : "currentColor", opacity: hole ? 1 : 0.4 }}
              />
            );
          })}
        </div>
      </div>

      <SettingsPanel
        panelId={PANEL_ID}
        storageLabel="playground"
        settings={settings}
        groups={panelGroups}
        players={[reel]}
        defaultSettings={DEFAULTS}
        defaultOpenSections={["stage", "card", "title", "bars"]}
        onSettingsChange={patch}
        onReset={() => setSettings(DEFAULTS)}
        easingTargets={EASING_TARGETS}
        springTargets={SPRING_TARGETS}
        curveSection={
          <AxisCurveEditor
            points={settings.axisPoints}
            handles={settings.axisHandles}
            selectedIndex={selected}
            onSelectedIndexChange={setSelected}
            localePanelId={PANEL_ID}
            onChange={({ points, handles }) => patch({ axisPoints: points, axisHandles: handles })}
          />
        }
        curveSectionTitle={L("Ось", "Axis")}
      />
      <SettingsTimeline panelId={PANEL_ID} showDockButton={false} targets={targets} />
      <SettingsMomentHud panelId={PANEL_ID} targets={targets} />
    </main>
  );
}
