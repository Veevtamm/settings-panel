import {
  defaultsOf,
  type ParamEntry,
  type Params,
  type SettingsOf,
} from "../settings-panel/params";
import {
  SETTING_ANCHORS,
  SETTING_FRAME_ORIENTS,
  SETTING_TEXT_ALIGNS,
  SETTING_X_ANCHORS,
} from "../settings-panel/types";
import { normalizeHex } from "./hex";

type Raw = Record<string, unknown>;

export type ParamStoreOptions = {
  /** `<project>-<scene>-settings`. */
  storageKey: string;
  /** Read in order while `storageKey` is empty; save writes only `storageKey`. */
  legacyKeys?: readonly string[];
  /** Rename / reshape old stored JSON before it is checked against the registry. */
  migrate?: (raw: Raw) => Raw;
};

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function sameShape(value: unknown, fallback: unknown) {
  if (typeof value !== typeof fallback) return false;
  if (typeof fallback === "number") return Number.isFinite(value);
  if (typeof fallback !== "object") return true;
  if ((fallback === null) !== (value === null)) return false;
  return Array.isArray(fallback) === Array.isArray(value);
}

function oneOf<T>(list: readonly T[], value: unknown, fallback: T): T {
  return list.includes(value as T) ? (value as T) : fallback;
}

/** Write the checked value(s) of one registry entry into `out`. */
function readEntry(name: string, entry: ParamEntry, raw: Raw, out: Raw) {
  switch (entry.kind) {
    case "number": {
      const value = raw[name];
      if (!finite(value)) return;
      // Scrub rows widen their track for typed values past `max`.
      out[name] = clamp(value, entry.min, entry.scrub ? Infinity : entry.max);
      return;
    }
    case "toggle":
      if (typeof raw[name] === "boolean") out[name] = raw[name];
      return;
    case "color":
      out[name] = normalizeHex(raw[name], entry.default);
      return;
    case "enum":
      out[name] = oneOf(
        entry.options.map((option) => option.value),
        raw[name],
        entry.default,
      );
      return;
    case "text":
      if (typeof raw[name] === "string") out[name] = raw[name];
      return;
    case "anchor":
      out[name] = oneOf(SETTING_ANCHORS, raw[name], entry.default);
      return;
    case "xAnchor":
      out[name] = oneOf(SETTING_X_ANCHORS, raw[name], entry.default);
      return;
    case "textAlign":
      out[name] = oneOf(SETTING_TEXT_ALIGNS, raw[name], entry.default);
      return;
    case "orient":
      out[name] = oneOf(SETTING_FRAME_ORIENTS, raw[name], entry.default);
      return;
    case "value":
      if (sameShape(raw[name], entry.default)) out[name] = raw[name];
      return;
    case "range": {
      const from = raw[entry.fromKey];
      const to = raw[entry.toKey];
      if (!finite(from) || !finite(to)) return;
      const a = clamp(from, entry.min, entry.max);
      const b = clamp(to, entry.min, entry.max);
      out[entry.fromKey] = Math.min(a, b);
      out[entry.toKey] = Math.max(a, b);
      return;
    }
    case "pair":
      for (const field of entry.fields) {
        const value = raw[field.key];
        if (finite(value)) out[field.key] = clamp(value, field.min, field.max);
      }
      return;
    case "player":
      for (const key of Object.keys(entry.defaults)) {
        const value = raw[key];
        if (finite(value) && value >= 0) out[key] = value;
      }
      return;
  }
}

/**
 * I1: load / save / snapshot for `useLocalSettingsStore`, built from the registry.
 * Stored values are checked per param (ranges, hex, enum options); unknown keys drop.
 */
export function createParamStore<D extends Record<string, ParamEntry>>(
  params: Params<D>,
  { storageKey, legacyKeys = [], migrate }: ParamStoreOptions,
) {
  type S = SettingsOf<D>;
  const defaults = defaultsOf(params);

  const parse = (raw: Raw): S => {
    const source = migrate ? migrate(raw) : raw;
    const out: Raw = { ...(defaults as Raw) };
    for (const name of Object.keys(params)) {
      readEntry(name, params[name] as ParamEntry, source, out);
    }
    return out as S;
  };

  const read = (): Raw | null => {
    for (const key of [storageKey, ...legacyKeys]) {
      const stored = window.localStorage.getItem(key);
      if (stored == null) continue;
      const parsed: unknown = JSON.parse(stored);
      if (parsed != null && typeof parsed === "object") return parsed as Raw;
    }
    return null;
  };

  const load = (): S => {
    if (typeof window === "undefined") return defaults;
    try {
      const raw = read();
      return raw ? parse(raw) : defaults;
    } catch {
      return defaults;
    }
  };

  let snapshot: S = defaults;
  let ready = false;

  return {
    storageKey,
    defaults,
    serverSnapshot: defaults,
    parse,
    load,
    getSnapshot(): S {
      if (!ready && typeof window !== "undefined") {
        snapshot = load();
        ready = true;
      }
      return snapshot;
    },
    refreshSnapshot() {
      snapshot = load();
      ready = true;
    },
    save(next: S) {
      snapshot = next;
      ready = true;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* quota / private mode */
      }
    },
  };
}
