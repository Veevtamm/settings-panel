"use client";

import { useEffect, useRef, useState } from "react";
import { copyText } from "../lib/copy-text";
import { COPY_DONE_MS } from "./chrome";

/** Copy to clipboard, then flash `copied` for the dock/player checkmark window. */
export function useCopyFlash() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    };
  }, []);

  async function copy(text: string) {
    if (!(await copyText(text))) return false;
    setCopied(true);
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), COPY_DONE_MS);
    return true;
  }

  return { copied, copy };
}
