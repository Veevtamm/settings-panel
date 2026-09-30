import type { PanelFont } from "../lib/panel-theme";

export type PanelLocale = "ru" | "en";

export type LocaleText = { ru: string; en: string };

/** Schema copy: bilingual object, or a plain string while a row is still untranslated. */
export type Copy = string | LocaleText;

export function L(ru: string, en: string): LocaleText {
  return { ru, en };
}

export function tx(copy: Copy | undefined, locale: PanelLocale): string {
  if (copy == null) return "";
  if (typeof copy === "string") return copy;
  return copy[locale];
}

/** Stable id for subsection order — always the Russian string. */
export function copyKey(copy: Copy): string {
  return typeof copy === "string" ? copy : copy.ru;
}

/** Mac / iOS use ⌘ · ⇧. Windows / Linux use Ctrl · Shift. */
export function isAppleKeyboard() {
  if (typeof navigator === "undefined") return true;
  const plat = navigator.platform ?? "";
  const ua = navigator.userAgent ?? "";
  return /Mac|iPhone|iPad|iPod/.test(plat) || /Mac OS X/.test(ua);
}

export type ShortcutKind = "hideDock" | "undo" | "redo";

export function shortcutKeys(kind: ShortcutKind, apple = isAppleKeyboard()) {
  if (kind === "hideDock") return apple ? "⌘\\" : "Ctrl+\\";
  if (kind === "undo") return apple ? "⌘Z" : "Ctrl+Z";
  return apple ? "⇧⌘Z" : "Ctrl+Shift+Z";
}

export const PANEL_COPY = {
  presets: L("Пресеты", "Presets"),
  presetsInfo: L(
    "Слот хранит весь набор настроек этой страницы, не всего сайта. Пустой: клик — сохранить текущие. Сохранённый: клик — применить, ⌥-клик — перезаписать, × на ховере — очистить. Иконка сохранить — в первый пустой слот, иначе в активный.",
    "A slot stores this page’s full settings, not the whole site. Empty: click to save. Saved: click to apply, ⌥-click to overwrite, hover × to clear. Save icon writes the first empty slot, or the active one if all are filled.",
  ),
  presetsAria: L("Пресеты настроек", "Settings presets"),
  savePreset: L("Сохранить текущие настройки", "Save current settings"),
  clearPreset: (index: number) =>
    L(`Очистить пресет ${index}`, `Clear preset ${index}`),
  presetSlot: (index: number, state: "active" | "apply" | "empty") =>
    L(
      `Пресет ${index}: ${
        state === "active"
          ? "активен"
          : state === "apply"
            ? "применить"
            : "пусто — сохранить текущие настройки"
      }`,
      `Preset ${index}: ${
        state === "active"
          ? "active"
          : state === "apply"
            ? "apply"
            : "empty — save current settings"
      }`,
    ),
  panelSettings: L("Настройки панели", "Panel Settings"),
  dockScene: L("Панель сцены", "Scene panel"),
  dockTimeline: L("Таймлайн", "Timeline"),
  dockReset: L("Сброс", "Reset"),
  dockCopy: L("Копировать", "Copy"),
  dockSearch: L("Поиск", "Search"),
  dockChangedOnly: L("Только изменённые", "Changed only"),
  dockShowAll: L("Все параметры", "All parameters"),
  language: L("Язык", "Language"),
  theme: L("Тема", "Theme"),
  panelFont: L("Шрифт", "Font"),
  panelFontInfo: L(
    "Семейство интерфейса панели, не сцены. Geist уже в проекте; остальные — шрифты системы, без отдельных файлов.",
    "Typeface of the panel UI, not the scene. Geist is already in the project; the rest are OS fonts, no extra files.",
  ),
  fontGeist: L("Geist", "Geist"),
  fontSystem: L("SF Pro", "SF Pro"),
  fontHelvetica: L("Helvetica Neue", "Helvetica Neue"),
  fontGeorgia: L("Georgia", "Georgia"),
  chromeLayout: L("Положение", "Position"),
  resetChromeLayout: L("Сбросить", "Reset"),
  version: L("Версия", "Version"),
  hotkeys: L("Хоткеи", "Hotkeys"),
  shortcutHideDock: L("Скрыть бар", "Hide dock"),
  shortcutUndo: L("Отменить", "Undo"),
  shortcutRedo: L("Вернуть", "Redo"),
  resizePanelWidth: L("Изменить ширину панели", "Resize panel width"),
  resizePanelHeight: L("Изменить высоту панели", "Resize panel height"),
  resizePanelCorner: L("Изменить размер панели", "Resize panel"),
  movePanel: L("Переместить панель", "Move panel"),
  pinSection: L("Закрепить секцию", "Pin section"),
  unpinSection: L("Открепить секцию", "Unpin section"),
  bezierCurve: L("Кривая Безье", "Bezier curve"),
  axisCurve: L("Ось", "Axis"),
  easingCurves: L("Кривые", "Curves"),
  bezierPreset: L("Пресет кривой", "Bezier preset"),
  copyBezier: L("Скопировать кривую", "Copy curve"),
  on: L("Вкл", "On"),
  off: L("Выкл", "Off"),
  show: L("Показать", "Show"),
  hide: L("Скрыть", "Hide"),
  visibility: L("Показ", "Visibility"),
  opacity: L("прозрачность", "opacity"),
  rangeMin: L("min", "min"),
  rangeMax: L("max", "max"),
  resetDefault: L("Вернуть дефолт", "Restore default"),
  sectionIcon: L("Иконка", "Icon"),
  copyIcon: (label: string, name: string) =>
    L(`Иконка · ${label}: ${name}`, `Icon · ${label}: ${name}`),
  dragSection: L("Перетащить секцию", "Drag section"),
  drag: L("Перетащить", "Drag"),
  collapse: (title: string) => L(`Свернуть ${title}`, `Collapse ${title}`),
  expand: (title: string) => L(`Развернуть ${title}`, `Expand ${title}`),
  collapseAll: L("Свернуть все", "Collapse all"),
  expandAll: L("Развернуть все", "Expand all"),
  openPanel: L("Открыть настройки motion", "Open motion settings"),
  openPanelChanged: (count: number) =>
    L(
      `Открыть настройки motion (изменено: ${count})`,
      `Open motion settings (changed: ${count})`,
    ),
  closePanel: L("Закрыть настройки motion", "Close motion settings"),
  openPanelSettings: L("Открыть настройки панели", "Open Panel Settings"),
  closePanelSettings: L("Закрыть настройки панели", "Close Panel Settings"),
  openBezier: L("Открыть кривую Безье", "Open Bezier curve"),
  closeBezier: L("Закрыть кривую Безье", "Close Bezier curve"),
  spring: L("Пружина", "Spring"),
  openSpring: L("Открыть пружину", "Open spring"),
  closeSpring: L("Закрыть пружину", "Close spring"),
  openAxis: L("Открыть ось", "Open axis"),
  closeAxis: L("Закрыть ось", "Close axis"),
  resetSettings: (count: number) =>
    L(
      `Сбросить настройки motion (изменено: ${count})`,
      `Reset motion settings (changed: ${count})`,
    ),
  copyDefaults: (count: number) =>
    L(
      `Скопировать новые дефолты (изменено: ${count})`,
      `Copy new defaults (changed: ${count})`,
    ),
  copyDefaultsDone: L("Новые дефолты скопированы", "New defaults copied"),
  copyDefaultsHeader: L(
    "Установить новые значения по умолчанию",
    "Set new default values",
  ),
  copyDefaultsAgentHeader: (label: string, n: number, m: number) =>
    L(
      `Новые значения по умолчанию · ${label} · изменено ${n} из ${m}`,
      `New defaults · ${label} · ${n} of ${m} changed`,
    ),
  copyDefaultsIcons: L("Иконки", "Icons"),
  copyDefaultsAgentFooter: L(
    "Впиши эти значения в DEFAULTS сцены как новые значения по умолчанию.",
    "Write these values into the scene DEFAULTS as the new default values.",
  ),
  playerMode: L("Режим", "Mode"),
  player: L("Плеер", "Player"),
  phases: L("Элементы", "Elements"),
  back: L("Назад", "Back"),
  freeze: L("Стоп-кадр", "Freeze frame"),
  play: L("Пуск", "Play"),
  forward: L("Вперёд", "Forward"),
  pin: L("Запинить момент", "Pin moment"),
  unpin: L("Снять пин", "Unpin"),
  copyMoment: L("Скопировать момент", "Copy moment"),
  copied: L("скопировано", "copied"),
  speed: (n: number) => L(`Скорость ×${n}`, `Speed ×${n}`),
  playerPosition: (label: string) =>
    L(`${label}: позиция`, `${label}: position`),
  playerPhases: (label: string) => L(`${label}: элементы`, `${label}: elements`),
  openTimeline: L("Открыть таймлайн", "Open timeline"),
  closeTimeline: L("Закрыть таймлайн", "Close timeline"),
  animationTime: L("Время анимации", "Animation time"),
  totalAuto: L("Auto", "Auto"),
  unlockTotal: L("Задать длину вручную", "Set length manually"),
  clipStart: L("старт", "start"),
  resetClip: L("Вернуть клип на место по умолчанию", "Move the clip back to its default"),
  staggerLine: L("строка", "line"),
  staggerStep: L("Шаг", "Step"),
  editCurve: L("Кривая элемента", "Edit curve"),
  timelineTarget: L("Таймлайн", "Timeline"),
  soloPhase: L("Только эта фаза", "Solo this phase"),
  clearSolo: L("Снять соло", "Clear solo"),
  openSearch: L("Найти параметр", "Find a parameter"),
  closeSearch: L("Закрыть поиск", "Close search"),
  searchField: L("Поиск параметра", "Search parameters"),
  searchPlaceholder: L("Поиск", "Search"),
  searchEmpty: L("Ничего не нашлось", "No matching parameters"),
  changedFilter: (count: number) =>
    L(`Изменено · ${count}`, `Changed · ${count}`),
  showChangedOnly: (count: number) =>
    L(
      `Показать только изменённые (${count})`,
      `Show only changed (${count})`,
    ),
  showAllRows: L("Показать все параметры", "Show all parameters"),
  undone: L("Отменено", "Undone"),
  redone: L("Возвращено", "Redone"),
  redoHint: (apple: boolean) =>
    apple
      ? L("⇧⌘Z вернуть", "⇧⌘Z redo")
      : L("Ctrl+Shift+Z вернуть", "Ctrl+Shift+Z redo"),
  undoHint: (apple: boolean) =>
    apple
      ? L("⌘Z отменить", "⌘Z undo")
      : L("Ctrl+Z отменить", "Ctrl+Z undo"),
  resetStep: L("Сброс", "Reset"),
  presetStep: (slot: number) => L(`Пресет ${slot}`, `Preset ${slot}`),
  parameters: (n: number) => {
    if (n === 1) return L("1 параметр", "1 parameter");
    const mod10 = n % 10;
    const mod100 = n % 100;
    const ru =
      mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? `${n} параметра`
        : mod10 === 1 && mod100 !== 11
          ? `${n} параметр`
          : `${n} параметров`;
    return L(ru, `${n} parameters`);
  },
  transferSettings: L("Перенос настроек", "Transfer settings"),
  copySettingsLink: L("Ссылка с настройками", "Link with settings"),
  saveSettingsFile: L("Сохранить в файл", "Save to file"),
  openSettingsFile: L("Открыть файл", "Open file"),
  linkCopied: L("Ссылка скопирована", "Link copied"),
  linkApplied: L("Из ссылки", "From link"),
  fileSaved: L("Файл сохранён", "File saved"),
  fileApplied: L("Из файла", "From file"),
  fileRejected: L("Файл не подошёл", "File not recognized"),
  noChanges: L("Всё по умолчанию", "All at defaults"),
} as const;

export const PANEL_FONT_LABEL: Record<PanelFont, LocaleText> = {
  geist: PANEL_COPY.fontGeist,
  system: PANEL_COPY.fontSystem,
  helvetica: PANEL_COPY.fontHelvetica,
  georgia: PANEL_COPY.fontGeorgia,
};

export const ANCHOR_COPY: Record<string, LocaleText> = {
  "top left": L("Верх слева", "Top left"),
  top: L("Верх", "Top"),
  "top right": L("Верх справа", "Top right"),
  left: L("Слева", "Left"),
  center: L("Центр", "Center"),
  right: L("Справа", "Right"),
  "bottom left": L("Низ слева", "Bottom left"),
  bottom: L("Низ", "Bottom"),
  "bottom right": L("Низ справа", "Bottom right"),
};

export const TEXT_ALIGN_COPY: Record<string, LocaleText> = {
  left: L("Лево", "Left"),
  center: L("Центр", "Center"),
  right: L("Право", "Right"),
  justify: L("По ширине", "Justify"),
};

export const FRAME_ORIENT_COPY: Record<string, LocaleText> = {
  square: L("Квадрат", "Square"),
  portrait: L("Вертикаль", "Portrait"),
  landscape: L("Горизонталь", "Landscape"),
};
