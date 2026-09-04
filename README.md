# Settings Panel

[Русский](README.ru.md)

Scene settings panel for Next.js. Press **⌘M** to tune timings, easing, colors, and layout live — without editing code.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Features

- Glass dock in any of the four corners, like the Next.js Dev Tools indicator
- Schema-driven rows: numbers, toggles, colors, enums, pairs, ranges, player, easing curves
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

Open the scene and press ⌘M. Keep page schemas (`settings.ts`) in the app. This package is the panel, not the scene.

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

Set `turbopack.root` to the parent of the app and this package. Do not edit the copy inside `node_modules`.

## License

[MIT](LICENSE)
