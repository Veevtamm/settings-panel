declare module "stageshow-kit/act" {
  export interface Act<S> {
    wait(ms: number): Promise<void>;
    click(to: { at: string; x: number; y: number }): Promise<void>;
    put(patch: Partial<S>): void;
    move(to: string): Promise<void>;
  }
}

declare module "stageshow-kit/motion" {
  import type { ReactNode } from "react";
  export function Connector(props: {
    show: boolean;
    route?: "step";
    from: { x: number; y: number };
    to: { x: number; y: number };
  }): ReactNode;
  export function Roll(props: { children: string }): ReactNode;
}

declare module "stageshow-kit/stage" {
  import type { ReactNode } from "react";
  import type { Act } from "stageshow-kit/act";
  type Rect = { x: number; y: number; width: number; height: number };
  export function Stage<S extends object>(props: {
    width: number;
    height: number;
    compact?: { below: number; width: number; height: number };
    initial?: S;
    poster?: S;
    script?: (act: Act<S>) => Promise<void>;
    play?: "once";
    theme?: "dark";
    cursor?: {
      at: {
        wide: { x: number; y: number };
        compact: { x: number; y: number };
      };
    };
    tokens?: { [token: `--ss-${string}`]: string };
    className?: string;
    children: (state: S, rect: (name: string) => Rect, layout: "wide" | "compact") => ReactNode;
  }): ReactNode;
}

declare module "stageshow-kit/window" {
  import type { ReactNode } from "react";
  export function Bar(props: { w: number; h?: number; r?: number; tone?: 1 | 2 | 3 | 4 | 5 }): ReactNode;
  export function Text(props: { children: string; className?: string }): ReactNode;
}
