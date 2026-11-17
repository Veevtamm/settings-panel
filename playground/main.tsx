import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  readPanelStyle,
  usePanelStyle,
  writePanelStyle,
  type PanelStyle,
} from "../src/lib/panel-theme";
import { AdminPage } from "./admin-page";
import { App } from "./App";
import { KitPage } from "./kit";
import { NewPage } from "./new-page";
import { PANEL_ID } from "./schema";
import "./styles.css";

function styleForPath(path: string): PanelStyle {
  return path === "/new" ? "new" : "classic";
}

function isSheet(path: string) {
  return path === "/kit" || path === "/admin";
}

if (typeof window !== "undefined" && !isSheet(window.location.pathname)) {
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

const path = window.location.pathname;
const Page = path === "/kit" ? KitPage : path === "/admin" ? AdminPage : Playground;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
