import { Finding, MetricsData, RuntimeMetricEntry } from "../types";

/**
 * Phase-2 extension point: static findings from this tool can be enriched
 * with runtime data pulled later from Service Center/LifeTime (not built
 * here yet). For now, this just merges an optional metrics.json the user
 * supplies by hand.
 *
 * Expected shape:
 * {
 *   "actions": [
 *     { "module": "OrderIntegrationModule", "action": "SyncOrderStatus",
 *       "avgExecutionsPerRequest": 42, "avgResponseTimeMs": 850 }
 *   ]
 * }
 *
 * Matching is by (module, action==screenOrAction). When a match is found
 * with a high avgExecutionsPerRequest, low/medium severity findings for
 * that action are bumped to reflect that the pattern is confirmed to run
 * hot at runtime, not just present in the code.
 */
const HOT_EXECUTION_THRESHOLD = 5;

export function parseMetricsJson(raw: string): MetricsData {
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.actions)) {
    throw new Error('metrics.json must have the shape { "actions": [...] }');
  }
  return parsed as MetricsData;
}

function findEntry(metrics: MetricsData, module: string, action: string): RuntimeMetricEntry | undefined {
  return metrics.actions.find((entry) => entry.module === module && entry.action === action);
}

export function applyMetrics(findings: Finding[], metrics: MetricsData): Finding[] {
  return findings.map((finding) => {
    const entry = findEntry(metrics, finding.module, finding.screenOrAction);
    if (!entry) return finding;

    const shouldEscalate =
      finding.severity !== "high" &&
      (entry.avgExecutionsPerRequest ?? 0) >= HOT_EXECUTION_THRESHOLD;

    return {
      ...finding,
      runtimeData: entry,
      severity: shouldEscalate ? "high" : finding.severity,
    };
  });
}
