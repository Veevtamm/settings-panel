"use client";

import { useEffect, useState } from "react";
import {
  appendSavedCurve,
  parseSavedCurves,
  type SavedCurve,
} from "../lib/curve-library";
import type { CubicBezier } from "../lib/cubic-bezier";

const CURVES_EVENT = "settings-panel:curves";

function storageKey(panelId: string) {
  return `${panelId}:curves`;
}

export function readSavedCurves(panelId: string): SavedCurve[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(panelId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { curves?: unknown };
    return parseSavedCurves(parsed.curves);
  } catch {
    return [];
  }
}

function writeSavedCurves(panelId: string, curves: readonly SavedCurve[]) {
  try {
    localStorage.setItem(storageKey(panelId), JSON.stringify({ curves }));
  } catch {
    /* quota / private mode */
    return;
  }
  window.dispatchEvent(
    new CustomEvent(CURVES_EVENT, { detail: { panelId } }),
  );
}

/** Saved Bezier curves for this panel. The timeline and the Bezier window share the list. */
export function useCurveLibrary(panelId: string | undefined) {
  const [curves, setCurves] = useState<SavedCurve[]>([]);

  useEffect(() => {
    if (!panelId) return;
    const load = () => setCurves(readSavedCurves(panelId));
    load();
    const onCustom = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as { panelId?: string } | undefined;
      if (detail?.panelId === panelId) load();
    };
    window.addEventListener(CURVES_EVENT, onCustom);
    return () => window.removeEventListener(CURVES_EVENT, onCustom);
  }, [panelId]);

  const save = (label: string, curve: CubicBezier) => {
    if (!panelId) return;
    writeSavedCurves(
      panelId,
      appendSavedCurve(readSavedCurves(panelId), label, curve),
    );
  };

  return { curves, save };
}
