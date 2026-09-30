import {
  L,
  SettingCells,
  SettingChips,
  SettingSkipReplay,
  SettingStrokeJoin,
  isStrokeJoin,
  serializeSkipCells,
  tx,
  type EasingTarget,
  type SettingsGroup,
  type SpringTarget,
} from "../src";
import { P, type PlaygroundSettings as S } from "./params";

export const PANEL_ID = "playground";

export const MODULE_ROWS = 2;

export const EASING_TARGETS: readonly EasingTarget[] = [
  { id: "card", label: L("Карточка", "Card") },
  { id: "bars", label: L("Плашки", "Bars") },
];

export const SPRING_TARGETS: readonly SpringTarget[] = [
  { id: "hover", label: L("Наведение", "Hover") },
];

/** Every row is read by the card. The grid line color appears only while the overlay is on. */
export function groupsFor(settings: Pick<S, "showLayoutGrid">): SettingsGroup<S>[] {
  return [
    {
      id: "stage",
      title: L("Сцена", "Stage"),
      visibilityKey: "showLayoutGrid",
      sections: [
        {
          title: L("Сцена", "Stage"),
          untitled: true,
          colors: [
            P.backgroundColor,
            ...(settings.showLayoutGrid ? [P.gridLineColor] : []),
          ],
        },
      ],
    },
    {
      id: "card",
      title: L("Карточка", "Card"),
      sections: [
        {
          title: L("Карточка", "Card"),
          untitled: true,
          settings: [
            P.cardSize,
            { ...P.radius, after: "cardSize" },
            { ...P.cardLead, after: "shadow" },
            { ...P.strokeWidth, after: "cardLead" },
          ],
          pairs: [{ ...P.pad, after: "radius" }],
          orients: [{ ...P.orient, after: "padY" }],
          anchors: [{ ...P.anchor, after: "orient" }],
          colors: [
            { ...P.cardColor, after: "anchor" },
            { ...P.strokeColor, after: "strokeWidth" },
          ],
          toggles: [{ ...P.shadow, after: "cardColor" }],
          derived: [
            {
              id: "innerWidth",
              label: L("Ширина", "Width"),
              unit: "px",
              compute: (s) => s.cardSize - s.padX * 2,
              after: "padY",
            },
          ],
          custom: [
            {
              id: "strokeJoin",
              after: "strokeWidth",
              keys: [{ key: "strokeJoin", label: L("Тип стыка", "Join") }],
              render: ({ settings: current, onSettingsChange, rowReset, locale }) => (
                <SettingStrokeJoin
                  label={tx(L("Тип стыка", "Join"), locale)}
                  locale={locale}
                  value={isStrokeJoin(current.strokeJoin) ? current.strokeJoin : "miter"}
                  onChange={(strokeJoin) => onSettingsChange({ strokeJoin })}
                  {...rowReset("strokeJoin")}
                />
              ),
            },
          ],
        },
      ],
    },
    {
      id: "title",
      title: L("Заголовок", "Title"),
      sections: [
        {
          title: L("Заголовок", "Title"),
          untitled: true,
          texts: [P.title],
          settings: [{ ...P.fontSize, after: "title" }],
          ranges: [{ ...P.wght, after: "fontSize" }],
          textAligns: [{ ...P.align, after: "wghtMax" }],
          colors: [{ ...P.textColor, after: "align" }],
        },
      ],
    },
    {
      id: "bars",
      title: L("Плашки", "Bars"),
      sections: [
        {
          title: L("Плашки", "Bars"),
          untitled: true,
          settings: [P.columns],
          xAnchors: [{ ...P.fit, after: "columns" }],
          enums: [{ ...P.order, after: "fit" }, { ...P.barCap, after: "barsBlocks" }],
          toggles: [
            { ...P.barsFill, after: "order" },
            { ...P.barsBlocks, after: "barsFill" },
          ],
          refs: [{ ref: "fontSize", after: "columns" }],
          custom: [
            {
              id: "barGaps",
              after: "barCap",
              keys: [{ key: "barGaps", label: L("Зазоры", "Gaps") }],
              render: ({ settings: current, onSettingsChange, rowReset, locale }) => (
                <SettingChips
                  label={tx(L("Зазоры", "Gaps"), locale)}
                  min={2}
                  max={32}
                  value={current.barGaps}
                  onChange={(barGaps) => onSettingsChange({ barGaps })}
                  {...rowReset("barGaps")}
                />
              ),
            },
            {
              id: "skipCells",
              after: "barGaps",
              keys: [{ key: "skipCells", label: L("Пропуски", "Skips") }],
              render: ({ settings: current, onSettingsChange, rowReset, locale }) => (
                <SettingCells
                  label={tx(L("Пропуски", "Skips"), locale)}
                  columns={current.columns}
                  rows={MODULE_ROWS}
                  value={current.skipCells}
                  onChange={(skipCells) => onSettingsChange({ skipCells })}
                  {...rowReset("skipCells")}
                />
              ),
            },
            {
              id: "skipReplay",
              after: "skipCells",
              render: ({ settings: current, onSettingsChange, locale }) => (
                <SettingSkipReplay
                  label={tx(L("Перемешать", "Shuffle"), locale)}
                  onShuffle={() => {
                    const rows = Array.from({ length: MODULE_ROWS }, () => {
                      const cols: number[] = [];
                      for (let col = 0; col < current.columns; col++) {
                        if (Math.random() < 0.35) cols.push(col);
                      }
                      return cols;
                    });
                    onSettingsChange({ skipCells: serializeSkipCells(rows) });
                  }}
                />
              ),
            },
          ],
        },
      ],
    },
  ];
}

export const groups = groupsFor({ showLayoutGrid: true });
