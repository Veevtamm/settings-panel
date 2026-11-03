import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  readPanelStyle,
  usePanelStyle,
  writePanelStyle,
  type PanelStyle,
} from "../src/lib/panel-theme";
import { App } from "./App";
import { NewPage } from "./new-page";
import { ShowPage } from "./show";
import { PANEL_ID } from "./schema";
import "./styles.css";

function styleForPath(path: string): PanelStyle {
  return path === "/new" ? "new" : "classic";
}

if (typeof window !== "undefined" && window.location.pathname !== "/show") {
  const boot = styleForPath(window.location.pathname);
  if (readPanelStyle(PANEL_ID) !== boot) writePanelStyle(PANEL_ID, boot);
}

function Playground() {
  const style = usePanelStyle(PANEL_ID);

  useEffect(() => {
    const path = style === "new" ? "/new" : "/";
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
  }, [style]);

  useEffect(() => {
    const onPop = () => {
      writePanelStyle(PANEL_ID, styleForPath(window.location.pathname));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return style === "new" ? <NewPage /> : <App />;
}

const Page = window.location.pathname === "/show" ? ShowPage : Playground;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
