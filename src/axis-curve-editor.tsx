"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  AXIS_X0,
  AXIS_X1,
  autoHandle,
  cloneAxisHandles,
  cloneAxisPoints,
  ensureAxisHandles,
  isCornerHandle,
  moveAxisPoint,
  sampleAxisPath,
  sampleAxisX,
  segmentControls,
  setAxisPointCorner,
  type AxisHandle,
  type AxisPoint,
} from "./lib/axis-curve";
import { observePanelTheme, readPlotTheme } from "./lib/panel-plot-theme";
import { cn } from "./lib/utils";
import { FIELD, fieldChrome, pointerHeld } from "./settings-panel/chrome";
import { SettingToggle } from "./settings-panel/fields";
import { L, tx, type PanelLocale } from "./settings-panel/locale";
import { usePanelLocale } from "./lib/panel-theme";
import { usePrefersReducedMotion } from "./lib/prefers-reduced-motion";

export type AxisGhost = {
  points: AxisPoint[];
  handles: AxisHandle[];
  sharp?: number;
};

export type AxisCurveEditorProps = {
  points: AxisPoint[];
  handles: AxisHandle[];
  sharp?: number;
  /** Other axes — drawn faintly, not editable. */
  ghosts?: AxisGhost[];
  onChange: (next: { points: AxisPoint[]; handles: AxisHandle[] }) => void;
  selectedIndex?: number;
  onSelectedIndexChange?: (index: number) => void;
  className?: string;
  /** Square canvas size (panel column). */
  width?: number;
  /** Locale for the Corner/Smooth row. Falls back to `localePanelId` store, then ru. */
  locale?: PanelLocale;
  localePanelId?: string;
  legacyPanelIds?: readonly string[];
  /** Selected-knot Corner | Smooth row under the plot. Default on. */
  showPointKind?: boolean;
};

type PlotLayout = {
  canvasW: number;
  canvasH: number;
  x: number;
  y: number;
  w: number;
  h: number;
  screenX: number;
  screenY: number;
  screenW: number;
  screenH: number;
};

function handleOf(
  pts: AxisPoint[],
  handles: AxisHandle[],
  j: number,
): [number, number, number, number] {
  const h = handles[j] ?? autoHandle(pts, j);
  if (h.length > 2) return [h[0], h[1], h[2] ?? h[0], h[3] ?? h[1]];
  return [h[0], h[1], h[0], h[1]];
}

const SSR_ASPECT = 16 / 9;

function subscribeViewportAspect(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

function getViewportAspect() {
  return Math.max(
    0.45,
    Math.min(2.6, window.innerWidth / Math.max(1, window.innerHeight)),
  );
}

function useViewportAspect() {
  return useSyncExternalStore(
    subscribeViewportAspect,
    getViewportAspect,
    () => SSR_ASPECT,
  );
}

const EASING_REF_SIZE = 168;
const PLOT_PAD_RATIO = 18 / EASING_REF_SIZE;

function plotHandleR(size: number) {
  return Math.max(2.5, (3 * size) / EASING_REF_SIZE);
}

function plotStrokeMain(size: number) {
  return Math.max(1.25, (1.5 * size) / EASING_REF_SIZE);
}

/**
 * Square canvas (Figma 328). Inside: viewport-aspect screen frame letterboxed.
 * Full axis X (−0.25…1.25) extends past the screen sides; t 0…1 = screen height.
 * Pad / stroke / handle sizes match EasingCurveEditor.
 */
function layoutPlot(size: number, viewportAspect: number): PlotLayout {
  const pad = Math.round(PLOT_PAD_RATIO * size);
  const span = AXIS_X1 - AXIS_X0;
  const canvasW = size;
  const canvasH = size;
  const innerW = canvasW - pad * 2;
  const innerH = canvasH - pad * 2;

  // Largest viewport-aspect rect that fits in the padded square.
  let screenW: number;
  let screenH: number;
  if (innerW / innerH > viewportAspect) {
    screenH = innerH;
    screenW = screenH * viewportAspect;
  } else {
    screenW = innerW;
    screenH = screenW / viewportAspect;
  }

  const screenX = pad + (innerW - screenW) / 2;
  const screenY = pad + (innerH - screenH) / 2;

  // Plot maps full X span so [0,1] lands exactly on the screen width.
  const w = screenW * span;
  const h = screenH;
  const x = screenX - ((0 - AXIS_X0) / span) * w;
  const y = screenY;

  return {
    canvasW,
    canvasH,
    x,
    y,
    w,
    h,
    screenX,
    screenY,
    screenW,
    screenH,
  };
}

export function AxisCurveEditor({
  points,
  handles,
  sharp = 0,
  ghosts = [],
  onChange,
  selectedIndex,
  onSelectedIndexChange,
  className,
  width = 328,
  locale: localeProp,
  localePanelId,
  legacyPanelIds,
  showPointKind = true,
}: AxisCurveEditorProps) {
  const storedLocale = usePanelLocale(
    localePanelId ?? "__axis-curve__",
    legacyPanelIds,
  );
  const locale = localeProp ?? storedLocale;
  const reduceMotion = usePrefersReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [innerSel, setInnerSel] = useState(-1);
  const sel = selectedIndex ?? innerSel;
  const setSel = useCallback(
    (index: number) => {
      setInnerSel(index);
      onSelectedIndexChange?.(index);
    },
    [onSelectedIndexChange],
  );
  const dragRef = useRef<{
    kind: "knot" | "bend" | "handle";
    index: number;
    handleSign?: 1 | -1;
    break?: boolean;
  } | null>(null);

  const viewportAspect = useViewportAspect();
  const plotRef = useRef<PlotLayout>(layoutPlot(width, viewportAspect));
  plotRef.current = layoutPlot(width, viewportAspect);
  const { canvasW, canvasH } = plotRef.current;

  const ptsRef = useRef(points);
  const handlesRef = useRef(handles);
  ptsRef.current = points;
  handlesRef.current = ensureAxisHandles(points, handles);

  const ghostsRef = useRef(ghosts);
  ghostsRef.current = ghosts;

  const xToPx = useCallback((x: number, plot: PlotLayout) => {
    return plot.x + ((x - AXIS_X0) / (AXIS_X1 - AXIS_X0)) * plot.w;
  }, []);
  const tToPy = useCallback((t: number, plot: PlotLayout) => {
    return plot.y + t * plot.h;
  }, []);
  const pxToX = useCallback((px: number, plot: PlotLayout) => {
    return AXIS_X0 + ((px - plot.x) / plot.w) * (AXIS_X1 - AXIS_X0);
  }, []);
  const pyToT = useCallback((py: number, plot: PlotLayout) => {
    return (py - plot.y) / plot.h;
  }, []);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const g = cv.getContext("2d");
    if (!g) return;
    const dpr = window.devicePixelRatio || 1;
    const plot = plotRef.current;
    if (cv.width !== plot.canvasW * dpr || cv.height !== plot.canvasH * dpr) {
      cv.width = plot.canvasW * dpr;
      cv.height = plot.canvasH * dpr;
      cv.style.width = `${plot.canvasW}px`;
      cv.style.height = `${plot.canvasH}px`;
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, plot.canvasW, plot.canvasH);

    const theme = readPlotTheme(cv);
    const handleR = plotHandleR(plot.canvasW);
    const strokeMain = plotStrokeMain(plot.canvasW);

    g.fillStyle = theme.bg;
    g.beginPath();
    g.roundRect(plot.screenX, plot.screenY, plot.screenW, plot.screenH, 2);
    g.fill();

    g.strokeStyle = theme.grid;
    g.lineWidth = 0.5;
    for (const u of [0.25, 0.5, 0.75]) {
      g.beginPath();
      g.moveTo(xToPx(u, plot), plot.screenY);
      g.lineTo(xToPx(u, plot), plot.screenY + plot.screenH);
      g.stroke();
      g.beginPath();
      g.moveTo(plot.screenX, tToPy(u, plot));
      g.lineTo(plot.screenX + plot.screenW, tToPy(u, plot));
      g.stroke();
    }

    g.strokeStyle = theme.diag;
    g.lineWidth = 0.75;
    g.setLineDash([4, 4]);
    g.beginPath();
    g.moveTo(plot.screenX, plot.screenY + plot.screenH);
    g.lineTo(plot.screenX + plot.screenW, plot.screenY);
    g.stroke();
    g.setLineDash([]);

    for (const ghost of ghostsRef.current) {
      if (ghost.points.length < 2) continue;
      const ghostHs = ensureAxisHandles(ghost.points, ghost.handles);
      const ghostPath = sampleAxisPath(
        ghost.points,
        ghostHs,
        80,
        ghost.sharp ?? 0,
      );
      g.strokeStyle = theme.ghost;
      g.lineWidth = 1;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.beginPath();
      ghostPath.forEach((p, i) => {
        const px = xToPx(p.x, plot);
        const py = tToPy(p.t, plot);
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      });
      g.stroke();
    }

    const path = sampleAxisPath(ptsRef.current, handlesRef.current, 100, sharp);
    g.strokeStyle = theme.strong;
    g.lineWidth = strokeMain;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    path.forEach((p, i) => {
      const px = xToPx(p.x, plot);
      const py = tToPy(p.t, plot);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    });
    g.stroke();

    if (sel >= 0 && sel < ptsRef.current.length) {
      const j = sel;
      const knotCorner = isCornerHandle(handlesRef.current[j]);
      if (!knotCorner) {
        const k = ptsRef.current[j]!;
        const hh = handleOf(ptsRef.current, handlesRef.current, j);
        const vx = xToPx(k[1], plot);
        const vy = tToPy(k[0], plot);
        const ox = xToPx(k[1] + hh[1]!, plot);
        const oy = tToPy(k[0] + hh[0]!, plot);
        const ix = xToPx(k[1] - hh[3]!, plot);
        const iy = tToPy(k[0] - hh[2]!, plot);
        g.strokeStyle = theme.help;
        g.lineWidth = 1;
        g.beginPath();
        if (j > 0) {
          g.moveTo(ix, iy);
          g.lineTo(vx, vy);
        }
        if (j < ptsRef.current.length - 1) {
          g.moveTo(vx, vy);
          g.lineTo(ox, oy);
        }
        g.stroke();
        const handleMark = (dx: number, dy: number) => {
          const r = Math.max(2, handleR * 0.75);
          g.save();
          g.translate(dx, dy);
          g.rotate(Math.PI / 4);
          g.beginPath();
          g.rect(-r, -r, r * 2, r * 2);
          g.fillStyle = theme.strong;
          g.fill();
          g.strokeStyle = theme.handleFill;
          g.lineWidth = 1;
          g.stroke();
          g.restore();
        };
        if (j < ptsRef.current.length - 1) handleMark(ox, oy);
        if (j > 0) handleMark(ix, iy);
      }
    }

    ptsRef.current.forEach((pt, j) => {
      const px = xToPx(pt[1], plot);
      const py = tToPy(pt[0], plot);
      g.beginPath();
      if (isCornerHandle(handlesRef.current[j])) {
        const s = handleR * 2;
        g.rect(px - s / 2, py - s / 2, s, s);
      } else {
        g.arc(px, py, handleR, 0, Math.PI * 2);
      }
      g.fillStyle = theme.handleFill;
      g.fill();
      g.lineWidth = 1.5;
      g.strokeStyle = theme.strong;
      g.stroke();
    });
  }, [sel, sharp, tToPy, viewportAspect, xToPx]);

  useEffect(() => {
    draw();
  }, [draw, points, handles, ghosts, canvasW, canvasH]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    return observePanelTheme(cv, draw);
  }, [draw]);

  function localFromEvent(e: { clientX: number; clientY: number }) {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    const plot = plotRef.current;
    const px = ((e.clientX - r.left) / r.width) * plot.canvasW;
    const py = ((e.clientY - r.top) / r.height) * plot.canvasH;
    return {
      t: pyToT(py, plot),
      x: pxToX(px, plot),
      px,
      py,
      r,
      plot,
    };
  }

  function canvasPoint(
    t: number,
    x: number,
    r: DOMRect,
    plot: PlotLayout,
  ) {
    return {
      hx: r.left + (xToPx(x, plot) / plot.canvasW) * r.width,
      hy: r.top + (tToPy(t, plot) / plot.canvasH) * r.height,
    };
  }

  function nearKnot(e: { clientX: number; clientY: number }) {
    const f = localFromEvent(e);
    let best = -1;
    let bd = Infinity;
    ptsRef.current.forEach((pt, j) => {
      const { hx, hy } = canvasPoint(pt[0], pt[1], f.r, f.plot);
      const d = Math.hypot(e.clientX - hx, e.clientY - hy);
      if (d < bd) {
        bd = d;
        best = j;
      }
    });
    return { i: best, d: bd };
  }

  function nearCurve(e: { clientX: number; clientY: number }) {
    const f = localFromEvent(e);
    let best = 0.5;
    let bd = Infinity;
    for (let s = 0; s <= 120; s++) {
      const t = s / 120;
      const x = sampleAxisX(ptsRef.current, handlesRef.current, t, sharp);
      const { hx, hy } = canvasPoint(t, x, f.r, f.plot);
      const d = Math.hypot(e.clientX - hx, e.clientY - hy);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return { t: best, d: bd };
  }

  function nearHandle(e: { clientX: number; clientY: number }): 0 | 1 | -1 {
    if (sel < 0 || sel >= ptsRef.current.length) return 0;
    if (isCornerHandle(handlesRef.current[sel])) return 0;
    const f = localFromEvent(e);
    const h = handleOf(ptsRef.current, handlesRef.current, sel);
    const k = ptsRef.current[sel]!;
    const dTo = (tt: number, xx: number) => {
      const { hx, hy } = canvasPoint(tt, xx, f.r, f.plot);
      return Math.hypot(e.clientX - hx, e.clientY - hy);
    };
    if (
      sel < ptsRef.current.length - 1 &&
      dTo(k[0] + h[0]!, k[1] + h[1]!) < 14
    )
      return 1;
    if (sel > 0 && dTo(k[0] - h[2]!, k[1] - h[3]!) < 14) return -1;
    return 0;
  }

  function emit(pts: AxisPoint[], hs: AxisHandle[]) {
    onChange({ points: pts, handles: ensureAxisHandles(pts, hs) });
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const hs = nearHandle(e);
    if (hs) {
      dragRef.current = {
        kind: "handle",
        index: sel,
        handleSign: hs,
        break: !e.altKey,
      };
      return;
    }
    const kk = nearKnot(e);
    if (kk.d < 16) {
      if (e.altKey) {
        const H = cloneAxisHandles(handlesRef.current);
        const ch = H[kk.i];
        if (ch && ch.length > 2) {
          H[kk.i] =
            kk.i === ptsRef.current.length - 1
              ? [ch[2]!, ch[3]!]
              : [ch[0]!, ch[1]!];
          emit(ptsRef.current, H);
        }
        setSel(kk.i);
        return;
      }
      setSel(kk.i);
      dragRef.current = { kind: "knot", index: kk.i };
      return;
    }
    const c = nearCurve(e);
    if (c.d < 14) {
      let seg = 0;
      while (
        seg < ptsRef.current.length - 2 &&
        c.t > ptsRef.current[seg + 1]![0]
      )
        seg++;
      dragRef.current = { kind: "bend", index: seg };
      return;
    }
    setSel(-1);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    if (!pointerHeld(e)) {
      onPointerUp();
      return;
    }
    const f = localFromEvent(e);

    if (drag.kind === "knot") {
      const next = moveAxisPoint(
        ptsRef.current,
        handlesRef.current,
        drag.index,
        f.t,
        f.x,
      );
      drag.index = next.index;
      setSel(next.index);
      emit(next.pts, next.handles);
      return;
    }

    if (drag.kind === "handle" && drag.handleSign) {
      const j = drag.index;
      const k = ptsRef.current[j]!;
      const half: [number, number] = [
        Math.round((f.t - k[0]) * drag.handleSign * 200) / 200,
        Math.round((f.x - k[1]) * drag.handleSign * 200) / 200,
      ];
      const H = cloneAxisHandles(handlesRef.current);
      const cur = H[j] ?? autoHandle(ptsRef.current, j);
      if (!drag.break) {
        H[j] = half;
      } else {
        const four: [number, number, number, number] =
          cur.length > 2
            ? [cur[0], cur[1], cur[2] ?? cur[0], cur[3] ?? cur[1]]
            : [cur[0], cur[1], cur[0], cur[1]];
        if (drag.handleSign === 1) {
          four[0] = half[0];
          four[1] = half[1];
        } else {
          four[2] = half[0];
          four[3] = half[1];
        }
        H[j] = four;
      }
      emit(ptsRef.current, H);
      return;
    }

    if (drag.kind === "bend") {
      const i = drag.index;
      const k = ptsRef.current;
      const t0 = k[i]![0];
      const t1 = k[i + 1]![0];
      const v0 = k[i]![1];
      const v1 = k[i + 1]![1];
      const tp = Math.max(t0 + 0.01, Math.min(t1 - 0.01, f.t));
      const xp = Math.max(AXIS_X0, Math.min(AXIS_X1, f.x));
      const u = (tp - t0) / Math.max(1e-6, t1 - t0);
      const mu = 1 - u;
      const w1 = 3 * mu * mu * u;
      const w2 = 3 * mu * u * u;
      const den = w1 * w1 + w2 * w2;
      if (den < 1e-4) return;
      const cc = segmentControls(k, handlesRef.current, i);
      const bt =
        mu * mu * mu * t0 +
        3 * mu * mu * u * cc[0][0] +
        3 * mu * u * u * cc[1][0] +
        u * u * u * t1;
      const bx =
        mu * mu * mu * v0 +
        3 * mu * mu * u * cc[0][1] +
        3 * mu * u * u * cc[1][1] +
        u * u * u * v1;
      const dT = tp - bt;
      const dX = xp - bx;
      const c1 = [cc[0][0] + (dT * w1) / den, cc[0][1] + (dX * w1) / den];
      const c2 = [cc[1][0] + (dT * w2) / den, cc[1][1] + (dX * w2) / den];
      const H = cloneAxisHandles(handlesRef.current);
      const outA: [number, number] = [
        Math.round((c1[0]! - t0) * 200) / 200,
        Math.round((c1[1]! - v0) * 200) / 200,
      ];
      const inB: [number, number] = [
        Math.round((t1 - c2[0]!) * 200) / 200,
        Math.round((v1 - c2[1]!) * 200) / 200,
      ];
      const hA = H[i];
      const hB = H[i + 1];
      H[i] =
        hA && hA.length > 2
          ? [outA[0], outA[1], hA[2] ?? outA[0], hA[3] ?? outA[1]]
          : outA;
      H[i + 1] =
        hB && hB.length > 2
          ? [hB[0], hB[1], inB[0], inB[1]]
          : inB;
      emit(ptsRef.current, H);
    }
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  function onDoubleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const kk = nearKnot(e);
    if (kk.d < 16) {
      if (kk.i <= 0 || kk.i >= ptsRef.current.length - 1) return;
      const nextPts = cloneAxisPoints(ptsRef.current);
      const nextH = cloneAxisHandles(handlesRef.current);
      nextPts.splice(kk.i, 1);
      nextH.splice(kk.i, 1);
      setSel(-1);
      emit(nextPts, nextH);
      return;
    }
    const c = nearCurve(e);
    if (c.d < 14 && ptsRef.current.length < 12) {
      const f = localFromEvent(e);
      const t = Math.max(0.02, Math.min(0.98, Math.round(c.t * 200) / 200));
      const x = Math.max(
        AXIS_X0,
        Math.min(AXIS_X1, Math.round(f.x * 200) / 200),
      );
      const nextPts = cloneAxisPoints(ptsRef.current);
      const nextH = cloneAxisHandles(handlesRef.current);
      let at = nextPts.length - 1;
      for (let j = 1; j < nextPts.length; j++) {
        if (nextPts[j]![0] > t) {
          at = j;
          break;
        }
      }
      nextPts.splice(at, 0, [t, x]);
      nextH.splice(at, 0, null);
      emit(nextPts, nextH);
    }
  }

  const selectedIsSmooth =
    sel >= 0 &&
    sel < handlesRef.current.length &&
    !isCornerHandle(handlesRef.current[sel]);

  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      <div
        className={cn("w-full overflow-hidden rounded", fieldChrome)}
        style={{ background: FIELD }}
      >
        <canvas
          ref={canvasRef}
          className="block h-auto w-full touch-none"
          width={canvasW}
          height={canvasH}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
          aria-label={tx(L("Редактор оси", "Axis curve editor"), locale)}
        />
      </div>
      {showPointKind && sel >= 0 && sel < points.length ? (
        <SettingToggle
          label={tx(L("Точка", "Point"), locale)}
          info={tx(
            L(
              "Угловая — сегменты стыкуются без ручек Безье. Гладкая — кубическая кривая, ручки на выбранной точке.",
              "Corner — segments meet with no Bézier handles. Smooth — cubic curve, handles on the selected knot.",
            ),
            locale,
          )}
          locale={locale}
          control="segment"
          controlWidth={176}
          offLabel={tx(L("Угловая", "Corner"), locale)}
          onLabel={tx(L("Гладкая", "Smooth"), locale)}
          value={selectedIsSmooth}
          onChange={(smooth) =>
            emit(
              points,
              setAxisPointCorner(points, handles, sel, !smooth),
            )
          }
          reduceMotion={reduceMotion}
        />
      ) : null}
    </div>
  );
}
