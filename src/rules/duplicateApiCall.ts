import { Rule, RuleContext, Finding } from "../types";
import { extractCalls, lineForOffset, snippetAround } from "../parseCSharp";
import { INTEGRATION_NAME_RE } from "./patterns";

/**
 * Rule B: flags the same external integration/API call being made more
 * than once, with the same (normalized) arguments, inside one method.
 */
export const duplicateApiCallRule: Rule = {
  id: "OS-DUP-002",
  name: "Duplicate integration call",
  description:
    "The same external API/integration action is called more than once with equivalent input in the same code path.",
  defaultSeverity: "medium",

  analyze(ctx: RuleContext): Finding[] {
    const findings: Finding[] = [];

    for (const method of ctx.methods) {
      if (!INTEGRATION_NAME_RE.test(method.body) && !INTEGRATION_NAME_RE.test(ctx.filePath)) {
        continue;
      }

      const calls = extractCalls(method.body).filter(
        (c) => INTEGRATION_NAME_RE.test(c.callee) || INTEGRATION_NAME_RE.test(ctx.filePath)
      );

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
          id: `${ctx.filePath}:${secondOffset}:dup`,
          ruleId: duplicateApiCallRule.id,
          ruleName: duplicateApiCallRule.name,
          severity: duplicateApiCallRule.defaultSeverity,
          title: `Integration call "${callee}" repeated with the same input`,
          file: ctx.filePath,
          line: lineForOffset(ctx.source, secondOffset),
          method: method.name,
          module: ctx.moduleName,
          screenOrAction: ctx.screenOrAction,
          explanation:
            `Inside "${method.name}", "${callee}" is called ${offsets.length} times with the same arguments. ` +
            "Each call is a separate outbound request (extra latency, and, for metered/rate-limited external " +
            "APIs, extra cost or throttling risk) for input that was already fetched once.",
          suggestion:
            "Call it once, store the result in a local variable, and reuse that variable for the remaining " +
            "usages in this code path.",
          snippet: snippetAround(ctx.source, secondOffset),
        });
      }
    }

    return findings;
  },
};
