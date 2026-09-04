import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function round200(n: number) {
  return Math.round(n * 200) / 200
}

export function loadNum(
  raw: unknown,
  fallback: number,
  min: number,
  max: number,
  round = false,
): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return clampNumber(round ? Math.round(n) : n, min, max)
}
