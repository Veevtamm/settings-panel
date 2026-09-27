"use client";

import { useEffect, useLayoutEffect, useState } from "react";

/** `hideBelow={480}` → chrome only when viewport is at least 480px wide. */
export function useViewportMinWidth(px?: number) {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    if (px == null) {
      setOk(true);
      return;
    }
    const mq = window.matchMedia(`(min-width: ${px}px)`);
    const apply = () => setOk(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [px]);
  return ok;
}

export function useViewportSize() {
  const [size, setSize] = useState({ vw: 1280, vh: 800 });
  useLayoutEffect(() => {
    const apply = () =>
      setSize({ vw: window.innerWidth, vh: window.innerHeight });
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);
  return size;
}

export function useViewportHeight() {
  return useViewportSize().vh;
}

/** `enabled={false}` unmounts (prod); `hideBelow` replaces CSS `display:none`. */
export function useChromeVisible(enabled = true, hideBelow?: number) {
  const wide = useViewportMinWidth(hideBelow);
  return enabled && wide;
}
