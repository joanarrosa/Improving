import { AnalysisResult, Finding, Severity } from "../types";

const SEVERITY_BADGE: Record<Severity, string> = {
  high: "🔴 HIGH",
  medium: "🟠 MEDIUM",
  low: "🟡 LOW",
};

function renderFinding(f: Finding): string {
  const lines = [
    `#### ${SEVERITY_BADGE[f.severity]} — ${f.title}`,
    "",
    `- **Rule:** ${f.ruleId} (${f.ruleName})`,
    `- **Location:** \`${f.file}:${f.line}\`${f.method ? ` in \`${f.method}\`` : ""}`,
    `- **Why it's a problem:** ${f.explanation}`,
    `- **Suggested fix:** ${f.suggestion}`,
  ];
  if (f.snippet) lines.push(`- **Code:** \`${f.snippet}\``);
  if (f.runtimeData) {
    const rd = f.runtimeData;
    lines.push(
      `- **Runtime data:** ${rd.avgExecutionsPerRequest ?? "?"} avg executions/request, ` +
        `${rd.avgResponseTimeMs ?? "?"}ms avg response time`
    );
  }
  return lines.join("\n");
}

export function renderMarkdownReport(result: AnalysisResult): string {
  const out: string[] = [];
  out.push(`# OutSystems Performance Analysis Report`);
  out.push("");
  out.push(`**Source:** ${result.sourceLabel}  `);
  out.push(`**Generated:** ${result.generatedAt}  `);
  out.push(`**Files analyzed:** ${result.summary.totalFiles}  `);
  out.push(`**Total findings:** ${result.summary.totalFindings}`);
  out.push("");
  out.push(
    `| High | Medium | Low |`,
    `|---|---|---|`,
    `| ${result.summary.bySeverity.high} | ${result.summary.bySeverity.medium} | ${result.summary.bySeverity.low} |`
  );
  out.push("");

  if (result.metricsApplied) {
    out.push("> Runtime metrics (metrics.json) were merged into this report; some severities were adjusted.");
    out.push("");
  }

  if (result.modules.length === 0) {
    out.push("No findings. 🎉");
    return out.join("\n");
  }

  for (const module of result.modules) {
    out.push(`## Module: ${module.module}`);
    out.push("");
    for (const screen of module.screens) {
      out.push(`### ${screen.screenOrAction}`);
      out.push("");
      for (const finding of screen.findings) {
        out.push(renderFinding(finding));
        out.push("");
      }
    }
  }

  return out.join("\n");
}
