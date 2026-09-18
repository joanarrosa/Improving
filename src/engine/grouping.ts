import { Finding, ModuleGroup, AnalysisSummary, Severity } from "../types";

export function groupFindings(findings: Finding[]): ModuleGroup[] {
  const moduleMap = new Map<string, Map<string, Finding[]>>();

  for (const finding of findings) {
    if (!moduleMap.has(finding.module)) moduleMap.set(finding.module, new Map());
    const screenMap = moduleMap.get(finding.module)!;
    if (!screenMap.has(finding.screenOrAction)) screenMap.set(finding.screenOrAction, []);
    screenMap.get(finding.screenOrAction)!.push(finding);
  }

  const severityRank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  const modules: ModuleGroup[] = [];

  for (const [module, screenMap] of [...moduleMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const screens = [...screenMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([screenOrAction, screenFindings]) => ({
        screenOrAction,
        findings: screenFindings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]),
      }));
    modules.push({ module, screens });
  }

  return modules;
}

export function buildSummary(findings: Finding[], totalFiles: number): AnalysisSummary {
  const bySeverity: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
  const byRule: Record<string, number> = {};

  for (const finding of findings) {
    bySeverity[finding.severity]++;
    byRule[finding.ruleId] = (byRule[finding.ruleId] ?? 0) + 1;
  }

  return {
    totalFiles,
    totalFindings: findings.length,
    bySeverity,
    byRule,
  };
}
