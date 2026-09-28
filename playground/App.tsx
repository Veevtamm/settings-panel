import { useEffect, useMemo, useRef, useState } from "react";
import {
  AxisCurveEditor,
  L,
  SettingsMomentHud,
  SettingsPanel,
  SettingsTimeline,
  TransitionPlayer,
  layoutClips,
  springLinearEasing,
  springSettleMs,
  useLocalSettingsStore,
  waapiSpan,
  type PlayerSetting,
} from "../src";
import { cubicBezierToCss } from "../src/lib/cubic-bezier";
import { staggerSpan } from "../src/lib/player-clips";
import { DEFAULTS, P, store, type PlaygroundSettings as S } from "./params";
import { EASING_TARGETS, PANEL_ID, SPRING_TARGETS, groups } from "./schema";

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
              duration: staggerSpan(s.reelBarsMs, { count: 4, step: s.reelBarsStepMs }),
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
                  ...waapiSpan(inClip.start, inClip.duration, total),
                  easing: cubicBezierToCss(s.easings.card!),
                },
              ),
              ...bars.map((bar, index) =>
                bar.animate([{ transform: "scaleX(0.3)" }, { transform: "scaleX(1)" }], {
                  ...waapiSpan(
                    barsClip.start + Math.min(index, 3) * s.reelBarsStepMs,
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

  const reel: PlayerSetting<S> = useMemo(() => ({ ...P.reel, controller: player }), [player]);
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

  return (
    <main
      className="flex min-h-dvh p-16"
      style={{
        background: settings.backgroundColor,
        alignItems: flex(ay),
        justifyContent: flex(ax),
      }}
    >
      <div
        ref={cardRef}
        className="flex flex-col gap-3 transition-transform hover:scale-[1.04]"
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
          className="flex flex-col gap-2"
          style={{
            alignItems:
              settings.fit === "center" ? "center" : settings.fit === "right" ? "flex-end" : "flex-start",
          }}
        >
          {Array.from({ length: Math.min(settings.columns, 4) }, (_, index) => (
            <span
              key={index}
              className="block h-2 rounded-full bg-current opacity-30"
              style={{
                width: `${60 + ((index * 17) % 40)}%`,
                transformOrigin:
                  settings.order === "end" ? "right" : settings.order === "center" ? "center" : "left",
              }}
            />
          ))}
        </div>
      </div>

      <SettingsPanel
        panelId={PANEL_ID}
        storageLabel="playground"
        settings={settings}
        groups={groups}
        players={[reel]}
        defaultSettings={DEFAULTS}
        defaultOpenSections={["layout", "type", "color"]}
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
