export function isOverSettingsPanel(target: EventTarget | null | undefined): boolean {
  return target instanceof Element && Boolean(target.closest("[data-settings-panel]"));
}
