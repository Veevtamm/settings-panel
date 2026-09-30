"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { valuesEqual } from "./model";
import { isPhysicalKey, UNDO_CODES } from "../lib/hotkeys";

/** One undo step: values before and after, for the keys the edit wrote. */
type HistoryStep<TSettings> = {
  before: Partial<TSettings>;
  after: Partial<TSettings>;
  /** Reset / preset: fixed caption instead of `label (key): old → new`. */
  label?: string;
  at: number;
};

export type HistoryNotice<TSettings> = {
  kind: "undo" | "redo";
  step: HistoryStep<TSettings>;
  id: number;
};

/** Edits of the same keys closer than this merge — a scrub drag is one step. */
const MERGE_MS = 800;
const LIMIT = 100;

const TYPING =
  "input:not([type=range]):not([type=checkbox]):not([type=radio]), textarea, select, [contenteditable=true]";

function sameKeys(a: object, b: object) {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  return ak.length === bk.length && ak.every((key) => bk.includes(key));
}

/**
 * G3: session history of panel edits (not persisted). `record` wraps
 * `onSettingsChange`; ⌘Z / ⇧⌘Z undo and redo outside text fields.
 */
export function useSettingsHistory<TSettings>({
  settings,
  onSettingsChange,
  enabled,
}: {
  settings: TSettings;
  onSettingsChange: (patch: Partial<TSettings>) => void;
  enabled: boolean;
}) {
  const settingsRef = useRef(settings);
  const applyRef = useRef(onSettingsChange);
  useLayoutEffect(() => {
    settingsRef.current = settings;
    applyRef.current = onSettingsChange;
  });
  const undoRef = useRef<HistoryStep<TSettings>[]>([]);
  const redoRef = useRef<HistoryStep<TSettings>[]>([]);
  const [notice, setNotice] = useState<HistoryNotice<TSettings> | null>(null);
  const [depth, setDepth] = useState({ undo: 0, redo: 0 });
  const sync = () =>
    setDepth({ undo: undoRef.current.length, redo: redoRef.current.length });

  const record = (patch: Partial<TSettings>, label?: string) => {
    const current = settingsRef.current;
    const before = {} as Partial<TSettings>;
    const after = {} as Partial<TSettings>;
    for (const key of Object.keys(patch) as (keyof TSettings)[]) {
      if (valuesEqual(current[key], patch[key])) continue;
      before[key] = current[key];
      after[key] = patch[key];
    }
    applyRef.current(patch);
    settingsRef.current = { ...current, ...patch };
    if (Object.keys(after).length === 0) return;
    const now = Date.now();
    const last = undoRef.current[undoRef.current.length - 1];
    if (
      last &&
      label == null &&
      last.label == null &&
      now - last.at < MERGE_MS &&
      sameKeys(last.after, after)
    ) {
      last.after = after;
      last.at = now;
    } else {
      undoRef.current.push({ before, after, label, at: now });
      if (undoRef.current.length > LIMIT) undoRef.current.shift();
    }
    redoRef.current = [];
    sync();
  };

  /** Edit applied elsewhere (Reset calls the scene's `onReset`). */
  const push = (
    before: Partial<TSettings>,
    after: Partial<TSettings>,
    label: string,
  ) => {
    if (Object.keys(after).length === 0) return;
    settingsRef.current = { ...settingsRef.current, ...after };
    undoRef.current.push({ before, after, label, at: Date.now() });
    if (undoRef.current.length > LIMIT) undoRef.current.shift();
    redoRef.current = [];
    sync();
  };

  const step = (kind: "undo" | "redo") => {
    const from = kind === "undo" ? undoRef : redoRef;
    const to = kind === "undo" ? redoRef : undoRef;
    const item = from.current.pop();
    if (!item) return false;
    const patch = kind === "undo" ? item.before : item.after;
    applyRef.current(patch);
    settingsRef.current = { ...settingsRef.current, ...patch };
    to.current.push({ ...item, at: 0 });
    sync();
    setNotice((prev) => ({ kind, step: item, id: (prev?.id ?? 0) + 1 }));
    return true;
  };

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || !isPhysicalKey(event, UNDO_CODES))
        return;
      if (event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest(TYPING)) return;
      const done = step(event.shiftKey ? "redo" : "undo");
      if (done) event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  return {
    record,
    push,
    undo: () => step("undo"),
    redo: () => step("redo"),
    canUndo: depth.undo > 0,
    canRedo: depth.redo > 0,
    notice,
    clearNotice: () => setNotice(null),
  };
}
