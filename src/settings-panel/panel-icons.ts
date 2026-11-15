import { resolvePanelIcon, type PanelIconName } from "../panel-icon";

export function rowIconKey(id: string) {
  return `row:${id}`;
}

export function subsectionIconKey(groupId: string, titleKey: string) {
  return `sub:${groupId}:${titleKey}`;
}

export function resolvedPanelIcon(
  map: Record<string, PanelIconName>,
  id: string,
  fallback?: PanelIconName,
): PanelIconName | undefined {
  return map[id] ?? fallback;
}

export function panelIconIsModified(
  map: Record<string, PanelIconName>,
  id: string,
) {
  return map[id] != null;
}

export function nextPanelIcons(
  map: Record<string, PanelIconName>,
  id: string,
  fallback: PanelIconName | undefined,
  next: PanelIconName | undefined,
): Record<string, PanelIconName> {
  const resolvedNext = next ? (resolvePanelIcon(next) ?? next) : undefined;
  const resolvedFb = fallback
    ? (resolvePanelIcon(fallback) ?? fallback)
    : undefined;
  const out = { ...map };
  if (resolvedNext == null || resolvedNext === resolvedFb) delete out[id];
  else out[id] = resolvedNext;
  return out;
}
