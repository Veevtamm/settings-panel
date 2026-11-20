"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChangedName, rowLabel } from "./kit-chrome";

const ink = "text-[14px] leading-4 text-white outline-none placeholder:text-white/50";

/** Width left for the value once the name, the side button and the row insets are taken. */
function valueSlot(root: HTMLElement, label: HTMLElement | null, aside: HTMLElement | null) {
  const gaps = (label ? 8 : 0) + (aside ? 8 : 0);
  return root.clientWidth - 8 - (label?.offsetWidth ?? 0) - (aside?.offsetWidth ?? 0) - gaps;
}

/** Copy on a row. When the value no longer fits that one line, it becomes the block: name on the first line, text below. */
export function TextField({
  label,
  value,
  onChange,
  rows = 1,
  placeholder,
  caption = true,
  plain = false,
  aside,
  changed = false,
  onReset,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Rows of the block once the value no longer fits a single line. */
  rows?: number;
  placeholder?: string;
  /** The name. Off: `placeholder` is the empty hint, `label` stays for the screen reader. */
  caption?: boolean;
  /** Sits in a black block with the other rows: no own fill or corners. */
  plain?: boolean;
  /** A control on the right of the name line, such as the link button. */
  aside?: ReactNode;
  /** The value differs from the published copy. The name grows a reset dot. */
  changed?: boolean;
  onReset?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const asideRef = useRef<HTMLSpanElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const restoreFocus = useRef(false);
  const [expanded, setExpanded] = useState(() => value.includes("\n"));
  const [fade, setFade] = useState({ top: false, bottom: false });

  useLayoutEffect(() => {
    const root = rootRef.current;
    const probe = probeRef.current;
    if (!root || !probe) return;
    const measure = () => {
      const next = value.includes("\n") || (value.length > 0 && probe.offsetWidth > valueSlot(root, labelRef.current, asideRef.current));
      const field = fieldRef.current;
      if (next !== expanded && field && document.activeElement === field) restoreFocus.current = true;
      setExpanded((current) => (current === next ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [value, label, aside, expanded, changed]);

  useLayoutEffect(() => {
    if (!restoreFocus.current) return;
    restoreFocus.current = false;
    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    const end = field.value.length;
    field.setSelectionRange(end, end);
  }, [expanded]);

  function syncFade() {
    const el = fieldRef.current;
    if (!(el instanceof HTMLTextAreaElement)) return;
    const next = {
      top: el.scrollTop > 1,
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 1,
    };
    setFade((current) => (current.top === next.top && current.bottom === next.bottom ? current : next));
  }

  useLayoutEffect(() => {
    if (!expanded) return;
    syncFade();
    const el = fieldRef.current;
    if (!el) return;
    const observer = new ResizeObserver(syncFade);
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded, value, rows]);

  const fadeMask =
    fade.top || fade.bottom
      ? `linear-gradient(to bottom, ${fade.top ? "transparent" : "#000"} 0, #000 12px, #000 calc(100% - 16px), ${fade.bottom ? "transparent" : "#000"} 100%)`
      : undefined;

  const shell = plain ? "" : "rounded-lg bg-black";
  const probe = (
    <span ref={probeRef} aria-hidden className={`pointer-events-none absolute top-0 left-0 whitespace-nowrap opacity-0 ${ink}`}>
      {value}
    </span>
  );
  const name = caption ? (
    <span ref={labelRef} className="flex shrink-0">
      {onReset ? (
        <ChangedName changed={changed} label={label} onReset={onReset} />
      ) : (
        <span className={rowLabel}>{label}</span>
      )}
    </span>
  ) : null;
  const side = aside ? (
    <span ref={asideRef} className="shrink-0">
      {aside}
    </span>
  ) : null;

  if (!expanded) {
    return (
      <div ref={rootRef} className={`group/row relative flex h-8 w-full items-center gap-2 px-1 text-[14px] leading-none text-white ${shell}`}>
        {probe}
        {name}
        <input
          ref={(node) => {
            fieldRef.current = node;
          }}
          type="text"
          value={value}
          placeholder={placeholder}
          aria-label={label}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
          className={`ml-auto min-w-0 max-w-full bg-transparent text-right [field-sizing:content] ${value ? "decoration-1 underline-offset-[3px] focus:underline fine-hover:hover:underline" : ""} ${ink}`}
        />
        {side}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={`relative w-full text-white ${shell}`}>
      {probe}
      <div className="group/row flex h-8 items-center justify-between gap-2 px-1 text-[14px] leading-none">
        {name}
        {side}
      </div>
      <textarea
        ref={(node) => {
          fieldRef.current = node;
        }}
        value={value}
        rows={Math.max(rows, 2)}
        placeholder={placeholder}
        aria-label={label}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onScroll={syncFade}
        style={fadeMask ? { maskImage: fadeMask, WebkitMaskImage: fadeMask } : undefined}
        className={`block min-h-[72px] w-full resize-y overflow-y-auto bg-transparent px-1 pt-1 pb-2 [scrollbar-width:none] [&::-webkit-resizer]:opacity-0 [&::-webkit-scrollbar]:hidden ${ink}`}
      />
      <svg viewBox="0 0 12 12" aria-hidden className="pointer-events-none absolute right-1.5 bottom-1.5 size-3 text-white/60">
        <path d="M10.5 7.5 7.5 10.5M10.5 4.5 4.5 10.5" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </div>
  );
}
