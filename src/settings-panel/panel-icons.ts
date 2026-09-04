import { resolvePanelIcon, type SfSymbolName } from "../sf-symbol";

export function rowIconKey(id: string) {
  return `row:${id}`;
}

export function subsectionIconKey(groupId: string, titleKey: string) {
  return `sub:${groupId}:${titleKey}`;
}

export function resolvedPanelIcon(
  map: Record<string, SfSymbolName>,
  id: string,
  fallback?: SfSymbolName,
): SfSymbolName | undefined {
  return map[id] ?? fallback;
}

export function panelIconIsModified(
  map: Record<string, SfSymbolName>,
  id: string,
) {
  return map[id] != null;
}

export function nextPanelIcons(
  map: Record<string, SfSymbolName>,
  id: string,
  fallback: SfSymbolName | undefined,
  next: SfSymbolName | undefined,
): Record<string, SfSymbolName> {
  const resolvedNext = next ? (resolvePanelIcon(next) ?? next) : undefined;
  const resolvedFb = fallback
    ? (resolvePanelIcon(fallback) ?? fallback)
    : undefined;
  const out = { ...map };
  if (resolvedNext == null || resolvedNext === resolvedFb) delete out[id];
  else out[id] = resolvedNext;
  return out;
}
