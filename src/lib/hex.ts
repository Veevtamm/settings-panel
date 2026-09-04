export type Rgb = { r: number; g: number; b: number };

export function normalizeHex(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();
  const short = /^#([0-9a-fA-F]{3})$/.exec(value);
  if (short) {
    const digits = short[1];
    if (!digits || digits.length < 3) return fallback;
    const r = digits[0]!;
    const g = digits[1]!;
    const b = digits[2]!;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  const full = /^#([0-9a-fA-F]{6})$/.exec(value);
  if (full?.[1]) return `#${full[1]}`.toUpperCase();
  return fallback;
}

export function parseRgb(hex: string): Rgb | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  const digits = m?.[1];
  if (!digits) return null;
  const n = Number.parseInt(digits, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

export function lumaFromHex(hex: string): number {
  const rgb = parseRgb(hex);
  if (!rgb) return 0;
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

export function hexWithAlpha(color: string, alpha: number): string {
  const rgb = parseRgb(color);
  if (!rgb) return color;
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}
