# Settings Panel

[Русский](README.ru.md)

Scene settings panel for Next.js. The **sliders** button in the Dock Bar opens scene timings, easing, colors, and layout. The **gear** opens the panel’s own language and theme. Pass `shortcut={true}` if you want ⌘M for the scene panel. ⌘S hides and shows the whole dock by default (`preventDefault` — the browser will not save the page); `hideShortcut={false}` leaves ⌘S to the scene.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Features

- Dock Bar — a horizontal glass bar of buttons (gear for the panel’s own settings, scene panel, timeline, search by parameter name, fold all, pointer, Reset, Copy), top center by default; drag it to any corner or to bottom center
- Schema-driven rows: numbers, toggles, colors, enums, pairs, ranges, player, easing curves
- Bottom animation timeline (`SettingsTimeline`): several animations on one dock, Auto total, hug transport, its own timeline button in the bar next to the gear, inspector 328, ruler zoom, a dashed ghost of the default clip (click to reset), staggered phases as child lines with a shared step, `hideBelow` / `enabled`, Moment HUD, phases in ms or `vh`
- Shared custom widgets: chips, skip cells, shuffle replay, stroke join
- Russian and English UI
- Dark and light themes
- Presets, pointer mode, per-row reset, and copy-as-defaults
- Lucide icons from Tools **Panel / Icon** (16×16 in a 20×20 slot)
- Per-scene `localStorage`

## Installation

The package lives on GitHub, not npm.

```bash
npm install github:Veevtamm/settings-panel
```

Peer dependencies: `react` 19, `react-dom` 19, `clsx`, `tailwind-merge`. Load Geist in the app layout. The panel uses `font-sans` and `font-mono`.

## Setup

Next.js:

```ts
const nextConfig = {
  transpilePackages: ["@veevtamm/settings-panel"],
};

export default nextConfig;
```

CSS (Tailwind 4). Point `@source` at the package `src` from this file:

```css
@import "@veevtamm/settings-panel/styles.css";
@source "../node_modules/@veevtamm/settings-panel/src";
@custom-variant fine-hover (@media (hover: hover) and (pointer: fine));
```

## Quick Start

```tsx
"use client";

import { useState } from "react";
import {
  L,
  SettingsPanel,
  type SettingsGroup,
} from "@veevtamm/settings-panel";

type Settings = {
  durationMs: number;
  invert: boolean;
};

const DEFAULTS: Settings = { durationMs: 400, invert: false };

const groups: SettingsGroup<Settings>[] = [
  {
    id: "motion",
    title: L("Движение", "Motion"),
    icon: "timer",
    sections: [
      {
        title: L("Переход", "Transition"),
        settings: [
          {
            key: "durationMs",
            label: L("Длительность", "Duration"),
            min: 0,
            max: 2000,
            step: 10,
            unit: "ms",
          },
        ],
        toggles: [
          { key: "invert", label: L("Инверсия", "Invert") },
        ],
      },
    ],
  },
];

export function Scene() {
  const [settings, setSettings] = useState(DEFAULTS);

  return (
    <SettingsPanel
      panelId="demo-ui"
      storageLabel="demo"
      settings={settings}
      groups={groups}
      defaultSettings={DEFAULTS}
      onSettingsChange={(patch) =>
        setSettings((prev) => ({ ...prev, ...patch }))
      }
      onReset={() => setSettings(DEFAULTS)}
    />
  );
}
```

Open the scene and click the sliders button in the Dock Bar (the gear is language and theme). Keep page schemas (`settings.ts`) in the app. This package is the panel, not the scene.

Phases and a playhead: pass `players={[player]}` to `SettingsPanel`, then mount `SettingsTimeline` with `showDockButton={false}` and `targets={[…]}` plus `SettingsMomentHud`. Canonical wiring is in [`AGENTS.md`](AGENTS.md).

## For AI agents

The full agent guide (control map, schema, wiring, pitfalls) is [`AGENTS.md`](AGENTS.md). It ships with the GitHub package.

After install, copy `.cursor/rules/settings-panel.mdc` from this package into your app’s `.cursor/rules/`, and point your app `AGENTS.md` at `node_modules/@veevtamm/settings-panel/AGENTS.md`.

## Persist

Use `useLocalSettingsStore` when values should survive a reload. Storage key: `<project>-<scene>-settings`.

```tsx
import { useLocalSettingsStore } from "@veevtamm/settings-panel";
```

## Local development

While you edit this repo next to an app:

```json
"@veevtamm/settings-panel": "file:../settings-panel"
```

Set `turbopack.root` to the parent of the app and this package:

```js
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  transpilePackages: ["@veevtamm/settings-panel"],
  turbopack: { root: path.join(__dirname, "..") },
};
```

Do not edit the copy inside `node_modules`.

## License

[MIT](LICENSE)
