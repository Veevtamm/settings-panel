# Settings Panel

[English](README.md)

Панель настроек сцены для Next.js. Кнопка **слайдеров** в Dock Bar — тайминги, цвета и раскладка. **Spline** — редактор Безье, **waypoints** — plot оси: отдельные окна, можно открыть вместе с панелью сцены. **Шестерёнка** — язык, тема и сброс положения самой панели. `shortcut={true}` включает ⌘M на панель сцены. ⌘\ по умолчанию прячет весь док; `hideShortcut={false}` отдаёт ⌘\ сцене.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Что умеет

- Dock Bar — горизонтальный стеклянный бар с кнопками (шестерёнка — настройки самой панели, панель сцены, таймлайн, пружина, Безье, ось, поиск по имени параметра, свернуть все, Reset, Copy), по умолчанию сверху по центру; перетаскивается в любой угол или вниз по центру
- Ряды из схемы: числа, тоглы, цвета, enum, пары, диапазоны, плеер, easing-кривые
- Окно пружины (`springTargets`): жёсткость, затухание и масса с графиком отклика и временем до покоя; `springLinearEasing` превращает пружину в CSS-кривую `linear()`
- Клик по бейджу изменений оставляет только изменённые ряды; ⌘Z / ⇧⌘Z отменяют и возвращают правки
- Перенос настроек: ссылка (`?settings=`) или файл `.json` вместе с пресетами
- Нижний таймлайн анимации (`SettingsTimeline`): открыт вместе с окном панели; несколько анимаций на одном доке, Auto-длина, hug-транспорт, своя кнопка таймлайна в баре рядом с шестерёнкой, инспектор 328, zoom линейки, пунктирный призрак клипа по умолчанию (клик — вернуть), stagger-фазы как строки-дети с общим шагом, `hideBelow` / `enabled`, Moment HUD, фазы в ms или `vh`
- Общие кастом-виджеты: чипы, матрица пропусков, shuffle, join обводки, редактор оси (`AxisCurveEditor`)
- Русский и English
- Тёмная и светлая тема
- Пресеты, сброс ряда и копирование новых дефолтов
- Иконки Lucide из Tools **Panel / Icon** (16×16 в слоте 20×20)
- Свои настройки на каждую сцену в `localStorage`

## Установка

Пакет на GitHub, не в npm.

```bash
npm install github:Veevtamm/settings-panel
```

Зафиксировать версию — через тег: `github:Veevtamm/settings-panel#v0.2.0`. Что поменялось между версиями — в [`CHANGELOG.md`](CHANGELOG.md).

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

Полный пример компонента — в [английском README](README.md#quick-start). Схемы страниц (`settings.ts`) пишутся в каждом проекте. Чтобы значения переживали перезагрузку, `createParamStore(P, { storageKey })` из реестра `defineParams` отдаёт готовое чтение и запись для `useLocalSettingsStore` и проверяет каждое сохранённое значение.

## Для ИИ-агентов

Полный гайд (карта контролов, схема, подключение, ловушки) — [`AGENTS.md`](AGENTS.md). Он едет вместе с пакетом на GitHub.

После установки скопируй `.cursor/rules/settings-panel.mdc` из пакета в `.cursor/rules/` приложения и укажи в `AGENTS.md` приложения путь `node_modules/@veevtamm/settings-panel/AGENTS.md`.

Пока правишь панель рядом с сайтом: `"file:../settings-panel"` и `turbopack.root` = родитель обеих папок. Не править копию в `node_modules`.

`npm run playground` открывает `https://settings-panel.localhost` (через Portless): одна страница со всеми контролами, таймлайном, пружиной, Безье и осью. `npm run check` — типы и тесты.

## Лицензия

[MIT](LICENSE)
