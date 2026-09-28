import { createParamStore } from "../src/lib/param-store";
import { L } from "../src/settings-panel/locale";
import { defineParams, param, type SettingsOf } from "../src/settings-panel/params";
import type { CubicBezier } from "../src/lib/cubic-bezier";
import type { SpringConfig } from "../src/lib/spring";
import type { AxisHandle, AxisPoint } from "../src/lib/axis-curve";

/** One record per control in the AGENTS control map — the catalog to check against Panel System. */
export const P = defineParams({
  cardSize: param.number({
    label: L("Сторона", "Side"),
    info: L("Сторона карточки на сцене", "Card side on the stage"),
    default: 220,
    min: 80,
    max: 480,
    step: 1,
    unit: "px",
    scrub: true,
    layer: "layout",
  }),
  radius: param.number({
    label: L("Скругление", "Corner radius"),
    info: L("Радиус углов карточки", "Card corner radius"),
    default: 16,
    min: 0,
    max: 120,
    unit: "px",
    scrub: true,
    tickStops: [
      { value: 0, label: L("Прямо", "Sharp") },
      { value: 16, label: L("Мягко", "Soft") },
      { value: 60, label: L("Кругло", "Round") },
    ],
    layer: "layout",
  }),
  columns: param.number({
    label: L("Колонки", "Columns"),
    info: L("Сколько строк-плашек под карточкой", "How many bars under the card"),
    default: 4,
    min: 1,
    max: 8,
    stepper: true,
    layer: "layout",
  }),
  pad: param.pair({
    label: L("Отступы", "Padding"),
    info: L("Внутренние отступы карточки", "Card inner padding"),
    fields: [
      { key: "padX", default: 24, ariaLabel: L("Отступ по X", "Padding X"), icon: "padX", min: 0, max: 120 },
      { key: "padY", default: 24, ariaLabel: L("Отступ по Y", "Padding Y"), icon: "padY", min: 0, max: 120 },
    ],
    layer: "layout",
  }),
  orient: param.orient({
    label: L("Ориентация", "Orientation"),
    info: L("Квадрат, вертикаль или горизонталь", "Square, portrait or landscape"),
    default: "square",
    layer: "layout",
  }),
  anchor: param.anchor({
    label: L("Якорь", "Anchor"),
    info: L("Где карточка стоит на сцене", "Where the card sits on the stage"),
    default: "center",
    layer: "layout",
  }),
  fit: param.xAnchor({
    label: L("Фит", "Fit"),
    info: L("Выравнивание плашек по ширине", "Bar alignment across the width"),
    default: "left",
    layer: "layout",
  }),
  title: param.text({
    label: L("Заголовок", "Title"),
    info: L("Текст на карточке", "Text on the card"),
    default: "Settings panel",
    layer: "type",
  }),
  fontSize: param.number({
    label: L("Кегль", "Size"),
    info: L("Размер заголовка", "Title size"),
    default: 28,
    min: 10,
    max: 96,
    unit: "px",
    layer: "type",
  }),
  wght: param.range({
    label: L("Толщина", "Weight"),
    info: L("Толщина заголовка от и до", "Title weight range"),
    min: 100,
    max: 900,
    step: 10,
    from: { key: "wghtMin", default: 400 },
    to: { key: "wghtMax", default: 700 },
    layer: "type",
  }),
  align: param.textAlign({
    label: L("Выравнивание", "Align"),
    info: L("Выравнивание заголовка", "Title alignment"),
    default: "left",
    after: "textColor",
    layer: "type",
  }),
  mode: param.choice({
    label: L("Режим", "Mode"),
    info: L("Как картинка заполняет карточку", "How the image fills the card"),
    default: "fill",
    options: [
      { value: "fit", label: L("Вписать", "Fit") },
      { value: "fill", label: L("Заполнить", "Fill") },
      { value: "stretch", label: L("Растянуть", "Stretch") },
    ],
    layer: "layout",
  }),
  order: param.choice({
    label: L("Порядок", "Order"),
    info: L("С какой стороны идут плашки", "Which side the bars start from"),
    default: "start",
    control: "segment",
    options: [
      { value: "start", label: L("с начала", "from start"), mark: "from-start" },
      { value: "center", label: L("из центра", "from center"), mark: "from-center" },
      { value: "end", label: L("с конца", "from end"), mark: "from-end" },
    ],
    layer: "motion",
  }),
  backgroundColor: param.color({
    label: L("Фон", "Background"),
    info: L("Цвет сцены", "Stage color"),
    default: "#101014",
    layer: "color",
  }),
  cardColor: param.color({
    label: L("Карточка", "Card"),
    info: L("Цвет карточки", "Card color"),
    default: "#F2F2F2",
    opacityKey: "cardOpacity",
    layer: "color",
  }),
  cardOpacity: param.value({ default: 100, layer: "color" }),
  textColor: param.color({
    label: L("Текст", "Text"),
    info: L("Цвет заголовка", "Title color"),
    default: "#101014",
    layer: "color",
  }),
  shadow: param.toggle({
    label: L("Тень", "Shadow"),
    info: L("Мягкая тень под карточкой", "Soft shadow under the card"),
    default: true,
    layer: "color",
  }),
  cover: param.toggle({
    label: L("Картинка", "Image"),
    info: L("Картинка вписана или заполняет", "Image fits or fills"),
    default: false,
    control: "segment",
    controlWidth: 176,
    offLabel: L("Вписать", "Fit"),
    onLabel: L("Заполнить", "Fill"),
    layer: "layout",
  }),
  skipCells: param.value({ default: "", layer: "grid" }),
  showLayoutGrid: param.value({ default: false, layer: "grid" }),
  reel: param.player({
    label: L("Появление", "Appear"),
    total: { key: "reelTotalMs", default: 1400 },
    phases: [
      { key: "reelInMs", default: 500, caption: L("карточка", "card"), kind: "phase", max: 2000 },
      {
        key: "reelBarsMs",
        default: 300,
        caption: L("плашки", "bars"),
        kind: "phase",
        max: 2000,
        start: { key: "reelBarsStartMs", default: 500 },
        stagger: { count: 4, step: { key: "reelBarsStepMs", default: 80 } },
      },
    ],
    unit: "ms",
    min: 10,
    step: 10,
    layer: "timings",
  }),
  easings: param.value({
    default: {
      card: { x1: 0.22, y1: 1, x2: 0.36, y2: 1 },
      bars: { x1: 0.65, y1: 0, x2: 0.35, y2: 1 },
    } as Record<string, CubicBezier>,
    layer: "motion",
  }),
  springs: param.value({
    default: { hover: { stiffness: 170, damping: 12, mass: 1 } } as Record<string, SpringConfig>,
    layer: "motion",
  }),
  axisPoints: param.value({
    default: [
      [0, 0],
      [0.5, 0.8],
      [1, 1],
    ] as AxisPoint[],
    layer: "motion",
  }),
  axisHandles: param.value({
    default: [
      [0, 0],
      [0.15, 0],
      [0, 0],
    ] as AxisHandle[],
    layer: "motion",
  }),
});

export type PlaygroundSettings = SettingsOf<typeof P>;

export const store = createParamStore(P, { storageKey: "settings-panel-playground-settings" });
export const DEFAULTS = store.defaults;
