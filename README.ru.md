# Settings Panel

[English](README.md)

Панель настроек сцены для Next.js. **⌘M** — тайминги, easing, цвета и раскладка прямо на странице, без правок в коде.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Что умеет

- Стеклянный док в любом из четырёх углов, как индикатор Next.js Dev Tools
- Ряды из схемы: числа, тоглы, цвета, enum, пары, диапазоны, плеер, easing-кривые
- Русский и English
- Тёмная и светлая тема
- Пресеты, указка, сброс ряда и копирование новых дефолтов
- Иконки Lucide из Tools **Panel / Icon** (16×16 в слоте 20×20)
- Свои настройки на каждую сцену в `localStorage`

## Установка

Пакет на GitHub, не в npm.

```bash
npm install github:Veevtamm/settings-panel
```

Пиры: `react` 19, `react-dom` 19, `clsx`, `tailwind-merge`. Geist — в layout сайта. Панель берёт `font-sans` и `font-mono`.

## Подключение

Next.js:

```ts
const nextConfig = {
  transpilePackages: ["@veevtamm/settings-panel"],
};

export default nextConfig;
```

CSS (Tailwind 4). `@source` смотрит на `src` пакета относительно этого файла:

```css
@import "@veevtamm/settings-panel/styles.css";
@source "../node_modules/@veevtamm/settings-panel/src";
@custom-variant fine-hover (@media (hover: hover) and (pointer: fine));
```

Полный пример компонента — в [английском README](README.md#quick-start). Схемы страниц (`settings.ts`) пишутся в каждом проекте.

Пока правишь панель рядом с сайтом: `"file:../settings-panel"` и `turbopack.root` = родитель обеих папок. Не править копию в `node_modules`.

## Лицензия

[MIT](LICENSE)
