import {
  L,
  LAYER_GROUP_TITLES,
  SettingCells,
  rowsOf,
  type EasingTarget,
  type SettingsGroup,
  type SpringTarget,
} from "../src";
import { P, type PlaygroundSettings as S } from "./params";

export const PANEL_ID = "playground";

export const EASING_TARGETS: readonly EasingTarget[] = [
  { id: "card", label: L("Карточка", "Card") },
  { id: "bars", label: L("Плашки", "Bars") },
];

export const SPRING_TARGETS: readonly SpringTarget[] = [
  { id: "hover", label: L("Наведение", "Hover") },
];

export const groups: SettingsGroup<S>[] = [
  {
    id: "layout",
    title: LAYER_GROUP_TITLES.layout,
    icon: "layout-grid",
    sections: [
      { title: L("Карточка", "Card"), ...rowsOf(P, ["cardSize", "radius", "pad", "orient", "anchor"]) },
      {
        title: L("Плашки", "Bars"),
        ...rowsOf(P, ["columns", "fit", "mode", "cover"]),
        refs: [{ ref: "fontSize" }],
        derived: [
          {
            id: "barsWidth",
            label: L("Ширина плашек", "Bars width"),
            unit: "px",
            compute: (s) => s.cardSize - s.padX * 2,
            after: "columns",
          },
        ],
      },
    ],
  },
  {
    id: "type",
    title: LAYER_GROUP_TITLES.type,
    icon: "type",
    sections: [{ title: L("Заголовок", "Title"), ...rowsOf(P, ["title", "fontSize", "wght"]) }],
  },
  {
    id: "color",
    title: LAYER_GROUP_TITLES.color,
    icon: "palette",
    sections: [
      {
        title: L("Цвет", "Color"),
        untitled: true,
        ...rowsOf(P, ["backgroundColor", "cardColor", "textColor", "align", "shadow"]),
      },
    ],
  },
  {
    id: "motion",
    title: LAYER_GROUP_TITLES.motion,
    icon: "activity",
    sections: [{ title: L("Плашки", "Bars"), ...rowsOf(P, ["order"]) }],
  },
  {
    id: "grid",
    title: LAYER_GROUP_TITLES.grid,
    icon: "columns-3",
    visibilityKey: "showLayoutGrid",
    sections: [
      {
        title: L("Сетка", "Grid"),
        untitled: true,
        custom: [
          {
            id: "skipCells",
            render: ({ settings, onSettingsChange, rowReset }) => (
              <SettingCells
                label="Пропуски"
                columns={settings.columns}
                value={settings.skipCells}
                onChange={(skipCells) => onSettingsChange({ skipCells })}
                {...rowReset("skipCells")}
              />
            ),
            keys: [{ key: "skipCells", label: L("Пропуски", "Skips") }],
          },
        ],
      },
    ],
  },
];
