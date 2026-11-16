"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PanelStyle } from "../lib/panel-theme";

const PanelStyleContext = createContext<PanelStyle>("classic");

export function PanelStyleProvider({
  style,
  children,
}: {
  style: PanelStyle;
  children: ReactNode;
}) {
  return (
    <PanelStyleContext.Provider value={style}>
      {children}
    </PanelStyleContext.Provider>
  );
}

/** Chrome of the connected panel. The timeline window does not read this. */
export function useChromeStyle() {
  return useContext(PanelStyleContext);
}
