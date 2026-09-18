export type Severity = "high" | "medium" | "low";

export interface MethodInfo {
  name: string;
  signatureLine: number;
  bodyStartLine: number;
  bodyEndLine: number;
  body: string;
  /** absolute offset of the first character of `body` inside the full source string */
  bodyStartOffset: number;
}

export interface LoopInfo {
  keyword: "for" | "foreach" | "while";
  startLine: number;
  endLine: number;
  body: string;
  bodyStartOffset: number;
}

export interface RuntimeMetricEntry {
  module: string;
  action: string;
  avgExecutionsPerRequest?: number;
  avgResponseTimeMs?: number;
  notes?: string;
}

export interface MetricsData {
  actions: RuntimeMetricEntry[];
}

export interface RuleContext {
  filePath: string; // relative path within the analyzed project
  source: string;
  methods: MethodInfo[];
  moduleName: string;
  screenOrAction: string;
}

export interface Finding {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: Severity;
  title: string;
  file: string;
  line: number;
  method?: string;
  module: string;
  screenOrAction: string;
  explanation: string;
  suggestion: string;
  snippet?: string;
  runtimeData?: RuntimeMetricEntry;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  defaultSeverity: Severity;
  analyze(ctx: RuleContext): Finding[];
}

export interface ScreenGroup {
  screenOrAction: string;
  findings: Finding[];
}

export interface ModuleGroup {
  module: string;
  screens: ScreenGroup[];
}

export interface AnalysisSummary {
  totalFiles: number;
  totalFindings: number;
  bySeverity: Record<Severity, number>;
  byRule: Record<string, number>;
}

export interface AnalysisResult {
  runId: string;
  generatedAt: string;
  sourceLabel: string;
  summary: AnalysisSummary;
  modules: ModuleGroup[];
  findings: Finding[];
  metricsApplied: boolean;
}
