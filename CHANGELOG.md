# Changelog

Install a fixed version with a git tag: `"@veevtamm/settings-panel": "github:Veevtamm/settings-panel#v0.2.0"`. Without `#tag` npm takes `main`.

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
