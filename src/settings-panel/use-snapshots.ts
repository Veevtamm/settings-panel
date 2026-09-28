"use client";

import { useEffect, useState } from "react";
import { SNAPSHOT_SLOTS } from "./chrome";
import { readMigratedPanelUi, valuesEqual } from "./model";

const emptySlots = <T>(): (T | null)[] =>
  Array.from({ length: SNAPSHOT_SLOTS }, () => null);

/** Presets row: 5 slots in `${panelId}:snapshots`, only this page's keys apply. */
export function usePanelSnapshots<TSettings>({
  panelId,
  legacyPanelIds,
  settings,
  pageKeys,
  onSettingsChange,
}: {
  panelId: string;
  legacyPanelIds: readonly string[];
  settings: TSettings;
  pageKeys: readonly (keyof TSettings)[];
  onSettingsChange: (patch: Partial<TSettings>, slot: number) => void;
}) {
  const [snapshots, setSnapshots] = useState<(TSettings | null)[]>(emptySlots);
  const [activeSnapshot, setActiveSnapshot] = useState<number | null>(null);
  const legacyKey = legacyPanelIds.join("\0");

  useEffect(() => {
    const reset = () => {
      setSnapshots(emptySlots());
      setActiveSnapshot(null);
    };
    try {
      const raw = readMigratedPanelUi(
        panelId,
        ":snapshots",
        legacyKey ? legacyKey.split("\0") : [],
      );
      if (!raw) return reset();
      const parsed = JSON.parse(raw) as {
        slots?: (TSettings | null)[];
        active?: number | null;
        panelId?: string;
      };
      if (parsed.panelId != null && parsed.panelId !== panelId) return reset();
      setSnapshots(
        Array.isArray(parsed.slots)
          ? Array.from(
              { length: SNAPSHOT_SLOTS },
              (_, index) => parsed.slots?.[index] ?? null,
            )
          : emptySlots(),
      );
      setActiveSnapshot(
        typeof parsed.active === "number" ? parsed.active : null,
      );
    } catch {
      reset();
    }
  }, [legacyKey, panelId]);

  const persist = (slots: (TSettings | null)[], active: number | null) => {
    setSnapshots(slots);
    setActiveSnapshot(active);
    try {
      localStorage.setItem(
        `${panelId}:snapshots`,
        JSON.stringify({ slots, active, panelId }),
      );
    } catch {
      /* quota / private mode */
    }
  };

  const saveSnapshot = (index: number) => {
    persist(
      snapshots.map((slot, i) => (i === index ? settings : slot)),
      index,
    );
  };

  const saveCurrentToPreset = () => {
    const empty = snapshots.findIndex((slot) => slot == null);
    saveSnapshot(empty >= 0 ? empty : (activeSnapshot ?? 0));
  };

  const applySnapshot = (index: number) => {
    const snap = snapshots[index];
    if (snap == null) return;
    const patch = {} as Partial<TSettings>;
    for (const key of pageKeys) {
      if (Object.prototype.hasOwnProperty.call(snap, key)) {
        patch[key] = snap[key];
      }
    }
    onSettingsChange(patch, index);
    persist(snapshots, index);
  };

  const clearSnapshot = (index: number) => {
    persist(
      snapshots.map((slot, i) => (i === index ? null : slot)),
      activeSnapshot === index ? null : activeSnapshot,
    );
  };

  const snapshotDrifted = (index: number) => {
    const snap = snapshots[index];
    if (snap == null) return false;
    return pageKeys.some((key) => !valuesEqual(settings[key], snap[key]));
  };

  /** File import: slots arrive as-is; active preset is dropped. */
  const replaceSnapshots = (slots: readonly (TSettings | null)[]) => {
    persist(
      Array.from({ length: SNAPSHOT_SLOTS }, (_, index) => slots[index] ?? null),
      null,
    );
  };

  return {
    snapshots,
    activeSnapshot,
    replaceSnapshots,
    saveSnapshot,
    saveCurrentToPreset,
    applySnapshot,
    clearSnapshot,
    snapshotDrifted,
  };
}
