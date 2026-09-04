export const FRAME_ORIENTS = ["square", "portrait", "landscape"] as const;
export type FrameOrient = (typeof FRAME_ORIENTS)[number];

export function isFrameOrient(value: unknown): value is FrameOrient {
  return FRAME_ORIENTS.includes(value as FrameOrient);
}

export function loadFrameOrient(
  raw: unknown,
  fallback: FrameOrient,
): FrameOrient {
  return isFrameOrient(raw) ? raw : fallback;
}
