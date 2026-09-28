"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "../lib/utils";
import {
  EASE_OUT,
  PANEL_ENTER_MS,
  PANEL_EXIT_MS,
  SECTION_MS,
} from "./chrome";
import { useDeferredMount } from "./row";

export function panelPopClassName({
  open,
  fromBottom,
  skip,
}: {
  open: boolean;
  fromBottom: boolean;
  skip: boolean;
}) {
  if (skip) {
    return open ? "opacity-100" : "pointer-events-none opacity-0";
  }
  return cn(
    "transition-[opacity,transform]",
    open
      ? "opacity-100"
      : fromBottom
        ? "pointer-events-none translate-y-1.5 scale-[0.98] opacity-0"
        : "pointer-events-none -translate-y-1.5 scale-[0.98] opacity-0",
  );
}

export function panelPopStyle({
  open,
  skip,
}: {
  open: boolean;
  skip: boolean;
}): CSSProperties {
  if (skip) return {};
  return {
    transitionDuration: open ? `${PANEL_ENTER_MS}ms` : `${PANEL_EXIT_MS}ms`,
    transitionTimingFunction: EASE_OUT,
  };
}

export function DockBarSlot({
  open,
  reduceMotion,
  children,
}: {
  open: boolean;
  reduceMotion: boolean;
  children: ReactNode;
}) {
  const mounted = useDeferredMount(open, reduceMotion, PANEL_EXIT_MS);
  const innerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [clip, setClip] = useState(true);

  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const apply = () => {
      setWidth(open ? Math.max(inner.scrollWidth, inner.offsetWidth) : 0);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [mounted, open]);

  useEffect(() => {
    if (!open) {
      setClip(true);
      return;
    }
    if (reduceMotion) {
      setClip(false);
      return;
    }
    const id = window.setTimeout(() => setClip(false), PANEL_EXIT_MS);
    return () => window.clearTimeout(id);
  }, [open, reduceMotion]);

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "min-w-0",
        clip ? "overflow-hidden" : "overflow-visible",
        !reduceMotion && "transition-[width,opacity]",
      )}
      style={{
        opacity: open ? 1 : 0,
        width,
        ...(reduceMotion
          ? undefined
          : {
              transitionDuration: `${PANEL_EXIT_MS}ms`,
              transitionTimingFunction: EASE_OUT,
            }),
      }}
      inert={open ? undefined : true}
    >
      <div ref={innerRef} className="flex w-max items-center gap-1">
        {children}
      </div>
    </div>
  );
}

export function PanelViewSwitch({
  viewKey,
  reduceMotion,
  children,
}: {
  viewKey: string;
  reduceMotion: boolean;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const prevHeight = useRef<number | null>(null);
  const first = useRef(true);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const to = el.offsetHeight;
    if (first.current) {
      first.current = false;
      prevHeight.current = to;
      return;
    }
    const from = prevHeight.current ?? to;
    prevHeight.current = to;
    if (reduceMotion || from === to) return;
    const anim = el.animate([{ height: `${from}px` }, { height: `${to}px` }], {
      duration: SECTION_MS,
      easing: EASE_OUT,
    });
    el.style.overflow = "hidden";
    const done = () => {
      el.style.overflow = "";
    };
    void anim.finished.then(done).catch(done);
    return () => {
      anim.cancel();
      done();
    };
  }, [reduceMotion, viewKey]);

  return (
    <div ref={rootRef} className="min-h-0 w-full">
      <div key={viewKey} data-panel-view-body="">
        {children}
      </div>
    </div>
  );
}
