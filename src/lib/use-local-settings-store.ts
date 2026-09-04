"use client";

import { useCallback, useSyncExternalStore } from "react";

const listenersByKey = new Map<string, Set<() => void>>();
const NO_EXTRA_KEYS: readonly string[] = [];

function listenersFor(storageKey: string): Set<() => void> {
  let set = listenersByKey.get(storageKey);
  if (!set) {
    set = new Set();
    listenersByKey.set(storageKey, set);
  }
  return set;
}

export function useLocalSettingsStore<T>(options: {
  storageKey: string;
  extraKeys?: readonly string[];
  getSnapshot: () => T;
  refreshSnapshot: () => void;
  save: (next: T) => void;
  serverSnapshot: T;
}): [T, (next: T | ((prev: T) => T)) => void] {
  const {
    storageKey,
    extraKeys = NO_EXTRA_KEYS,
    getSnapshot,
    refreshSnapshot,
    save,
    serverSnapshot,
  } = options;

  const subscribe = useCallback(
    (onChange: () => void) => {
      const listeners = listenersFor(storageKey);
      listeners.add(onChange);
      const onStorage = (event: StorageEvent) => {
        if (
          event.key === storageKey ||
          extraKeys.some((key) => key === event.key)
        ) {
          refreshSnapshot();
          onChange();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener("storage", onStorage);
      };
    },
    [extraKeys, refreshSnapshot, storageKey],
  );

  const settings = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => serverSnapshot,
  );

  const setSettings = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === "function"
          ? (next as (prev: T) => T)(getSnapshot())
          : next;
      save(resolved);
      for (const listener of listenersFor(storageKey)) listener();
    },
    [getSnapshot, save, storageKey],
  );

  return [settings, setSettings];
}
