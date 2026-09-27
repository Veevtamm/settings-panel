"use client";

import { usePanelLocale, usePanelTheme } from "../lib/panel-theme";
import { cn } from "../lib/utils";
import { momentHudTop } from "./chrome";
import { PANEL_COPY, tx, type PanelLocale } from "./locale";
import {
  formatMoment,
  momentCopyText,
  playerSegments,
  resolvePlayerTotal,
  usePlayerOpen,
  usePlayerState,
} from "./player";
import type { PlayerSetting, TimelineTarget } from "./types";
import { useCopyFlash } from "./use-copy-flash";
import { useChromeVisible } from "./use-chrome-visible";
import { useDockSlot } from "../lib/panel-theme";

/**
 * Moment HUD (Tools `Panel / Moment HUD`): `Load · 411 ms — фон` on the scene
 * while a player is open; click copies the moment + `?moment=` URL. One HUD
 * for every target of the dock — the open one renders.
 */
export function SettingsMomentHud({
  panelId,
  layoutPanelId,
  targets,
  locale: localeProp = "ru",
  className,
  enabled = true,
  hideBelow,
}: {
  panelId?: string;
  /** Same as on `SettingsPanel`: the HUD drops under a top-center Dock Bar. */
  layoutPanelId?: string;
  targets: readonly TimelineTarget[];
  locale?: PanelLocale;
  className?: string;
  enabled?: boolean;
  hideBelow?: number;
}) {
  const chromeId = layoutPanelId ?? panelId;
  const storedLocale = usePanelLocale(chromeId ?? "__timeline__");
  const theme = usePanelTheme(chromeId ?? "__timeline__");
  const locale = chromeId ? storedLocale : localeProp;
  const top = momentHudTop(useDockSlot(panelId, layoutPanelId));
  const visible = useChromeVisible(enabled, hideBelow);
  if (!visible) return null;
  return (
    <>
      {targets.map((target) => (
        <MomentHudItem
          key={target.player.controller.id}
          player={target.player}
          settings={target.settings}
          locale={locale}
          theme={theme}
          top={top}
          className={className}
        />
      ))}
    </>
  );
}

function MomentHudItem<TSettings>({
  player,
  settings,
  locale,
  theme,
  top,
  className,
}: {
  player: PlayerSetting<TSettings>;
  settings: TSettings;
  locale: PanelLocale;
  theme: string;
  top: number;
  className?: string;
}) {
  const open = usePlayerOpen(player.controller);
  if (!open) return null;
  return (
    <MomentHudOpen
      player={player}
      settings={settings}
      locale={locale}
      theme={theme}
      top={top}
      className={className}
    />
  );
}

function MomentHudOpen<TSettings>({
  player,
  settings,
  locale,
  theme,
  top,
  className,
}: {
  player: PlayerSetting<TSettings>;
  settings: TSettings;
  locale: PanelLocale;
  theme: string;
  top: number;
  className?: string;
}) {
  const state = usePlayerState(player.controller);
  const { copied, copy } = useCopyFlash();
  const label = tx(player.label, locale);
  const unit = player.unit ?? "ms";
  const segments = playerSegments(player, settings, locale);
  const total = resolvePlayerTotal(player, settings);
  return (
    <button
      type="button"
      data-settings-panel=""
      data-panel-theme={theme}
      title={tx(PANEL_COPY.copyMoment, locale)}
      onClick={() => {
        void copy(
          momentCopyText(
            label,
            player.controller.id,
            state.q,
            segments,
            total,
            unit,
          ),
        );
      }}
      className={cn(
        "fixed left-1/2 z-[100] -translate-x-1/2 rounded-md px-2.5 py-1.5 font-mono text-[12px] leading-[16px] tabular-nums text-[color:var(--sp-fg)] outline-none backdrop-blur-[16px] focus-visible:ring-1 focus-visible:ring-[color:var(--sp-line-focus)]",
        className,
      )}
      style={{ top, background: "var(--sp-glass)" }}
    >
      {copied
        ? tx(PANEL_COPY.copied, locale)
        : formatMoment(label, state.q, segments, total, unit)}
    </button>
  );
}
