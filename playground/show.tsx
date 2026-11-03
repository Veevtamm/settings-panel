import { useEffect } from "react";
import type { Act } from "stageshow-kit/act";
import { Connector, Roll } from "stageshow-kit/motion";
import { Stage } from "stageshow-kit/stage";
import { Bar, Text } from "stageshow-kit/window";
import { SfSymbol } from "../src/sf-symbol";
import "./show.css";

// A still of the playground: the card on the dark scene, the panel in the
// empty margin. Beats: the cursor picks a swatch; the card and the hex take
// that color; a leader draws from the swatch row to the card. Plays once.
// The still is the payoff. Narrow: the panel sits above the card, no leader.

type Shot = { accent: number; linked: boolean };

const SWATCHES = ["#F2F2F2", "#F0B429", "#E07A5F", "#8FBF9F"] as const;

const initial: Shot = { accent: 0, linked: false };
const poster: Shot = { accent: 1, linked: true };

async function script(a: Act<Shot>) {
  await a.wait(1000);
  await a.click({ at: "swatch-1", x: 0.5, y: 0.5 });
  a.put({ accent: 1 });
  await a.wait(500);
  a.put({ linked: true });
  await a.move("rest");
  await a.wait(2600);
}

export function ShowPage() {
  useEffect(() => {
    const prev = document.title;
    document.title = "settings-panel · кадр";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="show-page">
      <Stage
        width={680}
        height={440}
        compact={{ below: 600, width: 358, height: 640 }}
        initial={initial}
        poster={poster}
        script={script}
        play="once"
        theme="dark"
        cursor={{
          at: {
            wide: { x: 640, y: 400 },
            compact: { x: 320, y: 580 },
          },
        }}
        tokens={{
          "--ss-font": '"Geist", ui-sans-serif, system-ui, sans-serif',
          "--ss-mono": '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
        className="show"
      >
        {(s, rect, layout) => {
          const color = SWATCHES[s.accent] ?? SWATCHES[0];
          const panel = rect("panel");
          const swatch = rect(`swatch-${s.accent}`);
          const card = rect("card");
          return (
            <>
              <div className="show-card" data-target="card" style={{ background: color }}>
                <Text className="show-title">Settings panel</Text>
                <div className="show-bars" aria-hidden>
                  <span style={{ width: "86%" }} />
                  <span style={{ width: "64%" }} />
                  <span style={{ width: "92%" }} />
                  <span style={{ width: "48%" }} />
                </div>
                <div className="show-cells" aria-hidden>
                  {Array.from({ length: 48 }, (_, i) => (
                    <span key={i} />
                  ))}
                </div>
              </div>

              <span className="show-rest" data-target="rest" />

              <div className="show-tool">
                <div className="show-dock" aria-hidden>
                  <span className="show-dock-btn">
                    <SfSymbol name="settings" />
                  </span>
                  <span className="show-dock-btn" data-on="">
                    <SfSymbol name="sliders-horizontal" />
                  </span>
                  <span className="show-dock-btn">
                    <SfSymbol name="search" />
                  </span>
                </div>

                <section className="show-panel" data-target="panel">
                  <div className="show-row" data-target="color-row">
                    <Text className="show-label">Карточка</Text>
                    <span className="show-hex">
                      <span className="show-chip" style={{ background: color }} />
                      <Roll>{color}</Roll>
                    </span>
                  </div>
                  <div className="show-swatches">
                    {SWATCHES.map((hex, i) => (
                      <span
                        key={hex}
                        className="show-swatch"
                        data-target={`swatch-${i}`}
                        data-cursor="pointer"
                        data-on={i === s.accent || undefined}
                        style={{ background: hex }}
                      />
                    ))}
                  </div>
                  <div className="show-quiet">
                    <Bar w={72} h={8} r={4} tone={3} />
                    <Bar w={64} h={22} r={6} tone={2} />
                  </div>
                  <div className="show-quiet">
                    <Bar w={48} h={8} r={4} tone={4} />
                    <Bar w={86} h={22} r={6} tone={2} />
                  </div>
                </section>
              </div>

              {layout !== "compact" && panel.width > 0 && card.width > 0 && swatch.width > 0 && (
                <Connector
                  show={s.linked}
                  route="step"
                  from={{ x: panel.x - 8, y: swatch.y + swatch.height / 2 }}
                  to={{ x: card.x + card.width + 8, y: card.y + 132 }}
                />
              )}
            </>
          );
        }}
      </Stage>
    </div>
  );
}
