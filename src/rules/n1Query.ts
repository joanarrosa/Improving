import { Rule, RuleContext, Finding } from "../types";
import { extractLoops, lineForOffset, snippetAround } from "../parseCSharp";
import { DB_CALL_RE } from "./patterns";

/**
 * Rule A: flags database/aggregate/entity-action calls that appear inside
 * a for/foreach/while loop body - the classic N+1 query pattern.
 */
export const n1QueryRule: Rule = {
  id: "OS-N1-001",
  name: "N+1 query in loop",
  description:
    "A database query, Aggregate, or entity CRUD action is invoked once per loop iteration instead of once, up front.",
  defaultSeverity: "high",

  analyze(ctx: RuleContext): Finding[] {
    const findings: Finding[] = [];

    for (const method of ctx.methods) {
      const loops = extractLoops(ctx.source, method.body, method.bodyStartOffset);
      for (const loop of loops) {
        const re = new RegExp(DB_CALL_RE.source, "g");
        let match: RegExpExecArray | null;
        while ((match = re.exec(loop.body)) !== null) {
          const absoluteOffset = loop.bodyStartOffset + match.index;
          findings.push({
            id: `${ctx.filePath}:${absoluteOffset}:n1`,
            ruleId: n1QueryRule.id,
            ruleName: n1QueryRule.name,
            severity: n1QueryRule.defaultSeverity,
            title: "Database call executed inside a loop (N+1 pattern)",
            file: ctx.filePath,
            line: lineForOffset(ctx.source, absoluteOffset),
            method: method.name,
            module: ctx.moduleName,
            screenOrAction: ctx.screenOrAction,
            explanation:
              `Inside "${method.name}", a query/aggregate/entity call runs on every iteration of a ${loop.keyword} loop. ` +
              "For N records this issues N round-trips to the database (or N+1 counting an initial fetch), which scales " +
              "badly and is a very common source of slow OutSystems screens and timers.",
            suggestion:
              "Hoist the call out of the loop: fetch all the records you need in a single Aggregate/Query " +
              "(e.g. filter with 'WHERE Id IN (list)' or an equivalent bulk condition) before the loop, then look " +
              "up each record from an in-memory dictionary inside the loop.",
            snippet: snippetAround(ctx.source, absoluteOffset),
          });
        }
      }
    }

    return findings;
  },
};
