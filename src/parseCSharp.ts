import { LoopInfo, MethodInfo } from "./types";

/**
 * Lightweight, regex + brace-counting "parser" for C# source.
 * This is intentionally heuristic (not a real AST) - it's good enough to
 * locate method/loop boundaries and call expressions for pattern-based
 * analysis, without pulling in a full C# grammar.
 */

export function buildLineIndex(source: string): number[] {
  const offsets: number[] = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\n") offsets.push(i + 1);
  }
  return offsets;
}

export function lineOf(offsets: number[], pos: number): number {
  let lo = 0;
  let hi = offsets.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid] <= pos) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans + 1;
}

/**
 * Scans forward from the index of an opening `{` and returns the index of
 * its matching closing `}`, skipping over string/char literals and
 * comments so braces inside them don't throw off the depth count.
 * Returns -1 if no match is found (malformed/truncated source).
 */
export function findMatchingBrace(source: string, openBraceIndex: number): number {
  let depth = 0;
  let i = openBraceIndex;
  const len = source.length;
  for (; i < len; i++) {
    const ch = source[i];

    if (ch === "/" && source[i + 1] === "/") {
      const nl = source.indexOf("\n", i);
      i = nl === -1 ? len : nl;
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      i = end === -1 ? len : end + 1;
      continue;
    }
    if (ch === '"') {
      // handles both normal and verbatim (@"...") strings, including "" escapes
      i++;
      while (i < len) {
        if (source[i] === '"' && source[i + 1] === '"') {
          i += 2;
          continue;
        }
        if (source[i] === "\\" && source[i - 1] !== "@") {
          i++;
        } else if (source[i] === '"') {
          break;
        }
        i++;
      }
      continue;
    }
    if (ch === "'") {
      i++;
      while (i < len && source[i] !== "'") {
        if (source[i] === "\\") i++;
        i++;
      }
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

const CONTROL_KEYWORDS = new Set([
  "if",
  "else",
  "for",
  "foreach",
  "while",
  "switch",
  "catch",
  "try",
  "using",
  "lock",
  "fixed",
  "do",
]);

// Matches a method-like signature ending in `(...)` followed by `{`, e.g.:
//   public string GetOrderStatus(string orderId) {
//   private static List<Order> GetOrders(int accountId)\n  {
const METHOD_SIG_RE =
  /(?:public|private|protected|internal|static|virtual|override|async|sealed|new)(?:\s+(?:public|private|protected|internal|static|virtual|override|async|sealed|new))*\s+[\w<>[\],.?]+\s+([A-Za-z_]\w*)\s*\(([^;{}]*)\)\s*(?:\r?\n\s*)?\{/g;

export function extractMethods(source: string): MethodInfo[] {
  const lineIndex = buildLineIndex(source);
  const methods: MethodInfo[] = [];
  let match: RegExpExecArray | null;
  METHOD_SIG_RE.lastIndex = 0;
  while ((match = METHOD_SIG_RE.exec(source)) !== null) {
    const name = match[1];
    if (CONTROL_KEYWORDS.has(name)) continue;

    const openBraceIndex = match.index + match[0].length - 1;
    const closeBraceIndex = findMatchingBrace(source, openBraceIndex);
    if (closeBraceIndex === -1) continue;

    const bodyStartOffset = openBraceIndex + 1;
    const body = source.slice(bodyStartOffset, closeBraceIndex);

    methods.push({
      name,
      signatureLine: lineOf(lineIndex, match.index),
      bodyStartLine: lineOf(lineIndex, openBraceIndex),
      bodyEndLine: lineOf(lineIndex, closeBraceIndex),
      body,
      bodyStartOffset,
    });

    // avoid re-matching inside nested bodies we already consumed
    METHOD_SIG_RE.lastIndex = closeBraceIndex;
  }
  return methods;
}

const LOOP_RE = /\b(for|foreach|while)\s*\([^;{}]*\)\s*(?:\r?\n\s*)?\{/g;

/**
 * Finds loop blocks (for/foreach/while with a braced body) within a method
 * body. `bodyStartOffset` is the absolute offset of `methodBody[0]` in the
 * full source, so returned line numbers are absolute.
 */
export function extractLoops(
  fullSource: string,
  methodBody: string,
  methodBodyStartOffset: number
): LoopInfo[] {
  const lineIndex = buildLineIndex(fullSource);
  const loops: LoopInfo[] = [];
  let match: RegExpExecArray | null;
  LOOP_RE.lastIndex = 0;
  while ((match = LOOP_RE.exec(methodBody)) !== null) {
    const keyword = match[1] as LoopInfo["keyword"];
    const openBraceIndexInBody = match.index + match[0].length - 1;
    const absoluteOpenBraceIndex = methodBodyStartOffset + openBraceIndexInBody;
    const absoluteCloseBraceIndex = findMatchingBrace(fullSource, absoluteOpenBraceIndex);
    if (absoluteCloseBraceIndex === -1) continue;

    const bodyStartOffset = absoluteOpenBraceIndex + 1;
    const body = fullSource.slice(bodyStartOffset, absoluteCloseBraceIndex);

    loops.push({
      keyword,
      startLine: lineOf(lineIndex, match.index + methodBodyStartOffset),
      endLine: lineOf(lineIndex, absoluteCloseBraceIndex),
      body,
      bodyStartOffset,
    });

    LOOP_RE.lastIndex = absoluteCloseBraceIndex - methodBodyStartOffset;
  }
  return loops;
}

export interface CallExpr {
  /** e.g. "orderApiClient.GetOrderStatus" or "GetProductTaxRate" */
  callee: string;
  args: string;
  index: number;
}

// Top-level call expressions like `foo.Bar(x, y)` or `Baz(x)`. Does not
// handle deeply nested parens perfectly, but is good enough for spotting
// repeated calls with the same normalized argument text.
const CALL_RE = /\b([A-Za-z_][\w.]*)\s*\(([^()]*)\)/g;

export function extractCalls(text: string): CallExpr[] {
  const calls: CallExpr[] = [];
  let match: RegExpExecArray | null;
  CALL_RE.lastIndex = 0;
  while ((match = CALL_RE.exec(text)) !== null) {
    const callee = match[1];
    if (CONTROL_KEYWORDS.has(callee) || callee === "new") continue;
    calls.push({ callee, args: normalizeArgs(match[2]), index: match.index });
  }
  return calls;
}

export function normalizeArgs(args: string): string {
  return args.replace(/\s+/g, " ").trim();
}

export function lineForOffset(source: string, offset: number): number {
  return lineOf(buildLineIndex(source), offset);
}

export function snippetAround(source: string, offset: number, maxLen = 160): string {
  const lineStart = source.lastIndexOf("\n", offset) + 1;
  let lineEnd = source.indexOf("\n", offset);
  if (lineEnd === -1) lineEnd = source.length;
  const line = source.slice(lineStart, lineEnd).trim();
  return line.length > maxLen ? line.slice(0, maxLen) + "..." : line;
}
