import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = decodeURIComponent(new URL("..", import.meta.url).pathname);

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...tsxFiles(path));
    else if (name.endsWith(".tsx")) out.push(path);
  }
  return out;
}

/** Tailwind arbitrary hex: `bg-[#fff]`, `text-[#ff4d4d]`. A role token has no hex in the class. */
const ARBITRARY_HEX = /\[#[0-9a-fA-F]{3,8}\b/;

/**
 * Palette utilities name a pigment (`bg-red-500`). Black and white are the
 * ink and paper roles of the new chrome, so they stay legal.
 */
const PALETTE =
  /(?:bg|text|border|fill|stroke|outline|from|to|via|caret|accent|inset-ring)-(?!(?:black|white|transparent|current|inherit)\b)(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)(?:-\d{2,3})?\b/;

describe("chrome color roles", () => {
  it("keeps raw pigments out of component classes", () => {
    const hits: string[] = [];
    for (const file of [...tsxFiles(join(root, "src")), ...tsxFiles(join(root, "playground"))]) {
      const text = readFileSync(file, "utf8");
      const lines = text.split("\n");
      lines.forEach((line: string, index: number) => {
        if (ARBITRARY_HEX.test(line) || PALETTE.test(line)) {
          hits.push(`${relative(root, file)}:${index + 1}: ${line.trim()}`);
        }
      });
    }
    expect(hits).toEqual([]);
  });
});
