"use client";

import { useEffect, useRef } from "react";
import {
  SETTINGS_LINK_PARAM,
  decodeSettingsToken,
  encodeSettingsToken,
  parseSettingsFile,
  sanitizeImported,
  settingsLinkUrl,
  type SettingsFile,
} from "../lib/settings-transfer";
import { PANEL_COPY, tx, type PanelLocale } from "./locale";
import { useCopyFlash } from "./use-copy-flash";

/**
 * G5: link with changed values, `.json` with values + preset slots.
 * `?settings=` for this panel applies once on load and leaves the URL.
 */
export function useSettingsTransfer<TSettings>({
  panelId,
  storageLabel,
  locale,
  settings,
  defaultSettings,
  pageKeys,
  settingDiffers,
  snapshots,
  replaceSnapshots,
  record,
  notify,
}: {
  panelId: string;
  storageLabel: string;
  locale: PanelLocale;
  settings: TSettings;
  defaultSettings?: TSettings;
  pageKeys: readonly (keyof TSettings)[];
  settingDiffers: (key: keyof TSettings) => boolean;
  snapshots: readonly (TSettings | null)[];
  replaceSnapshots: (slots: readonly (TSettings | null)[]) => void;
  record: (patch: Partial<TSettings>, label?: string) => void;
  notify: (text: string, detail?: string) => void;
}) {
  const { copied: linkCopied, copy } = useCopyFlash();
  const reference = defaultSettings ?? settings;
  const applyRef = useRef({ record, notify, pageKeys, reference, locale });
  useEffect(() => {
    applyRef.current = { record, notify, pageKeys, reference, locale };
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get(SETTINGS_LINK_PARAM);
    if (token == null) return;
    const raw = decodeSettingsToken(token, panelId);
    if (raw == null) return;
    // Hydration renders the server snapshot first; undo must see stored values.
    const frame = requestAnimationFrame(() => {
      url.searchParams.delete(SETTINGS_LINK_PARAM);
      window.history.replaceState(window.history.state, "", url.toString());
      const { record, notify, pageKeys, reference, locale } = applyRef.current;
      const patch = sanitizeImported(raw, pageKeys, reference);
      const count = Object.keys(patch).length;
      if (count === 0) return;
      record(patch, tx(PANEL_COPY.linkApplied, locale));
      notify(
        tx(PANEL_COPY.linkApplied, locale),
        tx(PANEL_COPY.parameters(count), locale),
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [panelId]);

  const pick = (keys: readonly (keyof TSettings)[]) => {
    const out = {} as Partial<TSettings>;
    for (const key of keys) out[key] = settings[key];
    return out;
  };

  const copyLink = async () => {
    const keys =
      defaultSettings == null ? pageKeys : pageKeys.filter(settingDiffers);
    const url = settingsLinkUrl(
      window.location.href,
      encodeSettingsToken(panelId, pick(keys)),
    );
    if (!(await copy(url))) return;
    notify(
      tx(PANEL_COPY.linkCopied, locale),
      keys.length === 0
        ? tx(PANEL_COPY.noChanges, locale)
        : tx(PANEL_COPY.parameters(keys.length), locale),
    );
  };

  const saveFile = () => {
    const file: SettingsFile<TSettings> = {
      panelId,
      storageLabel,
      savedAt: new Date().toISOString(),
      settings: pick(pageKeys),
      snapshots: [...snapshots],
    };
    const blob = new Blob([JSON.stringify(file, null, 2)], {
      type: "application/json",
    });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${panelId}-settings.json`;
    a.click();
    URL.revokeObjectURL(href);
    notify(tx(PANEL_COPY.fileSaved, locale), a.download);
  };

  const openFile = async (file: File) => {
    const parsed = parseSettingsFile(await file.text());
    const patch = parsed
      ? sanitizeImported(parsed.settings, pageKeys, reference)
      : {};
    const count = Object.keys(patch).length;
    if (parsed == null || count === 0) {
      notify(tx(PANEL_COPY.fileRejected, locale), file.name);
      return;
    }
    record(patch, tx(PANEL_COPY.fileApplied, locale));
    if (parsed.snapshots && parsed.panelId === panelId) {
      replaceSnapshots(
        parsed.snapshots.map((slot) =>
          slot != null && typeof slot === "object" ? (slot as TSettings) : null,
        ),
      );
    }
    notify(
      tx(PANEL_COPY.fileApplied, locale),
      tx(PANEL_COPY.parameters(count), locale),
    );
  };

  return { linkCopied, copyLink, saveFile, openFile };
}
