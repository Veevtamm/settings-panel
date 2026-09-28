/** G5: move scene values between browsers — `?settings=` link and a JSON file. */

export const SETTINGS_LINK_PARAM = "settings";

function toBase64Url(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(raw: string) {
  const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** `{ p: panelId, v: values }` → URL-safe token. */
export function encodeSettingsToken(panelId: string, values: object) {
  return toBase64Url(JSON.stringify({ p: panelId, v: values }));
}

/** Token → values, only when it was made for this panel. */
export function decodeSettingsToken(
  token: string,
  panelId: string,
): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(fromBase64Url(token)) as {
      p?: unknown;
      v?: unknown;
    };
    if (parsed.p !== panelId) return null;
    if (parsed.v == null || typeof parsed.v !== "object") return null;
    return parsed.v as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Current page URL with `?settings=` set (other params kept). */
export function settingsLinkUrl(href: string, token: string) {
  const url = new URL(href);
  url.searchParams.set(SETTINGS_LINK_PARAM, token);
  return url.toString();
}

/**
 * Keep keys this page owns whose type matches the reference value
 * (number stays number, hex stays string, `easings` stays an object).
 */
export function sanitizeImported<TSettings>(
  raw: Record<string, unknown>,
  keys: readonly (keyof TSettings)[],
  reference: TSettings,
): Partial<TSettings> {
  const out = {} as Partial<TSettings>;
  for (const key of keys) {
    const name = String(key);
    if (!Object.prototype.hasOwnProperty.call(raw, name)) continue;
    const value = raw[name];
    const ref = reference[key];
    if (typeof value !== typeof ref) continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    if (typeof ref === "object" && (ref === null) !== (value === null)) continue;
    if (Array.isArray(ref) !== Array.isArray(value)) continue;
    out[key] = value as TSettings[keyof TSettings];
  }
  return out;
}

export type SettingsFile<TSettings> = {
  panelId: string;
  storageLabel: string;
  savedAt: string;
  settings: Partial<TSettings>;
  snapshots?: (Partial<TSettings> | null)[];
};

export function parseSettingsFile(text: string): {
  panelId?: string;
  settings: Record<string, unknown>;
  snapshots?: unknown[];
} | null {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const settings = parsed.settings;
    if (settings == null || typeof settings !== "object") return null;
    return {
      panelId: typeof parsed.panelId === "string" ? parsed.panelId : undefined,
      settings: settings as Record<string, unknown>,
      snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : undefined,
    };
  } catch {
    return null;
  }
}
