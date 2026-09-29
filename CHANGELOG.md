# Changelog

Install a fixed version with a git tag: `"@veevtamm/settings-panel": "github:Veevtamm/settings-panel#v0.2.0"`. Without `#tag` npm takes `main`.

## Unreleased

### Changed

- Spring stiffness, damping and mass rows use the same expandable scrub slider as scene number fields (28 `settings-2` toggle). Settle duration stays read-only.
- Dock Bar: Copy’s count badge no longer widens the Reset·Copy slot, so the gap before Fold matches the other 4px button gaps.
- Spring, Bezier and axis windows drag from the 8px top edge like the scene panel (`chromeFloat` in panel-settings). They magnet only to their own dock slot, not the Dock Bar. The dragged window stacks above the others. «Положение» docks them again. Dragging a window no longer selects field text.
- Named subsection titles line up with row labels at rest; the grip no longer leaves a 4px gap.
- Preset row has 3 numbered slots in their own 86 track. Transfer (`link`) is a separate Field 28 to the left of that track; collapse/expand-all is a 20px glyph to the right, like a section chevron.
- Light Dock Bar: the open button uses `dim` (`#a9a9a9`), not `line` — `line` matches frosted glass on a dark page and the On state disappeared.
- Dock search keeps the 34 `search` button; the 240 field opens to its right instead of replacing the glyph.
- Timeline stagger lines («строка 1») use the same `text/main` as phase names, not dim. The stagger chevron sits to the right of the name, before the curve 28 — not next to the hover grip.
- Axis editor: a **Точки** stepper (2–12) under the plot; Corner/Smooth still applies to the selected knot.
- Dark Bezier / axis plot fill uses `raised` (`#242424`), like Light, so the graph reads against the `surface` field. The axis canvas paints that fill on the full inner square, not only the letterboxed screen.

## 0.2.0

### Breaking

- The pointer is gone: `places`, `where` and `?place=` are removed from the schema and the panel.

### Added

- **Changed-only filter.** Click the changes badge on the dock to leave only changed rows in the scene panel; click again to show all.
- **Undo / redo.** ⌘Z / ⇧⌘Z over panel edits (session only, not persisted), with a toast on the dock. Scrub drags merge into one step; Reset, presets, links and files are one step each. `undoShortcut={false}` turns the keys off.
- **Settings transfer.** A `link` cell in the Presets row opens a menu:
  - «Ссылка с настройками» copies a URL with `?settings=` holding only the changed keys;
  - «Сохранить в файл» saves `<panelId>-settings.json` with all page keys and the preset slots;
  - «Открыть файл» loads such a file.
  Only this page's keys with a matching type are applied. The `?settings=` param is removed from the URL after it is applied.
- **Spring window.** Prop `springTargets` plus a `springs: Record<id, {stiffness, damping, mass}>` field. The dock gets an `activity` button after the timer. Helpers: `springValue`, `springSettleMs`, `springLinearEasing` (a CSS `linear()` curve).
- **Registry for multi-key params.** `param.range`, `param.pair` and `param.player` keep defaults of every key in one registry entry.
- **`createParamStore(P, { storageKey })`.** Load / save for `useLocalSettingsStore` straight from the registry: it validates types, clamps numbers, drops unknown keys and falls back to defaults on broken JSON. Also exported as `@veevtamm/settings-panel/param-store`.
- **Playground.** `npm run playground` opens `https://settings-panel.localhost` with every control, the timeline, Bezier, axis and spring.
- **Version in Panel Settings.** The gear view shows a read-only «Версия» row; `PANEL_VERSION` is exported.
- **Checks.** `npm run check` (types + vitest) and a GitHub Action on push / PR.

### Changed

- `shell.tsx` is split: dock, sections, chrome windows, change model, history, snapshots and transfer now live in their own modules.

## 0.1.0

- First package release: scene panel, Dock Bar, timeline dock, Bezier and axis windows, presets, `defineParams` registry.
