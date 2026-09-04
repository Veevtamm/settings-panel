# Settings panel

Панель настроек сцены (⌘M): тайминги, easing, цвета, сетка. Код один раз — в этом репозитории. Сайты подключают пакет, а не копируют файлы.

Схемы страниц (`settings.ts`) сюда не входят: они пишутся в каждом проекте.

## Стек

React 19, TypeScript, Tailwind 4. Сборка не нужна: Next компилирует исходники сам.

## Как подключить

В `package.json`:

`"@veevtamm/settings-panel": "github:Veevtamm/settings-panel"`

Пока репозиторий на GitHub ещё не опубликован, локально:

`"@veevtamm/settings-panel": "file:../settings-panel"`

В Next: `transpilePackages: ["@veevtamm/settings-panel"]`.

В CSS: импорт `styles.css` пакета и `@source` на его `src`, чтобы Tailwind увидел классы. Geist — в layout сайта, как раньше.

Панель на стартовую страницу не вешать, пока нет сцены.

## Структура

- `src/index.ts` — публичный вход
- `src/settings-panel/` — ядро панели
- `src/styles.css` — токены `--sp-*`
- `src/lib/` — hex, bezier, тема, persist

## Деплой

Это библиотека, не сайт. Публикация — GitHub-репозиторий `Veevtamm/settings-panel`.
