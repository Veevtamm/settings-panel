# Settings panel

Панель настроек сцены (⌘M): тайминги, easing, цвета, сетка. Код один раз — в этом репозитории. Сайты подключают пакет, а не копируют файлы.

Схемы страниц (`settings.ts`) сюда не входят: они пишутся в каждом проекте.

## Стек

React 19, TypeScript, Tailwind 4. Сборка не нужна: Next компилирует исходники сам.

## Как подключить

В `package.json` с публичного GitHub (не npm):

`"@veevtamm/settings-panel": "github:Veevtamm/settings-panel"`

Репозиторий: [github.com/Veevtamm/settings-panel](https://github.com/Veevtamm/settings-panel).

Пока правишь панель на этой машине, в потребителе лучше `file:../settings-panel` — это одна папка, не копия в `node_modules`.

В Next: `transpilePackages: ["@veevtamm/settings-panel"]`. Для `file:` ещё `turbopack.root` = родитель папки сайта и пакета.

В CSS: `@import "@veevtamm/settings-panel/styles.css"` и Tailwind `@source` на `src` пакета. Geist — в layout сайта.

Панель на стартовую страницу не вешать, пока нет сцены.

## Структура

- `src/index.ts` — публичный вход
- `src/settings-panel/` — ядро панели
- `src/styles.css` — токены `--sp-*`
- `src/lib/` — hex, bezier, тема, persist

## Деплой

Это библиотека, не сайт. Публикация — публичный GitHub-репозиторий `Veevtamm/settings-panel`, не npm.
