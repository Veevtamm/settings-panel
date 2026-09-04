/**
 * Math in number fields: "700/2" → 350, "(3+1)*20" → 80.
 * Leading "+" is relative: "+50" → current + 50 (so "+50-20" adds 30).
 * Comma decimals accepted ("0,5"). Returns null for invalid input.
 */
export function evalNumberExpression(
  raw: string,
  current: number,
): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const relative = trimmed.startsWith("+");
  const source = relative ? trimmed.slice(1) : trimmed;
  const value = evalExpression(source.replace(/,/g, "."));
  if (value === null || !Number.isFinite(value)) return null;

  const result = relative ? current + value : value;
  return Number(result.toFixed(6));
}

/** Recursive-descent parser for + - * / ( ) and decimal numbers. */
function evalExpression(source: string): number | null {
  let pos = 0;

  function skipSpaces() {
    while (pos < source.length && source[pos] === " ") pos += 1;
  }

  function parseExpr(): number | null {
    let left = parseTerm();
    if (left === null) return null;
    for (;;) {
      skipSpaces();
      const op = source[pos];
      if (op !== "+" && op !== "-") return left;
      pos += 1;
      const right = parseTerm();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
    }
  }

  function parseTerm(): number | null {
    let left = parseFactor();
    if (left === null) return null;
    for (;;) {
      skipSpaces();
      const op = source[pos];
      if (op !== "*" && op !== "/") return left;
      pos += 1;
      const right = parseFactor();
      if (right === null) return null;
      left = op === "*" ? left * right : left / right;
    }
  }

  function parseFactor(): number | null {
    skipSpaces();
    const ch = source[pos];
    if (ch === "-" || ch === "+") {
      pos += 1;
      const inner = parseFactor();
      return inner === null ? null : ch === "-" ? -inner : inner;
    }
    if (ch === "(") {
      pos += 1;
      const inner = parseExpr();
      skipSpaces();
      if (inner === null || source[pos] !== ")") return null;
      pos += 1;
      return inner;
    }
    const match = /^\d*\.?\d+/.exec(source.slice(pos));
    if (!match) return null;
    pos += match[0].length;
    return Number(match[0]);
  }

  const result = parseExpr();
  skipSpaces();
  return pos === source.length ? result : null;
}
