import { Rule, RuleContext, Finding } from "../types";
import { lineForOffset, snippetAround } from "../parseCSharp";
import { HTTP_CLIENT_NEW_RE, TIMEOUT_CONFIG_RE, RETRY_RE } from "./patterns";

/**
 * Rule C: flags HTTP/REST/SOAP client instantiations with no visible
 * timeout configuration and no visible retry handling in the same method.
 */
export const missingTimeoutRetryRule: Rule = {
  id: "OS-TIMEOUT-003",
  name: "Missing timeout/retry on integration call",
  description:
    "An HTTP/REST/SOAP client is created without a configured timeout or any retry handling nearby.",
  defaultSeverity: "medium",

  analyze(ctx: RuleContext): Finding[] {
    const findings: Finding[] = [];

    for (const method of ctx.methods) {
      const re = new RegExp(HTTP_CLIENT_NEW_RE.source, "g");
      let match: RegExpExecArray | null;
      while ((match = re.exec(method.body)) !== null) {
        const hasTimeout = TIMEOUT_CONFIG_RE.test(method.body);
        const hasRetry = RETRY_RE.test(method.body);
        if (hasTimeout && hasRetry) continue;

        const absoluteOffset = method.bodyStartOffset + match.index;
        const missing = [!hasTimeout && "a timeout", !hasRetry && "retry handling"]
          .filter(Boolean)
          .join(" or ");

        findings.push({
          id: `${ctx.filePath}:${absoluteOffset}:timeout`,
          ruleId: missingTimeoutRetryRule.id,
          ruleName: missingTimeoutRetryRule.name,
          severity: missingTimeoutRetryRule.defaultSeverity,
          title: `Integration client created without ${missing}`,
          file: ctx.filePath,
          line: lineForOffset(ctx.source, absoluteOffset),
          method: method.name,
          module: ctx.moduleName,
          screenOrAction: ctx.screenOrAction,
          explanation:
            `"${match[1]}" is instantiated in "${method.name}" without ${missing}. ` +
            "A slow or unresponsive external API will then hang the request (or exhaust threads under load) " +
            "instead of failing fast, and a transient failure won't be retried automatically.",
          suggestion: !hasTimeout
            ? "Set an explicit timeout on the client (e.g. httpClient.Timeout = TimeSpan.FromSeconds(10)) " +
              "matched to the integration's expected latency, and add a small bounded retry (e.g. via Polly) " +
              "for transient failures."
            : "Add a small bounded retry policy (e.g. via Polly) for transient failures on this call.",
          snippet: snippetAround(ctx.source, absoluteOffset),
        });
      }
    }

    return findings;
  },
};
