import fs from "fs";
import path from "path";
import crypto from "crypto";
import { AnalysisResult, Finding, MetricsData } from "../types";
import { rules } from "../rules";
import { walkCsFiles } from "./extract";
import { deriveModuleName, deriveScreenOrAction } from "./deriveNames";
import { extractMethods } from "../parseCSharp";
import { groupFindings, buildSummary } from "./grouping";
import { applyMetrics } from "../metrics/metricsLoader";

export function analyzeProject(
  rootDir: string,
  sourceLabel: string,
  metrics?: MetricsData
): AnalysisResult {
  const files = walkCsFiles(rootDir);
  let findings: Finding[] = [];

  for (const filePath of files) {
    const relativePath = path.relative(rootDir, filePath);
    const source = fs.readFileSync(filePath, "utf8");
    const moduleName = deriveModuleName(relativePath, source);
    const screenOrAction = deriveScreenOrAction(relativePath, source);
    const methods = extractMethods(source);

    const ctx = { filePath: relativePath, source, methods, moduleName, screenOrAction };
    for (const rule of rules) {
      findings.push(...rule.analyze(ctx));
    }
  }

  const metricsApplied = Boolean(metrics && metrics.actions?.length);
  if (metrics) {
    findings = applyMetrics(findings, metrics);
  }

  return {
    runId: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    sourceLabel,
    summary: buildSummary(findings, files.length),
    modules: groupFindings(findings),
    findings,
    metricsApplied,
  };
}
