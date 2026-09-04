# AGENTS — settings-panel

Compact context for AI agents. For people — `README.md`.

## Stack

| Слой | Решение |
|------|---------|
| Kind | React 19 library (client components), TypeScript |
| Styling | Tailwind CSS 4 utility classes + `--sp-*` tokens in `src/styles.css` |
| Fonts | Consumer loads Geist; panel uses `font-sans` / `font-mono` |
| Package | `@veevtamm/settings-panel`, source exports (no `dist` build) |
| Manager | npm |

**Constraint:** new npm packages → update this Stack section. `"use client"` stays on UI modules.

## Infrastructure

- **Install:** `"@veevtamm/settings-panel": "github:Veevtamm/settings-panel"`
- **Install (local, while editing the panel):** `"file:../settings-panel"` — same folder on disk; do not edit `node_modules`
- **Next.js consumer:** `transpilePackages: ["@veevtamm/settings-panel"]`
- **CSS:** `@import "@veevtamm/settings-panel/styles.css"` and Tailwind `@source` on this package `src`
- **Env vars:** none
- **Portless / deploy:** none — this is a library

## Non-goals

- Scene `settings.ts` schemas — they stay in the consuming app
- Plot editors (`vertical-zone-editor`, `axis-curve-editor`) — optional, still in experimental until needed
- shadcn, Next runtime APIs inside the panel
- Public npm registry

## Specifics

- Canonical implementation lives **here**. experimental / folio / vn-manage consume the package; do not copy `components/settings-panel` into apps anymore.
- Figma: Tools file `ttYXL5aqa6feFcY8oNkpwm`, page Panel System. Rules: Connected Library `Agent Rules/settings-panel.md`.
- Storage keys stay per-scene in the app: `<project>-<scene>-settings`.
- `PANEL_THEME_EVENT` is still `"experimental:panel-theme"` so existing localStorage listeners keep working.
