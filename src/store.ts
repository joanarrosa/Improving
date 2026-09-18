import { AnalysisResult } from "./types";

/**
 * In-memory run store. This is a local, single-user dev tool - state
 * lives only for the lifetime of the server process, which matches the
 * "one run at a time, no persistence needed" workflow this is built for.
 */
const runs = new Map<string, AnalysisResult>();

export function saveRun(result: AnalysisResult): void {
  runs.set(result.runId, result);
}

export function getRun(runId: string): AnalysisResult | undefined {
  return runs.get(runId);
}
