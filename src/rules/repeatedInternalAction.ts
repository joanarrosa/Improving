import { Rule, RuleContext, Finding } from "../types";
import { extractCalls, lineForOffset, snippetAround } from "../parseCSharp";
import { DB_CALL_RE, INTEGRATION_NAME_RE, CACHE_HINT_RE } from "./patterns";

const CONTROL_FLOW_CALLEES = new Set([
  "if",
  "else",
  "for",
  "foreach",
  "while",
  "switch",
  "catch",
  "try",
  "using",
  "return",
  "new",
]);

/**
 * Rule E: flags repeated calls to the same *internal* action (i.e. not an
 * integration/DB call - those are covered by rules B and A) within one
 * method, with identical arguments and no visible caching, where the
 * result could plausibly be computed once and reused.
 */
export const repeatedInternalActionRule: Rule = {
  id: "OS-CACHE-005",
  name: "Repeated internal action call",
  description:
    "The same internal action is called multiple times per request with identical input and no visible caching/reuse.",
  defaultSeverity: "low",

  analyze(ctx: RuleContext): Finding[] {
    const findings: Finding[] = [];

    for (const method of ctx.methods) {
      if (CACHE_HINT_RE.test(method.body)) continue;

      const calls = extractCalls(method.body).filter((c) => {
        if (CONTROL_FLOW_CALLEES.has(c.callee)) return false;
        if (INTEGRATION_NAME_RE.test(c.callee)) return false;
        if (new RegExp(DB_CALL_RE.source).test(`.${c.callee}(`)) return false;
        // heuristic: internal OutSystems action calls are typically simple
        // PascalCase identifiers with no dot (a local/static method call),
        // as opposed to obj.Method(...) integration/repository calls.
        return !c.callee.includes(".") && /^[A-Z]/.test(c.callee);
      });

      const seen = new Map<string, number[]>();
      for (const call of calls) {
        const key = `${call.callee}(${call.args})`;
        const offsets = seen.get(key) ?? [];
        offsets.push(call.index);
        seen.set(key, offsets);
      }

      for (const [key, offsets] of seen) {
        if (offsets.length < 2) continue;
        const [callee] = key.split("(");
        const secondOffset = method.bodyStartOffset + offsets[1];
        findings.push({
          id: `${ctx.filePath}:${secondOffset}:repeat`,
          ruleId: repeatedInternalActionRule.id,
          ruleName: repeatedInternalActionRule.name,
          severity: repeatedInternalActionRule.defaultSeverity,
          title: `Internal action "${callee}" called ${offsets.length} times with the same input`,
          file: ctx.filePath,
          line: lineForOffset(ctx.source, secondOffset),
          method: method.name,
          module: ctx.moduleName,
          screenOrAction: ctx.screenOrAction,
          explanation:
            `Inside "${method.name}", "${callee}" is invoked ${offsets.length} times with identical arguments ` +
            "and there's no visible caching. If it's a pure calculation or lookup, the repeated calls are wasted " +
            "work; if it wraps a DB/integration call internally, this compounds into a bigger cost.",
          suggestion:
            "Call it once and store the result in a local variable for reuse, or wrap it with a request-scoped " +
            "cache if it's called from multiple places.",
          snippet: snippetAround(ctx.source, secondOffset),
        });
      }
    }

    return findings;
  },
};
