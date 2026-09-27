/**
 * Theme colors for panel plot canvases (zone / axis editors).
 * Canvas 2D cannot resolve `var(--…)`, so values are read from computed
 * style at draw time and re-read when the panel theme attribute flips.
 */

export type PlotTheme = {
  bg: string;
  grid: string;
  diag: string;
  ghost: string;
  help: string;
  band: string;
  strong: string;
  handleFill: string;
};

const FALLBACK: PlotTheme = {
  bg: "rgba(255,255,255,0.04)",
  grid: "rgba(255,255,255,0.1)",
  diag: "rgba(255,255,255,0.15)",
  ghost: "rgba(255,255,255,0.22)",
  help: "rgba(255,255,255,0.25)",
  band: "rgba(255,255,255,0.08)",
  strong: "#ffffff",
  handleFill: "#0a0a0a",
};

export function readPlotTheme(el: Element): PlotTheme {
  const css = getComputedStyle(el);
  const v = (name: string, fallback: string) =>
    css.getPropertyValue(name).trim() || fallback;
  return {
    bg: v("--sp-plot-bg", FALLBACK.bg),
    grid: v("--sp-plot-grid", FALLBACK.grid),
    diag: v("--sp-plot-diag", FALLBACK.diag),
    ghost: v("--sp-plot-ghost", FALLBACK.ghost),
    help: v("--sp-plot-help", FALLBACK.help),
    band: v("--sp-plot-band", FALLBACK.band),
    strong: v("--sp-plot-strong", FALLBACK.strong),
    handleFill: v("--sp-plot-handle", FALLBACK.handleFill),
  };
}

/** Redraw hook: watches the nearest `data-panel-theme` host for theme flips. */
export function observePanelTheme(
  el: Element,
  onThemeChange: () => void,
): () => void {
  const host = el.closest("[data-panel-theme]");
  if (!host) return () => {};
  const observer = new MutationObserver(onThemeChange);
  observer.observe(host, {
    attributes: true,
    attributeFilter: ["data-panel-theme"],
  });
  return () => observer.disconnect();
}
