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

**Constraint:** new npm packages → update this Stack section. `"use client"` stays on UI modules.

## Infrastructure

- **Install:** `"@veevtamm/settings-panel": "github:Veevtamm/settings-panel"` (public GitHub)
- **Install (local, while editing the panel):** `"file:../settings-panel"` — same folder on disk; do not edit `node_modules`
- **Next.js consumer:** `transpilePackages: ["@veevtamm/settings-panel"]`. Local `file:` install: `turbopack.root` = parent of the app and this package (`path.join(__dirname, "..")`).
- **CSS:** `@import "@veevtamm/settings-panel/styles.css"` and Tailwind `@source` on this package `src`
- **Env vars:** none
- **Portless / deploy:** none — this is a library
- **License:** MIT

## Non-goals

- Scene `settings.ts` schemas — they stay in the consuming app
- Plot editors (`vertical-zone-editor`, `axis-curve-editor`) — optional, still in experimental until needed
- Scene-only chrome (Grid Kind Switch on `/7-grids`)
- shadcn, Next runtime APIs inside the panel
- Public npm registry

## Specifics

- Canonical implementation lives **here**. experimental and folio install `github:Veevtamm/settings-panel`. vn-manage still has a local copy — do not edit the copy; new kernel work stays here.
- Figma: Tools file `ttYXL5aqa6feFcY8oNkpwm`, page Panel System. Agent rules for the panel live **in this file**, not in Connected Library.
- Storage keys stay per-scene in the app: `<project>-<scene>-settings`.
- `PANEL_THEME_EVENT` is still `"experimental:panel-theme"` so existing localStorage listeners keep working.

## Guide

Панель настроек сцены (⌘M, glass-док по умолчанию слева сверху, либо `defaultDockCorner`; шестерёнку можно перетащить по четырём углам, как индикатор Next.js Dev Tools): тайминги, easing-кривые, цвета, сетка, шрифт, раскладка. Раньше называлась «motion panel» — при встрече старого имени это она. Канон кода и правил агента — **этот репозиторий** (`@veevtamm/settings-panel`), с публичного GitHub, не с npm. experimental и folio ставят пакет (`github:Veevtamm/settings-panel`; локально пока правишь ядро — `file:../settings-panel`); vn-manage пока на копии со старыми именами — новые правки ядра только в пакете, не в копиях. Figma-библиотека панели — файл [Tools](https://www.figma.com/design/ttYXL5aqa6feFcY8oNkpwm/Tools?node-id=0-1) (`ttYXL5aqa6feFcY8oNkpwm`, страница `Panel System`): коллекции `Panel / Primitive` (скрыта; шкала на тему: `glass` · `surface` · `raised` · `line` · `line-2` · `dim` · `text-2` · `text` · `contrast` — все solid, альфа только у `glass` 72%/86%), `Panel / Color` (Dark|Light = `--sp-*`, все токены — алиасы на шкалу; имена в Figma сгруппированы по ролям `bg/` · `text/` · `border/` · `control/` · `curve/`, CSS-имя `--sp-*` лежит в description токена: `bg/field` = `--sp-field`, `text/main` = `--sp-muted`, `text/bright` = `--sp-fg`, `border/main` = `--sp-line-mid`, `curve/*` = `--sp-plot-*`), `Panel / Space` (`Radius/Field` 4 · `Radius/Chrome` 8 · `Pad/Section` 8), `Panel / Type`. Компоненты chrome пока живут в Web (`eeAjvvgic78C6jJqKmdlWp`, Panel `4816:2`, ширина 348) — Plugin API не импортирует unpublished key; после копирования канон компонентов = Tools. Одна страница `Panel System` (канон) + `Proposals` (черновики) + `_old` (архив мастеров; не удалять). Не плодить новые страницы. Сверху вниз на Panel System: `Foundations` → `00 Icons` + `01 Fields` + `02 Controls` + `03 Pickers` → `04 Rows` → `05 Sections` → `06 Examples` → `07 Timeline` (`445:4308`). `06 Examples` (`ex / Scene panels`: `ex / /7-grids` `87:1202` = Chrome 348, секции в кадрах `p-8`, hairline на всю ширину. Пресеты **внутри** Panel Settings, не сверху: слоты `save` + Язык Ru|Eng + Тема + Изменение секций. Дальше Grid open+eye → Контейнер медиа → Elements (Фон + Интерактивный фон) → Текст с подсекциями Заголовок / Текст / Тег. Рядом `/1`, `/2`, `/5`. `Example / Panel Settings open` — тот же состав рядов. Группы **Цвет** на `/7-grids` нет — Фон в Elements; секции `p-2`, open `gap-4`, линии на всю ширину, gap 0). `Panel / Section` / `Subsection` — Open·Closed + слот Body/Rows; `Chrome` — слот Content; `Section Header` — State × Eye, Grip, Action. Ряды: канон `Panel / Row` (`Layout` Inline|Stack + `Label` + `Icon`/`Glyph` + `Info` + `Modified` + слот `Control`); примеры — инстансы. `04 Rows`: канон `Panel / Row` + примеры-инстансы (Field 86 Default|Hover · Auto; Color Hex / Opacity; Pair/Range = Field; Orient/Fit Align/Join = `Panel / Pick`; Chips/Cells из `02`). Stepper 1×3 остаётся. `03 Pickers`: `Panel / Pick` + глифы в `parts`. Старые мастера — страница `_old`. `Panel / Kind Switch` + `Kind Item` живут в `02 Controls`; в коде Kind Switch остаётся сценой `/7-grids`. При расхождениях в коде канон = пакет, не experimental и не копия в приложении.

Схема-driven, без React Context: страница владеет `settings` + localStorage, `SettingsPanel` только рендерит декларативные `groups` и шлёт `Partial<TSettings>` через `onSettingsChange`.

## Поведение агента (всегда)

- **Новый эффект / фича с magic numbers** → предложить, какие параметры вынести в панель, и **спросить пользователя** (AskQuestion): какие выносить, дефолты, нужен ли scrub. Не выносить всё подряд молча и не хардкодить тюнимые значения молча.
- **Новый параметр** → подобрать контрол по карте ниже; не изобретать новый тип ряда, если есть подходящий. Виджет только этой сцены — `custom`, не новый `Setting*`. Запись в реестр `defineParams` (label ru/en, info, default, `where`, `layer`), не три места; вторая секция — `refs`, не второй ряд; формула — `derived`, не число.
- **Контрол неоднозначен** → спросить пользователя (AskQuestion): если параметр можно отобразить больше чем одним видом (segment vs dropdown, число vs stepper, scrub или нет) или это особый вид (свой виджет, plot, timeline) — предложить варианты с коротким trade-off, не выбирать молча.
- Дефолт нового параметра = текущее поведение сцены (добавление параметра ничего не меняет визуально).
- После изменения схемы панели — обновить описание страницы в `<repo>/AGENTS.md` (дефолты, storage key, что в scrub). Смотреть `console.warn` `settings-panel[<panelId>]` (линт схемы). Агент может вызвать `lintSettingsSchema({ groups, defaultSettings, defaultOpenSections, places, easingTargets, params: P })` — ненулевой массив = не оставлять.
- Добавил в саму панель новый тип ряда, контрол или фичу (`src/`) — обнови **этот `AGENTS.md`** в той же задаче: карту контролов, порядок рядов, ловушки. Правки ядра не делать в experimental / folio / vn-manage.
- Тайминги/дефолты сцены не «улучшать» без запроса — см. `motion.md` (Connected Library / раздатка курса), если файл есть в проекте.

## Карта контролов

Тип ряда = поле секции (`settings` / `toggles` / `colors` / …), не `kind`. `where?` есть у всех рядов, включая pair / range / player / custom / ref.

| Значение | Контрол | Тип | Пример |
|---|---|---|---|
| число + unit (ms, px, %) | поле 86, unit внутри 50% | `NumberSetting` в `settings` | `{ key: "driftSpeed", label: "Скорость", min: 20, max: 250, step: 5, unit: "%" }` (+ опц. `trailing` — 28×28 справа от поля; `readOnly` + `readOnlyLabel: "Auto"` — Figma Width при Stretch) |
| число, крутят часто | + `scrub: true` — слайдер под рядом; кнопка 28 Lucide `settings-2` | там же | `scrub: true`; именованные стопы — `tickStops: [{ value: 0, label: "Tight" }]` (≤14); `tickSnap: false` — тики-якоря, значение может быть между ними (Figma Weight); при `defaultSettings` трек рисует насечку 12px на дефолте и магнитится к ней в радиусе 5px (насечка скрыта, когда значение = дефолт) |
| целое в узком диапазоне | 86 1×3 − / value / + | там же | `{ key: "columns", label: "Модулей в строке", min: 3, max: 12, stepper: true }` |
| вкл/выкл | switch 52×28 | `ToggleSetting` в `toggles` | `{ key: "rubberInvert", label: "Инверсия" }` |
| действие (вход/выход из режима) | Action 86, подпись меняется | тот же toggle + `control: "action"` | `{ control: "action", offLabel: "Изменить", onLabel: "Сохранить" }` |
| два режима с названиями | segment 86 (оба лейбла видны) или dropdown | тот же toggle + labels + `control` | `{ key: "imageCover", label: "Режим", onLabel: "Fill", offLabel: "Fit", control: "segment" }`; длинные лейблы — `controlWidth` (**176** как Dropdown); Тема = segment **86** `sun` | `moon` (`offIcon` / `onIcon`); ориентация кадра **86** `rectangle-vertical` | `rectangle-horizontal`; фаза появления — `Panel / Segment Phase` **332** `Вход` | `Выход` (FILL ряда, не 86); действие — `control: "action"`, не этот ряд |
| 3+ вариантов | dropdown **176** (не fill leftover; Panel / Dropdown Row); не Action 86. 2–3 режима с глифами — `control: "segment"` + `mark` (`from-start` · `from-center` · `from-end`) | `EnumSetting` в `enums` | `{ key: "aspectRatio", label: "Пропорции", icon: "proportions", controlWidth: 86, options: frameRatioOptions(orient) }`; `controlWidth` опционален (дефолт 176; /7-grids Пропорции **86** — как Field, короткие `3:4`); folio Decrypt Порядок: `{ control: "segment", options: [{ value: "start", label: "с начала", mark: "from-start" }, …] }` |
| фазы перехода (N фаз) + плеер | **Канон UI = нижний док `SettingsTimeline`** (Tools `07 Timeline` `445:4308`): таймер 34 в колонке шестерёнки открывает glass снизу (select 328 + транспорт + ряд «Время анимации» + трек + Элементы: инспектор 328 имя/кривая 28/ms \| дорожка). Кривая 28 → `onEditCurve` открывает секцию Безье в ⌘M, не плоттер в доке. `controller.setOpen` = Moment HUD на сцене. Тот же `PlayerSetting` / `PlayerController`; патч — `patchPlayerClips` / `timelinePropsFromPlayer`. Ряд в ⌘M (`SettingPlayer`) — запасной компакт, если док не подключён. **In-panel Player + Elements** (Tools `04 Rows` `ex / Player` `158:1645` = инстанс `Panel / Player` `384:3541`; `ex / Blocks` `158:1684` = шапка Элементы + `Panel / Phases`; мастера `02 Controls`: `Panel / Player Toggle` 28 􀊇 / `Panel / Player Track` (Pin Off\|On) / `Panel / Phase Lane` (State Default\|Hover\|Solo × Clip Start\|End, `383:3527`) / `Panel / Phases` (стек дорожек, Default\|Hover) / `Panel / Player` / `Panel / Moment HUD`). Переключателя Плеер\|Фазы нет (`Panel / Segment 136` больше не в плеере). Ряд = label + Player Toggle 28 (как scrub: на fine pointer иконка слева от Field по ховеру ряда, пока открыт — всегда; open+hover = `xmark`) + Field **всего** 86 = длина таймлайна — **свой ключ** `PlayerSetting.totalKey` (не сумма и не `max(конец клипа)`): драг/трим фаз её не меняет, фазы лежат внутри (`min`…total, клип упирается в правый край); ввод меньшего значения подрезает фазы, которые не влезли (`fitClipsToTotal`); ниже, только пока плеер открыт (без переключателя режимов): **Плеер** (трек 28, Figma `347:3746`: заливка `bg/fill` во всю высоту от 0 до q + плейхед линия 2×28 `knob-off` во всю высоту z-20, не драг-бар; плейхед и пины: q=0 и q=1 inset 2px внутрь поля (`calc(2px + (100% - 4px) * q)`), скраб той же шкалой — иначе overflow+бордер 1px съедает 0 и конец; пины 2×12 `knob-off` по центру высоты, клик по пину = seek; в solo вместо заливки до q рисуется клип фазы как на дорожке (22 / inset 3 / radius 2 / `fill-strong`, Figma `347:3818`); транспорт 28 в три группы (1fr auto 1fr): слева 􀐱 + `×1`→`×3`→`×5`→`×10` циклом (не setting) · по центру 􀊉 назад / 􀊃 пуск ↔ 􀊅 пауза (тогл; всегда вперёд, с конца = с начала) / 􀊋 вперёд · справа 􀎦 пин (􀎨 `pin.slash`, когда плейхед на пине; тик на треке 2×12 `--sp-tick`) · 􀉃 копировать `label · 651 ms — фаза 1` (ms всего перехода, не q; при наложении все активные имена) + URL `?moment=<id плеера>:<q>` (по записи на плеер — на странице их может быть несколько; `id` у `TransitionPlayer` / `PlayerController`, читать `readMoment(id)`; плеер по умолчанию закрыт, открытие с q = 0 (пауза превью), закрытие плеера или панели сбрасывает просмотр (q = 0, пауза, scroll-view выкл, solo выкл, пины остаются)); toggle «Просмотр скроллом») → подсекция **Элементы** (заголовок 15/20 + шеврон, сворачивается, открыта по умолчанию; `PhaseLanes`): Figma `Panel / Phase Lane` `383:3527`: **дорожка на каждую фазу** (chrome Field 28, gap 4), клип 22 высотой, inset 3 (1px stroke + 2), radius 2, `--sp-fill`; имя + длительность слева в поле дорожки (left 6, по вертикали центр поля 28, gap 12), **не** внутри клипа: `ФАЗА 1  700 ms` (Geist 11/14 uppercase + mono unit), `text/dim`; ховер дорожки = border `line/strong`, клип `--sp-fill-strong`, имя `text/label`; solo (Figma `347:3818`) = border `line/focus`, клип `fill-strong`, имя `text/bright`, без плейхеда на дорожке; шкала всех дорожек = total; без `startKey` = pack слева направо; с `startKey` = абсолютный старт; `kind: "pause"` не рисуется; **дабл-клик** (или Enter) по всей дорожке (поле 28, не только бар) = solo: фаза проигрывается **один раз** и останавливается на своём конце (не цикл; «Пуск» с конца = снова с начала фазы), плейхед виден на треке Плеера внутри клипа фазы, tagged-треки других фаз freeze на `from`, Esc / повторный дабл-клик снимает; pointerdown на другой фазе (драг/трим) тоже снимает, не переключая соло; одиночный клик — ничего; drag тела = сдвиг клипа целиком (длительность та же; клип становится абсолютным) + бейджи start и end над обоими краями; драг живёт на `window` (pointermove/up/cancel), а не на pointer capture: заканчивается на отпускании, при `buttons === 0` и при выходе курсора за блок дорожек дальше 24px; ручки in/out видны только когда курсор в ±12px от края клипа (in у левого, out у правого) = бары 2×18 `--sp-knob-off` внутри клипа inset 2 (hit 10px; держишь = `--sp-knob`), меняют только свой край; при драге края/тела snap к `step` (**10** ms); бейдж времени над ручкой (portal, glass + `line/mid`, radius 8, pad 8/4, Geist Mono 11/14 `text/bright`, только число ms); никакой линейки, полей In/Out и подписей-цифр под треком). Старый Timeline Row `5211:375` / `TimelineSetting` удалён. Сцена отдаёт `PlayerController` (`getState`/`subscribe`/`seek`/`play`/`pause`/`setSpeed`/`setScrollView`/`setOpen`/`togglePin`/`setSolo`); готовая реализация — `lib/transition-player.ts` `TransitionPlayer` (rAF-часы, `currentTime`, `phases?:` индекс клипа, `rebuild()` сохраняет q, `reverseTimeScale`, `nudgeByPixels`; `layoutClips` / `fitClipsToTotal` / `momentMs(total, q)` / `waapiSpan` в `lib/player-clips.ts`; `formatMoment` / `momentCopyText` принимают total) | `PlayerSetting` в `player` (одна на секцию) | `{ label: "Reel", totalKey: "reelTotalMs", phases: [{ key: "reelPhase1Ms", caption: "фаза 1", kind: "phase", max: 2000 }, { key: "reelPhase2Ms", startKey: "reelPhase2StartMs", caption: "фаза 2", kind: "phase", max: 2000 }], unit: "ms", min: 10, step: 10, controller }` |
| цвет | hex row 28+1+102, HSV flyout + eyedropper | `ColorSetting` в `colors` | `{ key: "backgroundColor", label: "Фон" }`; `after` — под числом (folio Grid: Цвет под Количество); `textAligns` с `after` на ключ цвета — сразу под hex (/7-grids: Выравнивание живёт в Шрифте, под hex в Цвете — `refs`); `opacityKey` — chrome 28+1+102+1+56, % hover ▴/▾ overlay 21px поверх «%» (тот же chrome, что у number field: `--sp-fill-strong` только `border-l` + hairline ▴/▾; overlay inset 1px, чтобы не перекрыть `--sp-line-mid` ряда); квадрат сватача — solid hex, без alpha |
| min–max диапазон | dual range | `RangeSetting` в `ranges` | `{ fromKey: "fontWghtMin", toKey: "fontWghtMax", label: "Толщина", min: 200, max: 900, step: 10 }` |
| квадрат/вертикаль/горизонталь | 1×3 Orient (28×3 + 2 rules, Lucide 20×20 `square` / `rectangle-vertical` / `rectangle-horizontal`) | `FrameOrientSetting` в `orients` | `{ key: "aspectOrient", label: "Ориентация" }` |
| left/center/right | 1×3 Fit (`align-start-vertical` / `align-center-vertical` / `align-end-vertical`) | `XAnchorSetting` в `xAnchors` | `{ key: "kolonnayaImageAlign", label: "Фит" }` |
| left/center/right/justify | 1×4 Fit chrome 115 (28×4 + 3 rules; Lucide `align-left` / `align-center` / `align-right` / `align-justify`) | `TextAlignSetting` в `textAligns` | `{ key: "captionTitleAlign", label: "Выравнивание", after: "captionTitleColor" }` |
| 9 позиций | 3×3 Anchor | `AnchorSetting` в `anchors` | `{ key: "imageFitAnchor", label: "Якорь" }` |
| произвольная строка | textarea на всю ширину ряда, несколько строк | `TextSetting` в `texts` | `{ key: "notes", label: "Заметка" }` |
| иконка перед лейблом | Lucide 20×20 слева от названия | любой ряд: `icon`; подсекция: `SettingsSection.icon` | `{ icon: "proportions", label: "Пропорции", … }` / `{ title: "Педаль", icon: "timer", … }` — как boolean Icon + Glyph в Figma; без `icon` глифа нет, пока не выберут в **Изменение секций** |
| два связных числа (gap X/Y, pad X/Y) | один ряд, два поля, **20×20** глиф слева снаружи поля (не внутри) | `PairSetting` в `pairs` | `{ label: "Отступы", fields: [{ key: "padX", ariaLabel: "Отступ по X", icon: "padX", min: 0, max: 200 }, { key: "padY", … icon: "padY" … }] }` |
| easing-кривая | Bezier-секция: select → curve editor → Copy 28 слева (`file` → `check`, копирует `0.22, 1, 0.36, 1`) + 4 поля coords без лейбла ряда (`x1`/`y1`/`x2`/`y2` как unit 50% внутри поля) → preset на всю ширину (14×14 из Panel / Icon; Custom bezier = `function-square`; Replay 28 у пресета **пока скрыт**) | **не row**: проп `easingTargets` + поле `easings: Record<string, CubicBezier>` в `TSettings` | `easingTargets={[{ id: "phase1", label: "Phase 1" }]}` |
| кастомный plot (оси, зоны) | своя секция | проп `curveSection` (ReactNode) | `AxisCurveEditor` (/2) = square viewport plot, header Lucide `function-square` via `curveSectionIcon`; `/5` **Зона замедления** = Range Row в Grid (`zoneLeft`/`zoneRight`), не `curveSection`; Bezier-секция (easing) = `spline` |
| виджет из пакета (пропуски, чипы, shuffle, join обводки) | готовый React в subsection | `CustomSetting` в `custom` | `/7-grids`: `SettingCells` / `SettingChips` / `SettingSkipReplay`; `/7` обводка: `SettingStrokeJoin`. Схема сцены остаётся `custom`, не новый `kind` ряда. `{ id: "skipCells", after: "rowSkip", render: …, keys: [{ key: "skipCells", label: "Пропуски" }] }`. Матрица: `parseSkipCells` / `serializeSkipCells` из пакета (`@veevtamm/settings-panel/skip-cells` без `"use client"`). Корень виджета с `RowLabel` — `data-setting-row` (тултип ⓘ = ширина этого ряда, не иконки). **Grid Kind Switch** — не ряд и не пакет: остаётся сценой `/7-grids` |
| тот же параметр во второй секции | тот же контрол, без копии | `RefSetting` в `refs` | `{ ref: "columns", after: "padY" }`. Не копия: Reset/Copy считают исходный ряд один раз; в указке остаётся, если ключ в месте |
| величина-формула (read-only) | chrome readOnly-поля «Auto» | `DerivedSetting` в `derived` | `{ id: "stagger", label: L("Ступень","Stagger"), unit: "ms", compute: (s) => s.itemsStartMs - s.navStartMs, after: "navStartMs" }`. Не хранится, не в Reset/Copy/снапшотах; в указке — если `after` в месте или `where` содержит место |

Порядок внутри subsection — только **дефолт рендера**, не догма: player → colors → orients → toggles → texts → **custom без `after`** → settings(number) → derived → pairs → ranges → enums → anchors → xAnchors → textAligns → refs. `derived` без `after` встаёт после `settings`; `refs` без `after` — после `textAligns`. Расположение подстраивается под сцену: любой ряд встаёт «под конкретным toggle/orient/number/цветом» через `after: "ключ"`; `after` не ограничен `followerKinds` — цепочка folio Grid (Количество → Цвет → Тип → Ширина Auto → Отступ → Gutter) должна рендериться целиком. Группировка по секциям/сабсекциям — свободная, решает автор схемы; пользователь дополнительно двигает сабсекции драгом и секции через Panel Settings → Изменение секций. Toggle с `after` на number (или pair) встаёт под этим полем; range с `after` на этот toggle — сразу под ним. `textAligns` с `after` на ключ цвета — сразу под hex. `custom` с `after` встаёт сразу под этим ключом.

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

Один параметр — одна запись: key, `label`, контрол, диапазон, `default`, `info`, `where` (id мест; omit = страница), `layer`. Из неё: `DEFAULTS` = `defaultsOf(P)`, тип `SettingsOf<typeof P>`, места `PLACE_DEFS` напрямую (`placesOf` опционален — панель сама резолвит `where` через `resolvePlaces`), ряды `P.driftSpeed` или `...rowsOf(P, […])`. Range / pair / player по-прежнему собирают вручную из ключей `param.value`. `placesOf` пишет `console.warn`, если `where` указывает неизвестный id места или место без ключей и `easingIds`.

```ts
const P = defineParams({
  driftSpeed: param.number({
    label: L("Скорость", "Speed"), default: 100,
    min: 20, max: 250, step: 5, unit: "%",
    where: ["tape"], layer: "motion",
  }),
  fontWghtMin: param.value({ default: 200, layer: "type" }),
  rubberInvert: param.toggle({
    label: L("Инверсия", "Invert"), default: false, layer: "motion",
  }),
});
type TSettings = SettingsOf<typeof P>;
const DEFAULTS = defaultsOf(P);
const places = PLACE_DEFS;
// sections: [{ title: L("Лента", "Tape"), settings: [P.driftSpeed] }]
```

**Новые сцены — только через реестр; старые inline-схемы работают, миграция по мере правок.** `SettingsPanel` линтит схему в консоль; полный проход с `params: P` — `lintSettingsSchema`.

- **Слои групп (канон).** Заголовки групп — только из словаря слоёв: **Тайминги** (`timings`, `timer`) · **Раскладка** (`layout`, `layout-grid`) · **Шрифт** (`type`, `type`) · **Цвет** (`color`, `palette`) · **Движение** (`motion`, `activity`) · **Сетка** (`grid`, `columns-3`). `SettingsLayer` в коде = те же id. Группа = слой (что за закон), подсекция = свободно (чаще место: Заголовок / Модуль / Лента). «Elements» больше не заводить — его содержимое расходится по слоям (фон → Цвет, размеры → Раскладка, анимации → Движение). Сценные группы вне словаря: /2 **Соты** (`honeycomb`) — с пометкой в AGENTS сцены. Ряды без `where` = уровень страницы. experimental и dilusa мигрированы целиком; folio / vn-manage — по мере правок.
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

Разводить смыслы, а не делить одно слово: **Cover** → «Обложка» (страница) / имя фазы «Фон (клип)» (ms); **Фон** — только цвет; **Толщина** — только шрифт; **Тип** — всегда с уточнением; **Скорость** — только % сцены. Полный аудит лейблов по сценам — в истории задачи, канон — эта таблица; нет величины в таблице → добавить сюда в той же задаче.
- Группы: словарь слоёв — **Тайминги** (`timings`, `timer`) · **Раскладка** (`layout`, `layout-grid`) · **Шрифт** (`type`, `type`) · **Цвет** (`color`, `palette`) · **Движение** (`motion`, `activity`) · **Сетка** (`grid`, `columns-3`); заголовки групп — `L(ru, en)` из словаря. Исключение сцены: /2 **Соты** (`honeycomb`). Служебные id: `panel`, `bezier` / `curves`. Подсекции свободные (ряды сцены — в AGENTS приложения). Глаз на группе: /2 Соты `honeycombShowGrid`; /5 /6 /7-grids Сетка `showLayoutGrid`. `headerAction` = любой контрол в шапке секции или группы (experimental /6 Replay на группе Тайминги). Оверлей сетки: два цвета с `opacityKey` (chrome 28+1+102+1+56); `visibilityKey` = глаз 16 у шеврона секции **или группы**; folio Grid — на группе, ряды `untitled`. Быстрый показ — кнопка 34 в доке (`dockExtra` / `LayoutGridToggle`; вкл = glass + `--sp-fg` + `--sp-line-strong`, выкл = glass + muted); лейблы контролов RU («Фон», «Якорь»).
- `defaultOpenSections` — id слоёв, которые есть на сцене (`timings` · `layout` · `type` · `color` · `motion` · `grid`) плюс служебные, если секция есть: `"bezier"` (без plot = секция easing **Кривая Безье**; с `curveSection` = plot), `"curves"` (easing, только если рядом есть plot), `"honeycomb"` (/2 Соты), `"panel"` (Panel Settings, `sliders-horizontal`, Tools `7:1115`, закрыт по умолчанию).
- Схема может зависеть от settings (`groups(settings.someToggle)`) — скрытые ряды не рендерятся, значения в storage остаются.

## Подключение на странице

```ts
const [settings, setSettings] = useLocalSettingsStore({
  storageKey: STORAGE_KEY, getSnapshot, refreshSnapshot, save,
  serverSnapshot: DEFAULTS,
});
<SettingsPanel
  panelId={PANEL_ID} storageLabel="scene-name"
  settings={settings} groups={groups}
  places={PLACES}
  onSettingsChange={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
  onReset={() => setSettings(DEFAULTS)}
  defaultSettings={DEFAULTS}
  easingTargets={...} dockExtra={...}
  defaultDockCorner="bottom-left"
/>
<SettingsTimeline
  panelId={PANEL_ID}
  {...timelinePropsFromPlayer(player, settings, locale)}
  showDockButton={false}
  onChange={(next) =>
    setSettings((prev) => ({ ...prev, ...patchPlayerClips(player, next) }))
  }
  onEditCurve={(i) =>
    focusPanel(PANEL_ID, { easingId: easingTargets[i]?.id })
  }
/>
```

Нижний таймлайн — канон для фаз. Если он есть, **`player` из `groups` не класть** (один `controller`, иначе два UI). Кнопка таймера — `dockExtra={<SettingsTimelineDockButton controller={player} />}` + `showDockButton={false}`, чтобы она жила в стеке Fold/указка. Корень дока — `data-settings-panel` (жесты сцены игнорят). `showDockButton` default true — таймер сам под шестерёнкой, без панели.

`defaultSettings` передавать всегда: он включает точку-reset у каждого изменённого ряда (клик — вернуть дефолт этого параметра), счётчик изменённых параметров на доке и кнопку «Скопировать новые дефолты» (копирует изменённые ключи со значениями и лейблами — чтобы вшить их в `DEFAULT_*` кода).

- Анимация читает `settings.*` напрямую (в rAF — через `settingsRef.current`).
- localStorage: значения — `<project>-<scene>-settings` (ломающий формат → суффикс версии `-v2`, не silent overwrite); UI-кэш панели отдельно: `${panelId}:subsection-order`, `${panelId}:timeline-order` (`{ [playerId]: phaseKey[] }` — порядок рядов Элементов; Reset не чистит), `${panelId}:panel-settings` (`theme`, `locale` ru|en default **ru**, `reorderSections`, `sectionOrder`, `pinnedSections`, `sectionIcons`, `panelWidth` 348 / `panelHeight` hug, `dockCorner`, `lastEdited` `{ group, section? }` — при load открывает эту группу и именованную подсекцию **вдобавок** к `defaultOpenSections`; Reset сцены не чистит; тема и язык), `${panelId}:snapshots` (пресеты этой страницы; в JSON есть `panelId`, чужой слот не применяется).
- **Язык** — Panel Settings, сегмент **86** `Ru` | `Eng` (как Тема; подписи сегмента не переводятся). Тема — те же 86, Lucide `sun` | `moon` вместо Light|Dark. Дефолт **ru**. Reset сцены язык не сбрасывает. Схема: `label` / `info` / `onLabel` / `offLabel` / `title` / enum / player caption / easing target — `L("рус", "English")` (`Copy` = `{ru,en}` или пока строка). Рендер резолвит через `tx(copy, locale)`. Порядок сабсекций хранится по русской строке (`copyKey`). Подсказки ⓘ тоже двуязычные. Сегменты (Fit|Fill, якоря, ориентация) переводятся. Chrome панели (Пресеты, Тема, Изменение секций, плеер) — `PANEL_COPY`. Новому параметру сразу писать обе версии.
- Reorder subsections: драг за grip складывает **все** именованные сабсекции этой группы (не untitled), после отпускания возвращает их прежний open/closed. Пока драг идёт, ряды и контролы не ховерятся и не выделяются.
- Panel Settings → **Изменение секций** (switch 52×28, выкл default): вкл — ручка `grip-vertical` и рядом пин (`pin` / `pin-off`) слева от иконки **каждой** секции, включая Panel Settings; клик по глифу 20×20 секции, **подсекции** или **ряда** открывает пикер иконки; сворачивает остальные секции, **Panel Settings остаётся открытой**. Выкл прячет ручки и пикер (порядок уже пишется при драге). Драг тоже сворачивает, после отпускания восстанавливает open/closed. Пока драг секции или сабсекции идёт, внутренние ряды не ховерятся и не выделяются. Пин вынимает секцию из скролла и ставит её **сверху**. Между закреплённым рельсом и скроллом — `--sp-section-line` (Dark/Light = `dim`: `#616161` / `#a9a9a9`; Figma `border/section`), линия остаётся на рельсе и не уезжает со скроллом. Дефолт пина — Panel Settings (`pinnedSections` omit). Порядок и пины в `${panelId}:panel-settings`. Reset сцены порядок/пины не сбрасывает; **override иконок сбрасывает**.
- **Иконки** — только пока **Изменение секций** включено: клик по глифу 20×20 (не по заголовку) открывает glass-пикер как у сватча: сетка всего каталога Panel / Icon, без поиска. Нет глифа в схеме — триггер `plus`. Flyout на `document.body` (`data-settings-panel` + `data-panel-theme`), не внутри скролла панели; wheel на сетке `overscroll-contain`, на краю — `preventDefault`, на страницу не уходит. Выбор пишется в `${panelId}:panel-settings` `sectionIcons`: id секции / `sub:<groupId>:<copyKey(title)>` / `row:<id>` → `SfSymbolName`; совпадение со схемой — ключ удаляется. Указка (× вместо глифа группы) без пикера у секции места. Override считается изменением: точка-reset, счётчик Copy/шестерёнки, Copy пишет `Иконка · …`. Reset сцены чистит `sectionIcons` (схема снова).
- **Размер окна** — свободный край панели (сторона от шестерёнки + противоположная по вертикали + угол): ширина **348–560** (Figma 348 = min), высота **200**–остаток вьюпорта как **потолок** (`max-height`; окно всегда hug контента, `height: fit-content`). Persist `panelWidth` / `panelHeight`. Драг высоты задаёт потолок, не пустое стекло. **Положение** — драг за верхний край окна (хит 8px, без отдельной полоски; не шапки закреплённых секций и не ряды/тело); не выходит за inset 12; ближе **28px** к колонке шестерёнки/Reset/Copy прилипает обратно (`panelFloat` omit = пристыкована). Reset сцены не сбрасывает.
- Переименование storage-ключа или panelId — только с миграцией: load читает старый ключ, если новый пуст (`*_STORAGE_KEY_LEGACY`); для UI-кэша — проп `legacyPanelIds`. Save пишет только новый ключ.
- Триггер дока (закрытая панель) — Lucide `settings` (`Panel / Dock / Gear` State=Closed); открытая — `x` (`State=Open`). Пока панель открыта, под шестерёнкой — **свернуть/развернуть все** (одна кнопка, два режима; в закрытом доке нет): `list-chevrons-down-up` = свернуть все секции и именованные подсекции / `list-chevrons-up-down` = развернуть все (видимые секции; при указке — Panel Settings + место). Chrome как Pointer Off (`Panel / Dock / Fold` State=Collapse|Expand). Перетаскивание шестерёнки (порог 4px, иначе клик) — как Next.js Dev Tools: пока рука держит, кнопка едет за курсором; отпускание прилипает к ближайшему из четырёх углов (`defaultDockCorner`, omit = top-left); панель и Reset/Copy открываются внутрь экрана; `${panelId}:panel-settings` `dockCorner` (legacy `dockX`/`dockY` → ближайший угол); Reset сцены угол не сбрасывает. Dock **Reset** — Lucide `eraser` (`Panel / Dock / Reset`). **Reset** сбрасывает значения сцены и override иконок (`sectionIcons`) — не тему, не порядок subsections, не снапшоты, не URL-параметры, не положение дока, не `lastEdited`. Dock **Copy** — Lucide `file` (`Kind=Copy`); после копирования на 1.4s — `check` (не `function-square`). При `defaultSettings` копирует hand-off для агента (`PANEL_COPY`): заголовок `Новые значения по умолчанию · <storageLabel> · изменено N из M`, дальше группы / именованные подсекции, строки `лейбл (key): old → new`, блок `Иконки`, финал «Впиши эти значения в DEFAULTS сцены…». Без `defaultSettings` Copy нет (старый плоский формат `copyDefaultsHeader` + `лейбл (key): value` не копируется). У Copy бейдж: ключи с контролом в схеме (easings — только изменённые цели, не весь Record; plot-секция Axis как одно) и каждый override иконки, без скрытых производных вроде `aspectW`/`aspectH`. Тот же бейдж на закрытой шестерёнке (открытая панель — только Copy). При переданном `defaultSettings` Reset и Copy видны только пока есть изменения.
- **Пресеты (снапшоты)** — ряд в Panel Settings (лейбл «Пресеты» + глиф `save` + info + 5 слотов 144×28 справа, как Orient); не отдельная секция; 5 слотов (`Panel / Snapshot Slot`: Empty / Saved / Active / Drift × Hover), цифры без приглушения; клик по пустому = сохранить текущие настройки, по сохранённому = применить (только ключи этой страницы), ⌥-клик — перезаписать, × на hover = очистить; у активного слота точка-дрейф, если текущие значения ушли от снапшота. Storage `${panelId}:snapshots` (`{slots, active, panelId}`); `legacyPanelIds` мигрирует слоты; Reset их не трогает. Счётчик Copy — только ключи `defaultSettings` этой страницы; у plot-секции (Axis / зоны) и Bezier есть точка сброса, если их ключи не в рядах. Тема панели (`${panelId}:panel-settings`) общая с доком сцены: `/7-grids` `GridKindSwitch` читает её и красится `--sp-glass` / `--sp-line` / `--sp-fg`.
- **Указка** (kreator-panel «законы места», не инспектор одного узла): проп `places` — список мест без ключей (`id`, `label`, `where` селекторы, `hit`, опц. `keys`/`easingIds` как явные добавки); параметры места = ряды с `where`, включающим id (+ `EasingTarget.where`), считает панель (`resolvePlaces`); подпись при ховере `Лента · 9`; предупреждение на пустое место. Непустой список → док 34 Lucide `mouse-pointer-click` (стек с `dockExtra`, chrome как у сетки; **только при открытой панели**, как Fold — закрытие панели гасит режим указки). Канон механики — `/1` (thumbs / rail / overlay). Есть на всех сценах с панелью: `/2` Текст / Заголовки / Номера / Изображения / Соты / Решётка / Фон; `/3` Кадр / Шкала / Спидометр; `/7-grids` Заголовок / Текст / Тег / Медиа / Модуль / Оверлей / Страница; `/5` Буквы / Зона слева / Зона справа / Лента / Фон; `/6` Миниатюры / Заголовок / Имя / Experiments / Projects / Сетка; `/7` Текст / Обводка (один холст: при вкл. обводке клик = Обводка) / Фон. Главная `/` — без панели, без указки. Режим: курсор-прицел, hover обводит **все** совпадения `where` (полноэкранный overlay — только подпись), клик сужает панель до ключей места (чужие ряды и чужие секции не рендерятся; место = секция с шевроном, × 20 слева у названия вместо глифа группы, в закреплённой колонке сразу под Panel Settings, открыта по умолчанию; один источник параметров = ряды в теле, несколько = подсекции, easing/plot тоже подсекции), клик перехватывается пока режим включён. Выход из режима — повтор кнопки / Esc; выход из сужения — × в шапке панели / Esc ещё раз. `?place=<id>` открывает уже суженным. Сцена сама вешает `data-settings-place` и описывает карту (канон — `/1`: thumbs / rail / overlay). Не эвристика по DOM. Hit по умолчанию — rect'ы `where` (клиппятся по вьюпорту); если контейнер места намного больше своего содержимого (на /5 блок букв ~3000px на весь экран), место даёт свой `hit`: на время указки `body.settings-place-pick` включает `pointer-events` на спанах глифов (globals.css) и `hit` = `elementFromPoint(...).closest('[data-settings-place=…]')` — пустые области блока проваливаются в зоны/ленту/фон. Figma Tools `08 Review` + `Panel / Dock Button` Kind=Pointer State=Off|On (глиф 􀇰, chrome как Grid).
- **Таймлайн** — `SettingsTimeline` (Tools `07 Timeline`). Не дублировать `section.player`, если док подключён. Chrome: ряд **Анимация** (`timelineTarget`) + `Panel / Dropdown` **176** (`SettingEnumDropdown` / `PanelSelectList` `overlay` — открывается поверх тела дока, высоту не двигает). `onEditCurve` открывает Безье в ⌘M (`lastEdited` / `easingTargets`), не плоттер в доке. Линейка и клипы — одна шкала `LANE_PAD_PX` **3** (0 и total на внутренних краях дорожки); клип не отступает сам с двух сторон — стык без дырки. Player Track — свой pad **2**. Док pad **12 / 8 / 8 / 8** (`pl-3 pr-2 py-2`); chrome→тело **8**; шкала↔Элементы **8**; шапка↔ряды **8**; ряды фаз **4**. Элементы: Lucide `sliders-horizontal` 20 у заголовка, gap **4** до подписи; ряд фазы — `grip-vertical` 20 как у сабсекций (fine pointer: на hover ряда; touch — всегда; драг переставляет ряды инспектора и дорожек вместе; клипы остаются на своих ключах; `${panelId}:timeline-order`) + имя.
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
- `custom` — не новый тип ряда ядра: Пропуски / Мест в строке / Shuffle / Join — виджеты пакета, в схему через `custom`. В Figma это `Panel / Cells` / `Panel / Chips` / `Panel / Replay` / `Panel / Pick` Kind=Join в слоте `Panel / Row`, не отдельные * Row. Plot — `curveSection`. `keys` + `rowReset` — чтобы Reset/Copy и точка-reset работали. Grid Kind Switch — сцена `/7-grids`, не npm-пакет; в Tools — `Panel / Kind Switch` + `Panel / Kind Item` (не папка 06 Custom).
- `SettingsTimeline` — не новый тип ряда. Не класть `player` в схему, если док уже на странице. Кнопка таймера в `dockExtra`, не второй независимый док рядом с Fold. Клипы и линейка делят `LANE_PAD_PX`; не вычитать inset из ширины каждого куска — иначе между соседними фазами появляется ложный зазор. Линейка: засечки каждые **100** ms, подписи 0 / каждые **500** / total.
- `refs` / `derived` не считаются в Reset/Copy (`refs` — исходный ряд один раз; `derived` не хранится). `derived` без `after`/`where` в указке исчезает. `defineParams` не экспортирует голые `number`/`text` — только `param.*`. Панель сама вызывает `lintSettingsSchema` (один `console.warn` на issue): `unknown-open-section` · `unknown-group-id` · `layer-title` · `bare-copy` · `unknown-after` · `missing-ref` · `duplicate-row` · `row-without-default` · `empty-place` · `unknown-place`. `row-without-control` — только если в вызов передали `params` (панель `P` не знает). `defaultOpenSections` без группы слоя не ругается (`layout` можно открывать, даже если группа скрыта тогглом); ругается на id вне словаря слоёв/`honeycomb`/служебных (`panel` · `bezier` · `curves` · `place`).
- Ряд без `where` не попадает ни в одно место (уровень страницы) — если параметр «пропал» из указки, это первое, что проверить. `where` у `param.value` (ключ без ряда: край range, поле pair, фаза плеера) панель не видит — место читается с **ряда** (`RangeSetting.where` и т.п.); если один ряд делится между местами (range «Зона замедления» → места Зона слева / Зона справа), ключи пишут явно в `place.keys`, либо собирают `placesOf(P, PLACE_DEFS)`.
- Hex — uppercase `#RRGGBB` (`normalizeHex`), и в поле, и в persist.
- Ключи `easings` обязаны совпадать с `easingTargets[].id`, иначе патч уходит в пустоту (fallback `0.22,1,0.36,1`).
- `storageLabel` — только a11y, не ключ storage.
- Текст: Geist Sans **15/20** — заголовки групп/subsections и лейблы рядов; поля, сегменты и dropdown **14/18** (числа / hex / bezier — Geist Mono, текстовые и сегменты — Geist Sans). Иконки пункта и Section Header — `--sp-fg` (`text/bright`), не `--sp-muted`. Ряд на hover не светлеет (лейбл / иконка / фон); hover только у контрола. В Figma hover на атомах: `Panel / Field` (`Kind` Number|Auto|Hex = содержимое; `Size` только реальные: 86 число · 56 opacity · 102 Hex · Fill coords; `State` Default|Hover — у Number 86 и 56 Hover = зоны ▴/▾ 21px поверх unit, не отдельный Kind Chevrons; Hex/Auto/Fill Hover = `border/strong`) / Action / Replay / Swatch `State=Default|Hover`; Color Hex, Dropdown, Scrub Toggle, Toggle — ось `Hover=Off|On` (Toggle Off hover = `border/strong`; On уже strong); Pick Cell `Off|Hover|On`; Stepper / `Panel / Pick` (Kind Fit|Orient|Join|Align) / `Panel / Segment` (Size 86|Fill × Face Text|Icon) — **Hover на всём треке** (`border/strong` поверх ячеек, в коде `::after` overlay, не inset box-shadow — заливка ячеек иначе перекрывает обводку). Не на `Panel / Row`. Hex = `Kind` Field Size=102; зоны ▴/▾ = `State=Hover` у Number, не Kind. `_old / Hex` и `_old / Field Stepper` живы для старых инстансов.
- Размеры зашиты в код, не в CSS-переменные: Field 86 / Hex 102 / Color opacity 56 / Coords и Text ≥180 / Chip 28×28 (gap 4, пунктирный + того же размера) / Toggle 52×28 / Action 86 (кнопка-действие, не цикл enum) / Fit 1×3 86 / Fit 1×4 Text Align 115 / Segment 86 (Fit/Fill и enum `control: "segment"`) / Theme segment 86 sun.max|moon; Language 86 Ru|Eng / Dropdown row **176** fixed (не leftover); `EnumSetting.controlWidth` переопределяет ширину; не трогает Preset / Fit|Fill / Dropdown 86 / Swatch 28 / dock-кнопки 34. Orient 1×3 — SF 20×20 `square` / `rectangle.portrait` / `rectangle` (не Glyph Orient 12×12). Enum 1×3 — глифы `from-start` / `from-center` / `from-end`, не square/portrait/landscape. Ряд: label↔control **16** (`gap-4`), высота 28; заголовок секции / сабсекции: иконка секции↔title **4** (`gap-1`), grip `line.3.horizontal`↔следующий элемент **8** (`gap-2`), actions справа 6; Replay+Preset **4**; Preset trigger **28**. Ряд Replay+Preset — `min-h-[28px] items-start`, не `h-[28px] items-center`: список пресетов раскрывается `SectionCollapse` вниз; фиксированная 28 + center поднимает триггер. SF-глифы: кадр **Panel / Icon Vectors** (flatten instance 20×20, `viewBox 0 0 20 20`, CSS `size-5`); grip сабсекции = Panel / Icon `line.3.horizontal` 􀌇 20×20; Scrub Toggle 28 = Lucide `settings-2` (Tools `51:518`). Не flatten в 16 и не рисовать в 20 — глиф раздувается.
- ⌘M — физический `KeyM` + meta; игнор при фокусе в input/textarea/select/contenteditable. Shortcut открывает/закрывает **без** motion (как command palette); клик по шестерёнке — enter 220 / exit 160 ease-out. Safari: ⌘M сворачивает окно браузера (не перехватить). Окно панели — `position:fixed` к вьюпорту + portal на `document.body` (не `absolute` снаружи 34px-дока: iOS клиппит overflow у `fixed`). Hug — `height:auto` + grid `auto / minmax(0,auto)`, не `flex-1` (basis 0% → высота 0). Стекло — `backdrop-blur` + `--sp-glass` на самом окне; не выносить blur на `isolate`/слой с `-z-10` — фильтр перестаёт видеть страницу.
- Folio уже на новых именах (`SettingsPanel`, `data-settings-panel`, `--sp-*`); vn-manage ещё на старых (`MotionSettingsPanel`, `data-motion-panel`, `--mp-*`) и на локальной копии. Новые переносы — только по новым именам и из пакета. Folio Grid — только колонки (не Rows / не kind switch с /7-grids).
