import { Rule, RuleContext, Finding } from "../types";
import { lineForOffset, snippetAround } from "../parseCSharp";
import { UNBOUNDED_FETCH_RE, PAGING_HINT_RE } from "./patterns";

/**
 * Rule D: flags list/aggregate fetches that take no visible arguments and
 * whose enclosing method has no paging/filter keywords anywhere - a sign
 * the query pulls a whole, unbounded dataset.
 */
export const unboundedFetchRule: Rule = {
  id: "OS-UNBOUND-004",
  name: "Unbounded data fetch",
  description:
    "A list/aggregate fetch appears to run with no filter or paging, against what looks like an unbounded dataset.",
  defaultSeverity: "high",

  analyze(ctx: RuleContext): Finding[] {
    const findings: Finding[] = [];

    for (const method of ctx.methods) {
      if (PAGING_HINT_RE.test(method.body)) continue;

      const re = new RegExp(UNBOUNDED_FETCH_RE.source, "g");
      let match: RegExpExecArray | null;
      while ((match = re.exec(method.body)) !== null) {
        const absoluteOffset = method.bodyStartOffset + match.index;
        findings.push({
          id: `${ctx.filePath}:${absoluteOffset}:unbound`,
          ruleId: unboundedFetchRule.id,
          ruleName: unboundedFetchRule.name,
          severity: unboundedFetchRule.defaultSeverity,
          title: "Fetch with no filter or paging",
          file: ctx.filePath,
          line: lineForOffset(ctx.source, absoluteOffset),
          method: method.name,
          module: ctx.moduleName,
          screenOrAction: ctx.screenOrAction,
          explanation:
            `"${method.name}" fetches a list/aggregate with no arguments and no paging or filter keywords ` +
            "(Top/MaxRecords/PageSize/Skip/Take/Where) anywhere in the method. As the underlying table grows, " +
            "this call will pull the entire dataset into memory and over the wire every time it runs.",
          suggestion:
            "Add an explicit filter (narrow to what the screen/action actually needs) and a page size / max " +
            "records limit, and paginate on the client if the full set is genuinely needed.",
          snippet: snippetAround(ctx.source, absoluteOffset),
        });
      }
    }

    return findings;
  },
};
