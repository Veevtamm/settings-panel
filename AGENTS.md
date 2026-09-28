# AGENTS — settings-panel

Единый гайд для агентов: стек пакета, карта контролов, схема, подключение, ловушки. Для людей — `README.md` (EN) и `README.ru.md` (RU).

## Чужой проект (и этот тоже)

Этот файл едет вместе с пакетом. Перед тем как добавить параметр, подключить панель или менять ядро — прочитай его целиком.

- Этот репозиторий / клон: `AGENTS.md` в корне
- После `npm i github:Veevtamm/settings-panel`: `node_modules/@veevtamm/settings-panel/AGENTS.md`
- GitHub: https://github.com/Veevtamm/settings-panel/blob/main/AGENTS.md

Чтобы агент в приложении подхватывал гайд сам, скопируй `.cursor/rules/settings-panel.mdc` из этого пакета в `.cursor/rules/` приложения. В `AGENTS.md` приложения добавь строку: панель — `@veevtamm/settings-panel`; полный гайд — `AGENTS.md` пакета.

## Stack

| Слой | Решение |
|------|---------|
| Kind | React 19 library (client components), TypeScript |
| Styling | Tailwind CSS 4 utility classes + `--sp-*` tokens in `src/styles.css` |
| Fonts | Consumer loads Geist; panel uses `font-sans` / `font-mono` |
| Package | `@veevtamm/settings-panel`, source exports (no `dist` build) |
| Manager | npm |
| Checks | `npm run check` = `tsc` + `vitest` (`test/*.test.ts`); GitHub Action `.github/workflows/check.yml` |
| Playground | `playground/` — Vite + `@vitejs/plugin-react` + `@tailwindcss/vite`, `npm run playground` (devDependencies only, не в `files`) |

**Constraint:** new npm packages → update this Stack section. `"use client"` stays on UI modules. Pure modules (`lib/param-store`, `lib/spring`, `lib/settings-transfer`, `settings-panel/params`, `settings-panel/types`) — без `"use client"`, их можно звать из серверного кода.

## Infrastructure

- **Install:** `"@veevtamm/settings-panel": "github:Veevtamm/settings-panel"` (public GitHub); фиксированная версия — `#v0.2.0` (теги = `version` в `package.json`, что изменилось — `CHANGELOG.md`). Новая версия: bump `version` + `PANEL_VERSION` в `src/version.ts` (тест сверяет) + запись в `CHANGELOG.md` в той же задаче; тег ставится только вместе с коммитом по запросу.
- **Install (local, while editing the panel):** `"file:../settings-panel"` — same folder on disk; do not edit `node_modules`
- **Next.js consumer:** `transpilePackages: ["@veevtamm/settings-panel"]`. Local `file:` install: `turbopack.root` = parent of the app and this package (`path.join(__dirname, "..")`).
- **CSS:** `@import "@veevtamm/settings-panel/styles.css"` and Tailwind `@source` on this package `src`
- **Env vars:** none
- **Portless / deploy:** none — this is a library
- **License:** MIT

## Non-goals

- Scene `settings.ts` schemas — they stay in the consuming app
- Plot editors: `AxisCurveEditor` lives in this package (`curveSection`). `vertical-zone-editor` — optional, still in experimental until needed
- Scene-only chrome (Grid Kind Switch on `/7-grids`)
- shadcn, Next runtime APIs inside the panel
- Public npm registry

## Specifics

- Canonical implementation lives **here**. experimental and folio install `github:Veevtamm/settings-panel`. vn-manage still has a local copy — do not edit the copy; new kernel work stays here.
- Figma: Tools file `ttYXL5aqa6feFcY8oNkpwm`, page Panel System. Agent rules for the panel live **in this file**, not in Connected Library.
- Storage keys stay per-scene in the app: `<project>-<scene>-settings`.
- Указка (`places` / `where` / `?place=`) удалена 28.09: в схемах `where` не писать, не возвращать без запроса.
- `PANEL_THEME_EVENT` is still `"experimental:panel-theme"` so existing localStorage listeners keep working.
- **Modules.** `settings-panel/shell.tsx` — сборка окна и дока; рядом: `dock.tsx` (Dock Bar, слоты, бейдж), `sections.tsx` (группы / сабсекции / ряды), `chrome-window.tsx` (окна Безье / оси / пружины), `change-model.ts` (чистая модель изменений: счётчик, Copy hand-off, Reset), `use-history.ts` (undo), `use-snapshots.ts` (пресеты), `use-transfer.ts` + `transfer-menu.tsx` (ссылка / файл), `spring-editor.tsx`. Чистые: `lib/settings-transfer.ts`, `lib/spring.ts`, `lib/param-store.ts`. Новую логику — в модуль по смыслу, не обратно в `shell.tsx`.
- **Tests / playground.** `test/*.test.ts` (vitest) на чистые модули; `test/playground.test.ts` гоняет `lintSettingsSchema` по схеме каталога. `playground/` (`params.ts` реестр · `schema.tsx` группы · `App.tsx` сцена) — все контролы и окна на одной странице; новый тип ряда / окно → добавить в каталог в той же задаче.

## Guide

Панель настроек сцены: тайминги, easing, цвета, сетка, шрифт, раскладка. Раньше — «motion panel» / «⌘M». Канон — этот репозиторий (`@veevtamm/settings-panel` с GitHub, не npm). experimental и folio ставят пакет; локально пока правишь ядро — `file:../settings-panel`. Правки ядра не делать в копиях приложений.

**Dock Bar** — горизонтальный glass-бар, по умолчанию сверху по центру (`defaultDockCorner`, 6 мест). Порядок кнопок: шестерёнка `settings` = **Panel Settings** (язык / тема / положение) | `sliders-horizontal` = **панель сцены** | таймер 34 (если есть `players`) | `activity` = **Пружина** (если есть `springTargets`) | `spline` = **Кривая Безье** (если есть `easingTargets`) | `waypoints` = **Ось** (если есть `curveSection`) | `dockExtra` | Reset · Copy · Fold | лупа. Шестерёнка не открывает тайминги сцены. Пружина, Безье и ось — отдельные окна, как таймлайн: могут быть открыты сразу со сценой. Шестерёнка и слайдеры делят одно окно (виды settings | scene). `shortcut={true}` включает ⌘M на панель сцены. Схема-driven, без React Context: страница владеет `settings`, панель шлёт `Partial<TSettings>` через `onSettingsChange`.

Figma: файл [Tools](https://www.figma.com/design/ttYXL5aqa6feFcY8oNkpwm/Tools?node-id=0-1), страница `Panel System` (канон; `08  Session` — фильтр изменённых, undo, перенос, пружина) + `Proposals` (только то, чего нет в коде; сейчас **E4 триггеры** · **G6** сброс секции, новый вид: число изменений в шапке → `eraser` на hover · **G9** драг за лейбл числового ряда · **G10** вариация `dices` в шапке секции) + `_old`. G2 (сравнить с дефолтом) и G4 (действие и Страница) отклонены — не возвращать без запроса. Не плодить страницы. При расхождении канон = пакет.

## Поведение агента (всегда)

- **Новый эффект / фича с magic numbers** → предложить, какие параметры вынести в панель, и **спросить пользователя** (AskQuestion): какие выносить, дефолты, нужен ли scrub. Не выносить всё подряд молча и не хардкодить тюнимые значения молча.
- **Новый параметр** → подобрать контрол по карте ниже; не изобретать новый тип ряда, если есть подходящий. Виджет только этой сцены — `custom`, не новый `Setting*`. Запись в реестр `defineParams` (label ru/en, info, default, `layer`), не три места; вторая секция — `refs`, не второй ряд; формула — `derived`, не число.
- **Контрол неоднозначен** → спросить пользователя (AskQuestion): если параметр можно отобразить больше чем одним видом (segment vs dropdown, число vs stepper, scrub или нет) или это особый вид (свой виджет, plot, timeline) — предложить варианты с коротким trade-off, не выбирать молча.
- Дефолт нового параметра = текущее поведение сцены (добавление параметра ничего не меняет визуально).
- После изменения схемы панели — обновить описание страницы в `<repo>/AGENTS.md` (дефолты, storage key, что в scrub). Смотреть `console.warn` `settings-panel[<panelId>]` (линт схемы). Агент может вызвать `lintSettingsSchema({ groups, defaultSettings, defaultOpenSections, easingTargets, params: P })` — ненулевой массив = не оставлять.
- Добавил в саму панель новый тип ряда, контрол или фичу (`src/`) — обнови **этот `AGENTS.md`** в той же задаче: карту контролов, порядок рядов, ловушки. Правки ядра не делать в experimental / folio / vn-manage.
- Тайминги/дефолты сцены не «улучшать» без запроса — см. `motion.md` (Connected Library / раздатка курса), если файл есть в проекте.
- **Драг** — только пока зажата кнопка (`pointerHeld` / `bindPointerDrag`). Ховер без press ничего не двигает.

## Карта контролов

Тип ряда = поле секции (`settings` / `toggles` / `colors` / …), не `kind`.

| Значение | Контрол | Тип | Пример |
|---|---|---|---|
| число + unit (ms, px, %) | поле 86, unit внутри 50% | `NumberSetting` в `settings` | `{ key: "driftSpeed", label: "Скорость", min: 20, max: 250, step: 5, unit: "%" }` (+ опц. `trailing` — 28×28 справа от поля; `readOnly` + `readOnlyLabel: "Auto"` — Figma Width при Stretch; `easingId: "phase1"` — spline 28 слева от поля, как инспектор таймлайна, `focusPanel` на этот `easingTargets[].id`) |
| число, крутят часто | + `scrub: true` — слайдер под рядом; кнопка 28 Lucide `settings-2` | там же | `scrub: true`; именованные стопы — `tickStops: [{ value: 0, label: "Tight" }]` (≤14); `tickSnap: false` — тики-якоря, значение может быть между ними (Figma Weight); при `defaultSettings` трек рисует насечку 12px на дефолте и магнитится к ней в радиусе 5px (насечка скрыта, когда значение = дефолт) |
| целое в узком диапазоне | 86 1×3 − / value / + | там же | `{ key: "columns", label: "Модулей в строке", min: 3, max: 12, stepper: true }` |
| вкл/выкл | switch 52×28 | `ToggleSetting` в `toggles` | `{ key: "rubberInvert", label: "Инверсия" }` |
| действие (вход/выход из режима) | Action 86, подпись меняется | тот же toggle + `control: "action"` | `{ control: "action", offLabel: "Изменить", onLabel: "Сохранить" }` |
| два режима с названиями | segment 86 (оба лейбла видны) или dropdown | тот же toggle + labels + `control` | `{ key: "imageCover", label: "Режим", onLabel: "Fill", offLabel: "Fit", control: "segment" }`; длинные лейблы — `controlWidth` (**176** как Dropdown); Тема = segment **86** `sun` | `moon` (`offIcon` / `onIcon`); ориентация кадра **86** `rectangle-vertical` | `rectangle-horizontal`; фаза появления — `Panel / Segment Phase` **332** `Вход` | `Выход` (FILL ряда, не 86); действие — `control: "action"`, не этот ряд |
| 3+ вариантов | dropdown **176** (не fill leftover; Panel / Dropdown Row); не Action 86. 2–3 режима с глифами — `control: "segment"` + `mark` (`from-start` · `from-center` · `from-end`; Figma `Panel / Pick` Kind=Mark + `Panel / Glyph Mark`) | `EnumSetting` в `enums` | `{ key: "aspectRatio", label: "Пропорции", icon: "proportions", controlWidth: 86, options: frameRatioOptions(orient) }`; `controlWidth` опционален (дефолт 176; /7-grids Пропорции **86** — как Field, короткие `3:4`); folio Decrypt Порядок: `{ control: "segment", options: [{ value: "start", label: "с начала", mark: "from-start" }, …] }` |
| фазы перехода (N фаз) + плеер | **Канон UI = нижний док `SettingsTimeline`** (Tools `07 Timeline` `445:4308`): открывается своей кнопкой 34 `timer` (`TimelineToggleButton`, открыт = заливка) — при `players` панель рисует её в Dock Bar после `sliders-horizontal` (панель сцены), не сразу за шестерёнкой (видна и при закрытой панели), без панели — сам док (`showDockButton`). Таймер и окно панели могут быть открыты сразу; сегмента Панель | Таймлайн больше нет (27.09). Док: колонка инспектора **328** (ширина ряда панели: имя фазы + кривая 28 + поле 86) + транспорт; ряд «Время анимации» + трек; Элементы свёрнуты по умолчанию (B1). **C2 призрак:** сдвинутый/растянутый клип оставляет на дорожке пунктир (1px dashed `--sp-line-hover`, 22px) на месте дефолта; клик по призраку = вернуть фазу (старт, длительность, шаг) — то же, что точка-reset ряда; нужен `defaultSettings` цели. Figma: `Panel / Phase Lane` `Clip=Moved`; пример C2 + E1 — `07 Timeline` → `ex / Ghost + Stagger`. **E1 stagger:** фаза из N одинаковых строк — `PlayerPhase.stagger: { count, stepKey, stepMax?, caption? }`; `key` = длительность **одной** строки, `stepKey` = сдвиг между строками, клип родителя = `key + (count − 1) × step` (так же считают раскладка, `resolvePlayerTotal`, HUD). В доке у родителя шеврон (раскрыт по умолчанию), поле родителя read-only = весь span; под ним ряды «строка 1…N» (поле = общая длительность строки, правится с любого ряда) и ряд **Шаг**; на дорожках строки — свои лейны, драг строки k ≥ 1 меняет шаг, строки 1 — двигает родителя, дабл-клик — соло родителя. `stepKey` входит в Reset / Copy / `player-key-row` (`phaseKeys`). Число строк фиксировано схемой; зависит от вёрстки — сцена пересобирает `PlayerSetting`. Сценам строить сегменты через `playerSegments(player, settings, locale)`, не руками. Dropdown **Анимация** — в колонке 328 шапки, только если `targets` > 1, иначе колонка пустая. Кривая 28 → `onEditCurve` / `focusPanel` открывает **вид Безье** (кнопка `spline` в доке; таймлайн закрывается). `controller.setOpen` = Moment HUD на сцене. Тот же `PlayerSetting` / `PlayerController`; патч — `patchPlayerClips` / `timelinePropsFromPlayer`. Встроенного плеера в панели нет (компакт `SettingPlayer` удалён 27.09): фазы живут только в доке. Жесты дорожек и транспорт — `PhaseLanes` / `TransportRow`. Драг клипа / бара / плеера живёт только пока кнопка зажата (`bindPointerDrag`); отпустил — не следует за курсором. | `PlayerSetting` в `targets` дока + `players` панели (не в схеме) | `{ label: "Reel", totalKey: "reelTotalMs", phases: [{ key: "reelPhase1Ms", caption: "фаза 1", kind: "phase", max: 2000 }, { key: "reelPhase2Ms", startKey: "reelPhase2StartMs", caption: "фаза 2", kind: "phase", max: 2000 }], unit: "ms", min: 10, step: 10, controller }` |
| цвет | hex row 28+1+102, HSV flyout + eyedropper | `ColorSetting` в `colors` | `{ key: "backgroundColor", label: "Фон" }`; `after` — под числом (folio Grid: Цвет под Количество); `textAligns` с `after` на ключ цвета — сразу под hex (/7-grids: Выравнивание живёт в Шрифте, под hex в Цвете — `refs`); `opacityKey` — chrome 28+1+102+1+56, % hover ▴/▾ overlay 21px поверх «%» (тот же chrome, что у number field: `--sp-fill-strong` только `border-l` + hairline ▴/▾; overlay inset 1px, чтобы не перекрыть `--sp-line-mid` ряда); квадрат сватача — solid hex, без alpha |
| min–max диапазон | dual range | `RangeSetting` в `ranges` | `{ fromKey: "fontWghtMin", toKey: "fontWghtMax", label: "Толщина", min: 200, max: 900, step: 10 }` |
| квадрат/вертикаль/горизонталь | 1×3 Orient (28×3 + 2 rules, Lucide 20×20 `square` / `rectangle-vertical` / `rectangle-horizontal`) | `FrameOrientSetting` в `orients` | `{ key: "aspectOrient", label: "Ориентация" }` |
| left/center/right | 1×3 Fit (`align-start-vertical` / `align-center-vertical` / `align-end-vertical`) | `XAnchorSetting` в `xAnchors` | `{ key: "kolonnayaImageAlign", label: "Фит" }` |
| left/center/right/justify | 1×4 Fit chrome 115 (28×4 + 3 rules; Lucide `align-left` / `align-center` / `align-right` / `align-justify`) | `TextAlignSetting` в `textAligns` | `{ key: "captionTitleAlign", label: "Выравнивание", after: "captionTitleColor" }` |
| 9 позиций | 3×3 Anchor | `AnchorSetting` в `anchors` | `{ key: "imageFitAnchor", label: "Якорь" }` |
| произвольная строка | textarea на всю ширину ряда, несколько строк | `TextSetting` в `texts` | `{ key: "notes", label: "Заметка" }` |
| иконка перед лейблом | Lucide 20×20 слева от названия | любой ряд: `icon`; подсекция: `SettingsSection.icon` | `{ icon: "proportions", label: "Пропорции", … }` / `{ title: "Педаль", icon: "timer", … }` — как boolean Icon + Glyph в Figma; без `icon` глифа нет |
| два связных числа (gap X/Y, pad X/Y) | один ряд, два поля, **20×20** глиф слева снаружи поля (не внутри) | `PairSetting` в `pairs` | `{ label: "Отступы", fields: [{ key: "padX", ariaLabel: "Отступ по X", icon: "padX", min: 0, max: 200 }, { key: "padY", … icon: "padY" … }] }` |
| easing-кривая | Bezier-вид окна (кнопка 34 `spline` после таймера): select → curve editor → Copy 28 слева (`file` → `check`, копирует `0.22, 1, 0.36, 1`) + 4 поля coords без лейбла ряда (`x1`/`y1`/`x2`/`y2` как unit 50% внутри поля) → preset на всю ширину (14×14 из Panel / Icon; Custom bezier = `function-square`; Replay 28 у пресета **пока скрыт**). Не секция сцены — не в списке слоёв. | **не row**: проп `easingTargets` + поле `easings: Record<string, CubicBezier>` в `TSettings`; сценные кривые — `easingPresetExtras` (append к списку, не в `EASING_PRESETS`) | `easingTargets={[{ id: "phase1", label: "Phase 1" }]}` `easingPresetExtras={[{ id: "diveIn", label: "Dive In", easing: "cubic-bezier(0.6, 0, 0, 1)" }]}` |
| пружина (hover, drag, физика) | окно **Пружина** (кнопка 34 `activity` сразу после таймера, до `spline`): dropdown цели (если целей 2+) → график отклика 328×180 (пунктир = цель) → ряды **Жёсткость** 1–1000 · **Затухание** 0–100 / 0.5 · **Масса** 0.1–10 / 0.1 → read-only **Длительность** `≈ N ms` (до покоя 0.001). Не секция сцены. | **не row**: проп `springTargets` + поле `springs: Record<string, SpringConfig>` в `TSettings`; сцена применяет через `springLinearEasing(cfg)` (CSS `linear()`) + `springSettleMs(cfg)` или `springValue(cfg, t)` в rAF | `springTargets={[{ id: "hover", label: L("Наведение","Hover") }]}`; `springs: param.value({ default: { hover: { stiffness: 170, damping: 26, mass: 1 } } })`. Кривая на время (ms + easing) — Безье, не пружина. |
| кастомный plot (оси) | Axis-вид окна (кнопка 34 `waypoints` после Безье): `AxisCurveEditor` = square viewport plot + выбранный узел → сегмент **176** `Угловая` \| `Гладкая` (ручки Безье = ромбы, узлы = круги / квадрат; Figma `Panel / Axis Editor` State=Idle|Smooth|Corner); шапка Lucide `waypoints` via `curveSectionIcon`. `/5` **Зона замедления** = Range Row в Grid (`zoneLeft`/`zoneRight`), не `curveSection`. | проп `curveSection` (ReactNode) | `curveSection={<AxisCurveEditor … />}` `curveSectionTitle={L("Ось","Axis")}` `curveSectionIcon="waypoints"` |
| виджет из пакета (пропуски, чипы, shuffle, join обводки) | готовый React в subsection | `CustomSetting` в `custom` | `/7-grids`: `SettingCells` / `SettingChips` / `SettingSkipReplay`; `/7` обводка: `SettingStrokeJoin`. Схема сцены остаётся `custom`, не новый `kind` ряда. `{ id: "skipCells", after: "rowSkip", render: …, keys: [{ key: "skipCells", label: "Пропуски" }] }`. Матрица: `parseSkipCells` / `serializeSkipCells` из пакета (`@veevtamm/settings-panel/skip-cells` без `"use client"`). Корень виджета с `RowLabel` — `data-setting-row` (тултип ⓘ = ширина этого ряда, не иконки). **Grid Kind Switch** — не ряд и не пакет: остаётся сценой `/7-grids` |
| тот же параметр во второй секции | тот же контрол, без копии | `RefSetting` в `refs` | `{ ref: "columns", after: "padY" }`. Не копия: Reset/Copy считают исходный ряд один раз |
| величина-формула (read-only) | chrome readOnly-поля «Auto» | `DerivedSetting` в `derived` | `{ id: "stagger", label: L("Ступень","Stagger"), unit: "ms", compute: (s) => s.itemsStartMs - s.navStartMs, after: "navStartMs" }`. Не хранится, не в Reset/Copy/снапшотах |

Порядок внутри subsection — только **дефолт рендера**, не догма: colors → orients → toggles → texts → **custom без `after`** → settings(number) → derived → pairs → ranges → enums → anchors → xAnchors → textAligns → refs. `derived` без `after` встаёт после `settings`; `refs` без `after` — после `textAligns`. Расположение подстраивается под сцену: любой ряд встаёт «под конкретным toggle/orient/number/цветом» через `after: "ключ"`; `after` не ограничен `followerKinds` — цепочка folio Grid (Количество → Цвет → Тип → Ширина Auto → Отступ → Gutter) должна рендериться целиком. Группировка по секциям/сабсекциям — свободная, решает автор схемы; пользователь дополнительно двигает сабсекции драгом. Toggle с `after` на number (или pair) встаёт под этим полем; range с `after` на этот toggle — сразу под ним. `textAligns` с `after` на ключ цвета — сразу под hex. `custom` с `after` встаёт сразу под этим ключом.

У каждого ряда есть `info?: Copy` — короткая человеческая подсказка (`info` 20×20 у лейбла; тултип Figma `5242:391` на всю ширину ряда, по центру строки, токен `--sp-tooltip`), объясняет эффект параметра, а не повторяет название: `info: L("Жёсткость пружины между соседними буквами: больше — сильнее растяжение цепочки", "How stiff the spring between neighboring letters is: higher — stronger chain stretch")`. Новым параметрам писать `info` по умолчанию, сразу на ru и en. Опционально `icon?: SfSymbolName` — Lucide 20×20 слева от лейбла (Figma Panel / Icon, kebab-имя; старые SF-ключи в схемах ещё читаются).

Числовые поля понимают математику: `700/2`, `(3+1)*20`, запятая как десятичный разделитель; ведущий `+` — относительная прибавка к текущему значению (`+50`).

## Структура схемы

```ts
const groups: SettingsGroup<TSettings>[] = [
  { id: "timings", title: "Timings", icon: "timer", sections: [
    { title: "Педаль", settings: [...] },
  ]},
  { id: "elements", title: "Elements", icon: "layout-grid", sections: [
    { title: "Кадр", settings: [...], toggles: [...], custom: [
      { id: "skipCells", after: "rowSkip",
        render: ({ settings, onSettingsChange, rowReset }) => (
          <SettingCells value={settings.skipCells} onChange={(skipCells) => onSettingsChange({ skipCells })} {...rowReset("skipCells")} />
        ),
        keys: [{ key: "skipCells", label: "Пропуски" }] },
    ]},
    { title: "Цвет", colors: [...] },   // /2 Соты submenu; /2 **Цвета** и /5 **Цвет** = свои группы
  ]},
];
```

### Реестр параметров

Один параметр — одна запись: key, `label`, контрол, диапазон, `default`, `info`, `layer`. Из неё: `DEFAULTS` = `defaultsOf(P)`, тип `SettingsOf<typeof P>`, ряды `P.driftSpeed` или `...rowsOf(P, […])`. Параметры из нескольких ключей — тоже одна запись: `param.range({ from: { key, default }, to: { key, default }, … })`, `param.pair({ fields: [{ key, default, … }, …] })`, `param.player({ total: { key, default }, phases: [{ key, default, start?: { key, default }, stagger?: { step: { key, default }, count } }] })` — ключи попадают в `SettingsOf` / `defaultsOf`; имя записи (`P.wght`) — не ключ settings. Плеер в сцене: `{ ...P.reel, controller }`.

Store из реестра: `const store = createParamStore(P, { storageKey, legacyKeys?, migrate? })` → `useLocalSettingsStore(store)`. Load проверяет тип каждого ключа (число — конечное и в `min`–`max`, цвет — `normalizeHex`, enum / якорь / ориентация — из списка, range упорядочен), лишние ключи выкидывает, битый JSON = дефолты; save пишет только `storageKey`. Руками `getSnapshot` / `save` в новых сценах не писать.

```ts
const P = defineParams({
  driftSpeed: param.number({
    label: L("Скорость", "Speed"), default: 100,
    min: 20, max: 250, step: 5, unit: "%",
    layer: "motion",
  }),
  fontWghtMin: param.value({ default: 200, layer: "type" }),
  rubberInvert: param.toggle({
    label: L("Инверсия", "Invert"), default: false, layer: "motion",
  }),
});
type TSettings = SettingsOf<typeof P>;
const DEFAULTS = defaultsOf(P);
// sections: [{ title: L("Лента", "Tape"), settings: [P.driftSpeed] }]
```

**Новые сцены — только через реестр; старые inline-схемы работают, миграция по мере правок.** `SettingsPanel` линтит схему в консоль; полный проход с `params: P` — `lintSettingsSchema`.

- **Слои групп (канон).** Заголовки групп — только из словаря слоёв: **Тайминги** (`timings`, `timer`) · **Раскладка** (`layout`, `layout-grid`) · **Шрифт** (`type`, `type`) · **Цвет** (`color`, `palette`) · **Движение** (`motion`, `activity`) · **Сетка** (`grid`, `columns-3`). `SettingsLayer` в коде = те же id. Группа = слой (что за закон), подсекция = свободно (чаще элемент сцены: Заголовок / Модуль / Лента). «Elements» больше не заводить — его содержимое расходится по слоям (фон → Цвет, размеры → Раскладка, анимации → Движение). Сценные группы вне словаря: /2 **Соты** (`honeycomb`) — с пометкой в AGENTS сцены. experimental и dilusa мигрированы целиком; folio / vn-manage — по мере правок.
- **Словарь величин (канон).** Одно слово — одно понятие на всех сценах; лейблы рядов — русские (`L("рус","English")`), английские слова в RU-панели не оставлять (Type → Шрифт (слой; «Тип» по-русски = вид, не набор), Gutter → Жёлоб, Stretch → Растянуть, Hover → Наведение, Load → Загрузка, Difference → Разница). Единица всегда в поле (`unit`), шаг = различимое глазом. Имена продуктов (Guide, About, Decrypt) — как есть.

| Величина | ru | en | unit | step |
|---|---|---|---|---|
| длительность фазы / перехода | Длительность | Duration | ms | 10 |
| появление (reveal) | Появление | Appear | ms **или** vh — один ключ = одна единица | 10 / 1 |
| Lenis lerp | Сглаживание | Smoothing | — | 0.005 |
| Lenis duration | Длительность Lenis | Lenis duration | s | 0.1 |
| размер шрифта | **Кегль** (не Размер) | Size | px | 1 |
| трекинг | Трекинг | Tracking | em | 0.01 |
| кернинг | Кернинг | Kerning | % | 0.5 |
| межстрочное | **Интерлиньяж** (не Между строками) | Leading | % | 1 |
| wght шрифта | Толщина | Weight | wght | 10 |
| толщина обводки | Толщина обводки | Stroke width | px | 0.5 |
| тип стыка обводки | Тип стыка | Join | — | — |
| тип колонок сетки | Тип сетки | Grid type | — | — |
| сторона модуля / картинки | Сторона / Модуль | Side / Module | px | 1 |
| скругление | Скругление | Corner radius | px | 1 |
| внутренние отступы (pad) | Отступы (pair) | Padding | px | 1 |
| поля сетки (margin) | Поля сетки | Margins | px | 1 |
| зазор между рядами / колонками | Между строками / Между колонками | Row gap / Column gap | px | 1 |
| колонки | Колонки / Модулей в строке | Columns / Modules per row | — | stepper |
| цвет | Фон / Текст / Обводка / Цвет | Background / Text / Stroke / Color | hex | — |
| прозрачность затемнения | Прозрачность оверлея | Overlay opacity | % | 1 |
| paint сетки | Линии / Заливки (не Overlay) | Lines / Fills | hex + % | — |
| скорость движения сцены | Скорость | Speed | % | 5 |
| скорость ленты | Скорость ленты | Marquee speed | px/s | 1 |
| докат / резинка / инерция | Докат / Резинка / Инерция | Coast / Rubber / Inertia | % | 5 |
| дистанция скролла (эффект за N px) | Дистанция | Distance | px | 10 |

Разводить смыслы, а не делить одно слово: **Cover** → «Обложка» (страница) / имя фазы «Фон (клип)» (ms); **Фон** — только цвет; **Толщина** — только шрифт; **Тип** — всегда с уточнением; **Скорость** — только % сцены. Полный аудит лейблов по сценам — в истории задачи, канон — эта таблица; нет величины в таблице → добавить сюда в той же задаче.
- Группы: словарь слоёв — **Тайминги** (`timings`, `timer`) · **Раскладка** (`layout`, `layout-grid`) · **Шрифт** (`type`, `type`) · **Цвет** (`color`, `palette`) · **Движение** (`motion`, `activity`) · **Сетка** (`grid`, `columns-3`); заголовки групп — `L(ru, en)` из словаря. Исключение сцены: /2 **Соты** (`honeycomb`). Служебные id: `panel` (вид окна), `bezier-view` / `axis-view` (виды Безье и оси, не слои сцены). Подсекции свободные (ряды сцены — в AGENTS приложения). Глаз на группе: /2 Соты `honeycombShowGrid` + dock `LayoutGridToggle`; /5 /6 /7-grids Сетка `showLayoutGrid`. `headerAction` = любой контрол в шапке секции или группы (experimental /6 Replay на группе Тайминги). Оверлей сетки: два цвета с `opacityKey` (chrome 28+1+102+1+56); `visibilityKey` = глаз 16 у шеврона секции **или группы**; folio Grid — на группе, ряды `untitled`. Быстрый показ — кнопка 34 в Dock Bar (`dockExtra` / `LayoutGridToggle` с `aria-pressed`; вкл = заливка `--sp-fill` + `--sp-fg`, выкл = muted); лейблы контролов RU («Фон», «Якорь»).
- `defaultOpenSections` — id слоёв, которые есть на сцене (`timings` · `layout` · `type` · `color` · `motion` · `grid`) плюс служебные, если секция есть: `"honeycomb"` (/2 Соты), `"panel"` / `"bezier"` / `"curves"` (старые id; Безье и ось — отдельные окна по кнопкам дока, в списке слоёв сцены их нет; id в `defaultOpenSections` на эти окна не влияет).
- Схема может зависеть от settings (`groups(settings.someToggle)`) — скрытые ряды не рендерятся, значения в storage остаются.

## Подключение на странице

```ts
const store = createParamStore(P, { storageKey: STORAGE_KEY });
const [settings, setSettings] = useLocalSettingsStore(store);
<SettingsPanel
  panelId={PANEL_ID} storageLabel="scene-name"
  settings={settings} groups={groups}
  players={[player]}
  onSettingsChange={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
  onReset={() => setSettings(DEFAULTS)}
  defaultSettings={DEFAULTS}
  easingTargets={...} dockExtra={...}
  defaultDockCorner="bottom-left"
  layoutPanelId="project-ui"
/>
<SettingsTimeline
  panelId={PANEL_ID}
  showDockButton={false}
  targets={[
    { player, settings, defaultSettings: DEFAULTS,
      onSettingsChange: (patch) => setSettings((prev) => ({ ...prev, ...patch })),
      easingIds: ["phase1", "phase2"] },
  ]}
/>
<SettingsMomentHud panelId={PANEL_ID} targets={sameTargets} />
```

Нижний таймлайн — единственный UI фаз: в `groups` плеера нет (поля `section.player` больше нет). Чтобы сдвиг/трим клипов шёл в счётчик Copy, Reset и точку-reset как остальные настройки: проп **`players={[player]}`** на `SettingsPanel` (ключи `totalKey` / фазы / `startKey`). Без `players` Copy не видит дрейф клипов. **Ключи плеера — не ряды** (A1·2): number-ряд (и `ref` на него) с ключом `totalKey` / фазы / `startKey` панель не рендерит, когда передан `players` — фаза живёт только на доке; линт `player-key-row` просит убрать такой ряд из схемы. **Dock Bar** — один горизонтальный glass-бар (border `--sp-line`, pad 4, высота 44, кнопки 34 без своего стекла, активная = `--sp-fill`; `dockBarButtonClass(active)`; Figma: `Panel / Dock Bar` State=Closed|Scene|Settings|Search|Timeline, кнопки `Panel / Dock / *` State × `Hover=Off|On` (+ `Badge` у Scene и Copy), `Panel / Dock / Search` Closed|Open|Filled, `Panel / Dock / Divider`; примеры `06 Examples` → `ex / Dock places` (6 мест) и `ex / Dock + window` (сцена / поиск / Panel Settings / нижний угол)), группы через разделитель 1×20 `--sp-section-line`: шестерёнка `settings` = **Panel Settings** (всегда видна, своя группа) | `sliders-horizontal` = панель сцены (бейдж изменений, `${panelId}-trigger`; клик по бейджу = фильтр «только изменённые»: открывает сцену, оставляет ряды с изменёнными ключами, бейдж залит; второй клик / Esc / ноль изменений — все ряды) · таймер 34 (когда передан `players`) · `activity` пружина (когда есть `springTargets`) · `spline` Безье (когда есть `easingTargets`) · `waypoints` ось (когда есть `curveSection`) · `dockExtra` | Reset · Copy (только при открытом окне и изменениях) · Fold (только при открытой панели сцены, сразу слева от лупы) · лупа 34 `search` всегда справа; черта после сцены (`dockExtra` / сетка) перед Reset · Copy · Fold · лупой (клик раскрывает поле 240, внутри «Поиск» opacity 0.4, пропадает при вводе; запрос открывает панель сцены и оставляет совпавшие ряды: лейбл / ключ / заголовок / опции, не ⓘ `info`; короткие слова в середине фразы («до» в «фото до пропуска») не считаются; пустые секции не оставлять — `after` без родителя отвязывается; Esc/× сворачивает). Panel Settings и панель сцены — **одно окно, виды** (`panelView` scene|settings). Безье и ось — отдельные окна (`bezierOpen` / `axisOpen`), рядом с сценой, как таймлайн: не закрывают друг друга; в виде settings — только секция «Настройки панели» (Язык · Тема · Положение · Версия) со статичным заголовком без глифа и без шеврона/пина; Безье / ось — свой статичный заголовок с глифом (`spline` / `function-square`); пресеты живут в виде scene сверху; в settings / bezier / axis их нет. `focusPanel` и ⌘M открывают вид scene. Бар hug-ширины и растёт по мере появления кнопок. Кнопки сцены в `dockExtra` сохраняют свой компонент: внутри бара (`[data-dock-extra]`) CSS снимает с них стекло/рамку, `aria-pressed="true"` = заливка. `showDockButton={false}` на `SettingsTimeline` рядом с панелью — таймер рисует панель; свой таймер в `dockExtra` не ставить. `enabled={false}` снимает шестерёнку и док (prod); `hideBelow={480}` — вместо CSS `[data-settings-panel]{display:none}`. Корень дока — `data-settings-panel` (жесты сцены игнорят). `showDockButton` default true — только если таймлайн живёт без `SettingsPanel`.

**Цель = плеер со своим store** (F1, `TimelineTarget`): `targets={[{ player, settings, defaultSettings, onSettingsChange, easingIds | onEditCurve }]}` — док сам берёт `timelinePropsFromPlayer`, пишет клипы через `patchPlayerClips` в `onSettingsChange` **этой** цели, рисует точки-reset по её `defaultSettings`, кривая 28 → `focusPanel(panelId, { easingId: easingIds[phase] })`. Несколько целей = ряд **Анимация** (подписи = `player.label`); при переключении док закрывает прошлый `controller`, зовёт `onActivate(id, prevId)` (сцена: роут оверлея, `park` прошлого интро) и открывает новый, если прошлый был открыт. Если сцена сама открыла другой плеер (HUD, `?moment=`), док переключается на него. Старый плоский API (`{...timelinePropsFromPlayer(...)}` + `onChange` + `onEditCurve`) остаётся для одного плеера; `targets: {id,label}[]` + `onTargetChange` **удалены**. `SettingsMomentHud` — Moment HUD из пакета (`Panel / Moment HUD`): тот же список `targets`, рисует открытый плеер, клик копирует момент + URL; свой HUD в сцене больше не писать.

**Скролл-таймлайн**: фазы в `vh` — тот же `PlayerSetting` с `unit: "vh"`, `min`/`step` 5, `totalLabel: L("Длина пина","Pin length")`. Контроллер — `ScrollPinPlayer` (`lib/scroll-player.ts`, часы общие с `TransitionPlayer` в `lib/playhead.ts`): `sync()` из скролла / Lenis.

`defaultSettings` передавать всегда: он включает точку-reset у каждого изменённого ряда (клик — вернуть дефолт этого параметра), счётчик изменённых параметров на доке и кнопку «Скопировать новые дефолты» (копирует изменённые ключи со значениями и лейблами — чтобы вшить их в `DEFAULT_*` кода).

- Анимация читает `settings.*` напрямую (в rAF — через `settingsRef.current`).
- localStorage: значения — `<project>-<scene>-settings` (ломающий формат → суффикс версии `-v2`, не silent overwrite); UI-кэш панели отдельно: `${panelId}:subsection-order`, `${panelId}:timeline-order` (`{ [playerId]: phaseKey[] }` — порядок рядов Элементов; Reset не чистит), `${panelId}:panel-settings` (`theme`, `locale` ru|en default **ru**, `sectionOrder`, `pinnedSections` omit = пусто, `sectionIcons`, `panelWidth` 348 / `panelHeight` hug, `dockSlot`, `lastEdited` `{ group, section? }` — при load открывает эту группу и именованную подсекцию **вдобавок** к `defaultOpenSections`; Reset сцены не чистит; тема и язык). `reorderSections` в файле ещё может лежать, в UI свитч убран., `${panelId}:snapshots` (пресеты этой страницы; в JSON есть `panelId`, чужой слот не применяется).
- **Язык** — Panel Settings, сегмент **86** `Ru` | `Eng` (как Тема; подписи сегмента не переводятся). Тема — те же 86, Lucide `sun` | `moon` вместо Light|Dark. Дефолт **ru**. Ряд **Положение** — Action 86 **Сбросить**: Dock Bar в `defaultDockCorner`, окно снова у бара (`panelFloat` omit). Ширину / тему / язык не трогает. Reset сцены язык и положение не сбрасывает. Ряд **Версия** — просто текст `PANEL_VERSION` справа (Geist Mono 14/18, `--sp-muted`, без chrome поля), ⓘ отсылает к `CHANGELOG.md`. Схема: `label` / `info` / `onLabel` / `offLabel` / `title` / enum / player caption / easing target — `L("рус", "English")` (`Copy` = `{ru,en}` или пока строка). Рендер резолвит через `tx(copy, locale)`. Порядок сабсекций хранится по русской строке (`copyKey`). Подсказки ⓘ тоже двуязычные. Сегменты (Fit|Fill, якоря, ориентация) переводятся. Chrome панели (Пресеты, Тема, плеер) — `PANEL_COPY`. Новому параметру сразу писать обе версии.
- Reorder subsections: драг за grip складывает **все** именованные сабсекции этой группы (не untitled), после отпускания возвращает их прежний open/closed. Пока драг идёт, ряды и контролы не ховерятся и не выделяются.
- Свитч **Изменение секций** из Panel Settings убран (27.09); ручки секций и пикер иконок не показываются. Драг сабсекций за grip остаётся. Пин вынимает секцию из скролла и ставит её **сверху**. Между закреплённым рельсом и скроллом — `--sp-section-line` (Dark/Light = `dim`: `#616161` / `#a9a9a9`; Figma `border/section`), линия остаётся на рельсе и не уезжает со скроллом. Дефолт пинов пуст (Panel Settings живёт в своём виде окна). Порядок и пины в `${panelId}:panel-settings`. Reset сцены порядок/пины не сбрасывает; **override иконок сбрасывает**.
- **Иконки** — override в `${panelId}:panel-settings` `sectionIcons` (id секции / `sub:<groupId>:<copyKey(title)>` / `row:<id>` → `SfSymbolName`); совпадение со схемой — ключ удаляется. Пикер глифа сейчас не в UI (свитч Изменение секций убран). Override считается изменением: точка-reset, счётчик Copy, Copy пишет `Иконка · …`. Reset сцены чистит `sectionIcons` (схема снова).
- **Размер окна** — свободный край панели (правый, у правых мест — левый; у центра ширина растёт в обе стороны; + край от бара по вертикали + угол): ширина **348–560** (Figma 348 = min), высота **200**–остаток вьюпорта как **потолок** (`max-height`; окно всегда hug контента, `height: fit-content`). Persist `panelWidth` / `panelHeight`. Драг высоты задаёт потолок, не пустое стекло. **Положение** — драг за верхний край окна (хит 8px, без отдельной полоски; не шапки закреплённых секций и не ряды/тело); не выходит за inset 12; ближе **28px** к Dock Bar или к своему месту прилипает обратно (`panelFloat` omit = пристыкована). Reset сцены не сбрасывает; ряд **Положение** в шестерёнке — сбрасывает слот дока и float.
- Переименование storage-ключа или panelId — только с миграцией: load читает старый ключ, если новый пуст (`*_STORAGE_KEY_LEGACY`); для UI-кэша — проп `legacyPanelIds`. Save пишет только новый ключ.
- Триггер панели сцены — Lucide `sliders-horizontal`, Panel Settings — `settings`; открытое окно = та же иконка с заливкой (не `x`). Пока панель открыта, в баре — **свернуть/развернуть все** (одна кнопка, два режима; в закрытом доке нет): `list-chevrons-down-up` = свернуть все секции и именованные подсекции / `list-chevrons-up-down` = развернуть все (видимые секции). Chrome как Grid Off (`Panel / Dock / Fold` State=Collapse|Expand). Перетаскивание за стекло бара (порог 4px, иначе клик по кнопке): бар едет за курсором, пока зажата кнопка; отпустил — жест кончился (не едет за ховером). Отпускание — ближайшее из **шести мест** к курсору: `top-left` · `top-center` · `top-right` · `bottom-left` · `bottom-center` · `bottom-right` (`defaultDockCorner`, omit = **top-center**). Панель открывается **под** баром (снизу — **над**), зазор 8: у центра — по центру бара, в углах — вровень с внешним краем бара, клип по inset 12. Таймлайн при нижнем баре встаёт над ним (bottom 12 + 44 + 8); Moment HUD при `top-center` опускается под бар (`momentHudTop(slot)`, `useDockSlot(panelId, layoutPanelId)` — для своих HUD сцены). `dockSlot` / `panelFloat` / `panelWidth` / `panelHeight` / тема / язык в `${panelId}:panel-settings`, либо в `${layoutPanelId}:panel-settings` если задан проп `layoutPanelId` (один док на весь сайт: слот не анимируется при смене страницы, только после драга бара; `SettingsPanel` `key` = `layoutPanelId` — смена `panelId` без размонтирования бара, если приложение держит один экземпляр; таймер / spline / waypoints / `dockExtra` входят и выходят через `DockBarSlot`); старый `dockCorner` колонки не читается (все стартуют с дефолта). Reset сцены место не сбрасывает (сброс слота и окна — ряд **Положение** в Panel Settings). Dock **Reset** — Lucide `eraser` (`Panel / Dock / Reset`). **Reset** сбрасывает значения сцены и override иконок (`sectionIcons`) — не тему, не порядок subsections, не снапшоты, не URL-параметры, не положение дока, не `lastEdited`. Dock **Copy** — Lucide `file` (`Kind=Copy`); после копирования на 1.4s — `check` (не `function-square`). При `defaultSettings` копирует hand-off для агента (`PANEL_COPY`): заголовок `Новые значения по умолчанию · <storageLabel> · изменено N из M`, дальше группы / именованные подсекции, строки `лейбл (key): old → new`, блок `Иконки`, финал «Впиши эти значения в DEFAULTS сцены…». Без `defaultSettings` Copy нет (старый плоский формат `copyDefaultsHeader` + `лейбл (key): value` не копируется). У Copy бейдж: ключи с контролом в схеме (easings — только изменённые цели, не весь Record; plot-секция Axis как одно) и каждый override иконки, без скрытых производных вроде `aspectW`/`aspectH`. Тот же бейдж на кнопке панели сцены, пока окно закрыто (открытое — только Copy). При переданном `defaultSettings` Reset и Copy видны только пока есть изменения.
- **Пресеты (снапшоты)** — один ряд 28 в панели сцены, закреплён сверху над слоями (Тайминги…); не в шестерёнке. слева Lucide `save` 20 (первый пустой слот, иначе активный) + лейбл «Пресеты» + ⓘ, справа трек **173** = ячейка 28 `link` **Перенос настроек** + rule + 5 слотов как Orient (`Panel / Snapshot Slot`: Empty / Saved / Active / Drift × Hover), цифры без приглушения; клик по пустому = сохранить текущие настройки, по сохранённому = применить (только ключи этой страницы), ⌥-клик — перезаписать, × на hover = очистить; у активного слота точка-дрейф, если текущие значения ушли от снапшота. Storage `${panelId}:snapshots` (`{slots, active, panelId}`); `legacyPanelIds` мигрирует слоты; Reset их не трогает. **Перенос** (ячейка `link`, меню-портал 220): «Ссылка с настройками» — URL `?settings=<base64url {p: panelId, v}>` только с изменёнными ключами (без `defaultSettings` — все ключи страницы); «Сохранить в файл» — `${panelId}-settings.json` (все ключи страницы + слоты пресетов); «Открыть файл». Применяется только к тому же `panelId`, только ключи страницы с тем же типом; слоты из файла — только при совпадении `panelId`. `?settings=` снимается из URL после применения (после гидрации, одним шагом undo «Из ссылки» / «Из файла»); тост на доке. Счётчик Copy — только ключи `defaultSettings` этой страницы; у plot-секции (Axis / зоны) и Bezier есть точка сброса, если их ключи не в рядах. Тема панели (`${panelId}:panel-settings`) общая с доком сцены: `/7-grids` `GridKindSwitch` читает её и красится `--sp-glass` / `--sp-line` / `--sp-fg`.
- **Таймлайн** — `SettingsTimeline` (Tools `07 Timeline`). Панель и док независимы: шестерёнка / сцена / Безье / ось не закрывают таймер, таймер не закрывает окно. Chrome дока: колонка 328 в шапке — ряд **Анимация** (`timelineTarget`) + `Panel / Dropdown` **176** (`SettingEnumDropdown` / `PanelSelectList`) только при нескольких плеерах, иначе пусто. Dropdown открывается порталом поверх, высоту дока и панель не двигает. `onEditCurve` открывает окно Безье (`focusPanel`, кнопка `spline`), сцену не закрывает. Линейка и клипы — одна шкала `LANE_PAD_PX` **3** (0 и total на внутренних краях дорожки); клип не отступает сам с двух сторон — стык без дырки. Player Track — свой pad **2**. Ширина дока — leftover вьюпорта минус inset **12** (при нижнем Dock Bar док поднят над баром), потолок **1600**, при потолке **по центру** leftover, не к краю. Док pad **12 / 8 / 8 / 8** (`pl-3 pr-2 py-2`); chrome→тело **8**; шкала↔Элементы **8**; шапка↔ряды **8**; ряды фаз **4**; строки stagger и ряд Шаг — отступ `pl-7`, ряд фазы + её строки = одна группа при перестановке (цель драга считается по серединам групп, не по 32px). Элементы: только подпись + шеврон, без глифа слева; ряд фазы — `grip-vertical` 20 как у сабсекций (fine pointer: на hover ряда; touch — всегда; драг переставляет ряды инспектора и дорожек вместе; клипы остаются на своих ключах; `${panelId}:timeline-order`) + имя (`--sp-muted` / `text/main`, как **Анимация** / **Элементы**, не `--sp-fg` и не `--sp-label`); grip и шеврон инспектора — тот же `text/main`.
- Жесты сцены (wheel/touch/Lenis) обязаны игнорировать панель: `isOverSettingsPanel(target)` / `closest("[data-settings-panel]")`; Lenis — `prevent`.
- `prefers-reduced-motion` панель уважает сама; поведение сцены — ответственность сцены.

## Перенос в новый проект

Ставить пакет с публичного GitHub, не копировать файлы из experimental и не брать с npm.

- package.json: `"@veevtamm/settings-panel": "github:Veevtamm/settings-panel"`. На этой машине, пока правишь панель — `"file:../settings-panel"`
- Next: `transpilePackages: ["@veevtamm/settings-panel"]`. Для `file:../settings-panel` в `next.config` ещё `turbopack.root: path.join(__dirname, "..")` — иначе Turbopack не видит исходники за симлинком (`Can't resolve` / пустые `export *`).
- CSS: `@import "@veevtamm/settings-panel/styles.css"` и Tailwind `@source` на `src` пакета; `@custom-variant fine-hover` в globals сайта, если его ещё нет
- peers: `geist` в layout сайта, `clsx` + `tailwind-merge` (обычно уже есть)
- Не копировать сцену: `settings.ts`. Чипы / пропуски / shuffle / join — из пакета (`SettingChips`, `SettingCells`, `SettingSkipReplay`, `SettingStrokeJoin`). Grid Kind Switch остаётся в приложении.
- В прод можно не отдавать: `next/dynamic` только в development (паттерн vn-manage)
- Агенту приложения: скопировать `.cursor/rules/settings-panel.mdc` из пакета в `.cursor/rules/` приложения; в `AGENTS.md` приложения указать этот файл как канон панели

Не копировать: файлы `settings.ts` страниц — это схемы-потребители, пишутся заново под сцену.

## Ловушки

- `scrub` — opt-in: только для значений, которые реально крутят (px, %, columns); не на ms-тайминги по умолчанию, не на seed/span/format.
- Драг (бар, окно, клипы, scrub, чипы, Безье, grip секций) — только пока зажата кнопка: `pointerHeld` / `bindPointerDrag`. Ховер без press не двигает.
- `custom` — не новый тип ряда ядра: Пропуски / Мест в строке / Shuffle / Join — виджеты пакета, в схему через `custom`. В Figma это `Panel / Cells` / `Panel / Chips` / `Panel / Replay` / `Panel / Pick` Kind=Join в слоте `Panel / Row`, не отдельные * Row. Plot — `curveSection`. `keys` + `rowReset` — чтобы Reset/Copy и точка-reset работали. Grid Kind Switch — сцена `/7-grids`, не npm-пакет; в Tools — `Panel / Kind Switch` + `Panel / Kind Item` (не папка 06 Custom).
- `SettingsTimeline` — не новый тип ряда. Без `players={[player]}` на `SettingsPanel` Copy / бейдж / Reset не считают `totalKey` и клипы (они не в `groups`), нет таймера 34 в колонке панели. Без 4-го аргумента `timelinePropsFromPlayer` нет точек-reset на доке. Таймер 34 не класть в `dockExtra`, если есть `players`. Клипы и линейка делят `LANE_PAD_PX`; не вычитать inset из ширины каждого куска — иначе между соседними фазами появляется ложный зазор. Инспектор дока **328** (при 176 имя фазы получало 46 px и «Время анимации» резалось). Элементы свёрнуты по умолчанию. Wheel на шкале/дорожках = zoom окна (`viewStart`/`viewEnd`; dblclick сброс; Shift+wheel = pan). Дорожки скроллятся при потолке (`viewport − inset`). `hideBelow` / `enabled` на панели, доке и HUD — не CSS display:none. Линейка: засечки каждые **100** ms, подписи 0 / каждые **500** / total; у `unit` ≠ ms (vh) — **10** / **50**. При `targets` с разными store ключи целей в `players={[…]}` панели класть только те, что лежат в `settings` **этой** панели (чужой store панель не считает). `TimelineTarget` меняет store при переключении — док ремоунтится по id плеера (порядок рядов Элементов читается заново). `totalAuto`: stored ≤ 0 не писать в WAAPI как 0 — `resolvePlayerTotal`. `timelinePropsFromPlayer().total` — stored ключ, не span.
- `refs` / `derived` не считаются в Reset/Copy (`refs` — исходный ряд один раз; `derived` не хранится). `defineParams` не экспортирует голые `number`/`text` — только `param.*`. Панель сама вызывает `lintSettingsSchema` (один `console.warn` на issue): `unknown-open-section` · `unknown-group-id` · `layer-title` · `bare-copy` · `unknown-after` · `missing-ref` · `duplicate-row` · `row-without-default` · `player-key-row` (ряд на ключе плеера из `players` — панель его скрывает) · `unknown-easing-id` (`NumberSetting.easingId` не из `easingTargets`). `row-without-control` — только если в вызов передали `params` (панель `P` не знает). `defaultOpenSections` без группы слоя не ругается (`layout` можно открывать, даже если группа скрыта тогглом); ругается на id вне словаря слоёв/`honeycomb`/служебных (`panel` · `bezier` · `curves`).
- Hex — uppercase `#RRGGBB` (`normalizeHex`), и в поле, и в persist.
- Ключи `easings` обязаны совпадать с `easingTargets[].id`, иначе патч уходит в пустоту (fallback `0.22,1,0.36,1`). Сценный пресет кривой — `easingPresetExtras`, не запись в `EASING_PRESETS` пакета.
- `storageLabel` — только a11y, не ключ storage.
- Текст: Geist Sans **15/20** — заголовки групп/subsections и лейблы рядов; поля, сегменты и dropdown **14/18** (числа / hex / bezier — Geist Mono, текстовые и сегменты — Geist Sans). Иконки пункта и Section Header — `--sp-fg` (`text/bright`), не `--sp-muted`. Ряд на hover не светлеет (лейбл / иконка / фон); hover только у контрола. В Figma hover на атомах: `Panel / Field` (`Kind` Number|Auto|Hex = содержимое; `Size` только реальные: 86 число · 56 opacity · 102 Hex · Fill coords; `State` Default|Hover — у Number 86 и 56 Hover = зоны ▴/▾ 21px поверх unit, не отдельный Kind Chevrons; Hex/Auto/Fill Hover = `border/strong`) / Action / Replay / Swatch `State=Default|Hover`; Color Hex, Dropdown, Scrub Toggle, Toggle — ось `Hover=Off|On` (Toggle Off hover = `border/strong`; On уже strong); Pick Cell `Off|Hover|On`; Stepper / `Panel / Pick` (Kind Fit|Orient|Join|Align) / `Panel / Segment` (Size 86|Fill × Face Text|Icon) — **Hover на всём треке** (`border/strong` поверх ячеек, в коде `::after` overlay, не inset box-shadow — заливка ячеек иначе перекрывает обводку). Не на `Panel / Row`. Hex = `Kind` Field Size=102; зоны ▴/▾ = `State=Hover` у Number, не Kind. `_old / Hex` и `_old / Field Stepper` живы для старых инстансов.
- Размеры зашиты в код, не в CSS-переменные: Field 86 / Hex 102 / Color opacity 56 / Coords и Text ≥180 / Chip 28×28 (gap 4, пунктирный + того же размера) / Toggle 52×28 / Action 86 (кнопка-действие, не цикл enum) / Fit 1×3 86 / Fit 1×4 Text Align 115 / Segment 86 (Fit/Fill и enum `control: "segment"`) / Theme segment 86 sun.max|moon; Language 86 Ru|Eng / Dropdown row **176** fixed (не leftover); `EnumSetting.controlWidth` переопределяет ширину; не трогает Preset / Fit|Fill / Dropdown 86 / Swatch 28 / dock-кнопки 34. Orient 1×3 — SF 20×20 `square` / `rectangle.portrait` / `rectangle` (не Glyph Orient 12×12). Enum 1×3 — глифы `from-start` / `from-center` / `from-end`, не square/portrait/landscape. Ряд: label↔control **16** (`gap-4`), высота 28; заголовок секции / сабсекции: иконка секции↔title **4** (`gap-1`), grip `line.3.horizontal`↔следующий элемент **8** (`gap-2`), actions справа 6; Replay+Preset **4**; Preset trigger **28**. Dropdown (`PanelSelectList`) — портал на `document.body`, ряд остаётся **28**; окно панели `overflow-hidden`, in-flow Open клиппит или раздувает hug. `overlay={false}` только если список должен толкать вёрстку. Ряд Replay+Preset — `h-[28px]`; список пресетов тоже поверх, не `SectionCollapse` в потоке. SF-глифы: кадр **Panel / Icon Vectors** (flatten instance 20×20, `viewBox 0 0 20 20`, CSS `size-5`); grip сабсекции = Panel / Icon `line.3.horizontal` 􀌇 20×20; Scrub Toggle 28 = Lucide `settings-2` (Tools `51:518`). Не flatten в 16 и не рисовать в 20 — глиф раздувается.
- **Undo** — ⌘Z / ⇧⌘Z (и Ctrl) по правкам панели за сессию (не persist, 100 шагов); `undoShortcut={false}` отдаёт клавиши сцене. В полях ввода не перехватывается (там свой undo). Правки тех же ключей ближе 800 ms — один шаг (scrub-драг); Reset, пресет, ссылка, файл — по шагу с подписью. Тост на доке: `Отменено · <лейбл> · N параметров` + подсказка ⇧⌘Z. Правки, пришедшие от сцены мимо `onSettingsChange` панели, в историю не попадают.
- Хоткей ⌘M **выключен**. `shortcut={true}` — opt-in: физический `KeyM` + meta, открывает **панель сцены** (`sliders-horizontal`), не шестерёнку. Игнор при фокусе в input/textarea/select/contenteditable. **⌘\** (`hideShortcut`, default `true`) прячет / показывает весь Dock Bar (`preventDefault`); `hideShortcut={false}` отдаёт ⌘\ сцене / браузеру. При скрытии панель и плееры дока закрываются; fade `opacity`+`visibility` 220 ease-out; не persist. Одиночный `SettingsTimeline` без панели на ⌘\ не реагирует. Клик по шестерёнке / панели сцены — enter 220 / exit 160 ease-out (`scale(0.98)` + 6px к бару). Смена вида сцена ↔ settings — не второй pop: высота `SECTION_MS` + fade содержимого 160; открытие Безье / оси / таймлайна — свой pop; ⌘M / `focusPanel` остаются мгновенными (`panelInstant`). Слоты бара (Reset · Copy · Fold) и поиск 34↔240 — ширина 160/200, бар при этом едет `top`/`left`. Таймлайн — тот же pop, что у окна (`useDeferredMount`). Окно панели — `position:fixed` к вьюпорту + portal на `document.body` (не `absolute` снаружи 34px-дока: iOS клиппит overflow у `fixed`). Hug — `height:auto` + grid `auto / minmax(0,auto)`, не `flex-1` (basis 0% → высота 0). Обёртки списка (`PanelViewSwitch`) — `flex flex-col min-h-0`, иначе `overflow-y-auto` не сжимается и тело клиппится без скролла. Виды settings / bezier / axis — в mid (скролл), не в pinned top (`shrink-0`). Стекло — `backdrop-blur` + `--sp-glass` на самом окне; не выносить blur на `isolate`/слой с `-z-10` — фильтр перестаёт видеть страницу. У открытого окна не оставлять `transform` / `will-change` — слой блюра остаётся рядом как тёмная «тень».
- Folio уже на новых именах (`SettingsPanel`, `data-settings-panel`, `--sp-*`); vn-manage ещё на старых (`MotionSettingsPanel`, `data-motion-panel`, `--mp-*`) и на локальной копии. Новые переносы — только по новым именам и из пакета. Folio Grid — только колонки (не Rows / не kind switch с /7-grids).
