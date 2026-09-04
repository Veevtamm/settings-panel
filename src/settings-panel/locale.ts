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

export const PANEL_COPY = {
  presets: L("Пресеты", "Presets"),
  presetsInfo: L(
    "Слот хранит весь набор настроек этой страницы, не всего сайта. Пустой: клик — сохранить текущие. Сохранённый: клик — применить, ⌥-клик — перезаписать, × на ховере — очистить.",
    "A slot stores this page’s full settings, not the whole site. Empty: click to save. Saved: click to apply, ⌥-click to overwrite, hover × to clear.",
  ),
  presetsAria: L("Пресеты настроек", "Settings presets"),
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
  panelSettings: L("Panel Settings", "Panel Settings"),
  language: L("Язык", "Language"),
  theme: L("Тема", "Theme"),
  sectionOrder: L("Изменение секций", "Edit sections"),
  sectionOrderInfo: L(
    "Ручка — перетащить секцию. Пин рядом — закрепить сверху, чтобы секция не уезжала со скроллом. Клик по иконке секции, подсекции или параметра — выбрать другой глиф. Panel Settings тоже в этом списке.",
    "Grip to drag a section. Pin beside it keeps the section at the top of the scroll. Click a section, subsection, or row icon to pick another glyph. Panel Settings is in the same list.",
  ),
  resizePanelWidth: L("Изменить ширину панели", "Resize panel width"),
  resizePanelHeight: L("Изменить высоту панели", "Resize panel height"),
  resizePanelCorner: L("Изменить размер панели", "Resize panel"),
  movePanel: L("Переместить панель", "Move panel"),
  pinSection: L("Закрепить секцию", "Pin section"),
  unpinSection: L("Открепить секцию", "Unpin section"),
  bezierCurve: L("Кривая Безье", "Bezier curve"),
  easingCurves: L("Кривые", "Curves"),
  curveParams: L("Параметры кривой", "Curve parameters"),
  bezierPreset: L("Пресет кривой", "Bezier preset"),
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
  playerMode: L("Режим", "Mode"),
  player: L("Плеер", "Player"),
  phases: L("Фазы", "Phases"),
  scrollView: L("Просмотр скроллом", "Scroll view"),
  back: L("Назад", "Back"),
  freeze: L("Стоп-кадр", "Freeze frame"),
  play: L("Пуск", "Play"),
  forward: L("Вперёд", "Forward"),
  pin: L("Запинить момент", "Pin moment"),
  unpin: L("Снять пин", "Unpin"),
  copyMoment: L("Скопировать момент", "Copy moment"),
  copied: L("скопировано", "copied"),
  speed: (n: number) => L(`Скорость ×${n}`, `Speed ×${n}`),
  openPlayer: (label: string) =>
    L(`Открыть плеер ${label}`, `Open player ${label}`),
  closePlayer: (label: string) =>
    L(`Закрыть плеер ${label}`, `Close player ${label}`),
  playerPosition: (label: string) =>
    L(`${label}: позиция`, `${label}: position`),
  playerPhases: (label: string) => L(`${label}: фазы`, `${label}: phases`),
  pickPlace: L("Выбрать место на сцене", "Pick a place on the scene"),
  cancelPickPlace: L("Выключить указку", "Turn off the pointer"),
  showAllSettings: L("Показать все параметры", "Show all settings"),
  placeGone: L("Место исчезло, показаны все параметры", "Place gone — showing all settings"),
  placeEmpty: L(
    "Для текущего вида сцены у этого места нет параметров",
    "This place has no parameters in the current scene",
  ),
  parameters: (n: number) => {
    if (n === 1) return L("1 параметр", "1 parameter");
    const mod10 = n % 10;
    const mod100 = n % 100;
    const ru =
      mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? `${n} параметра`
        : `${n} параметров`;
    return L(ru, `${n} parameters`);
  },
} as const;

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
