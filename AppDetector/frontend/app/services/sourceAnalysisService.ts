const API = (import.meta.env.VITE_API_URL || "http://127.0.0.1:4000/api").replace(/\/$/, "");

export type SastFinding = {
  id: string;
  ruleId: string;
  severity: "Alta" | "Média" | "Baixa";
  file: string;
  line: number;
  message: string;
  solution: string;
};
export type SastRun = {
  id: string;
  createdAt: string;
  sourcePath: string;
  ruleset?: string;
  summary: { total: number; high: number; medium: number; low: number; fixedSincePrevious: number; newSincePrevious: number };
  findings: SastFinding[];
  warnings: string[];
};
export type RulesProfile = "basic" | "community";
export type RulesStatus = {
  communityInstalled: boolean;
  communityRuleFiles: number;
  languages: Record<string, number>;
  communityDownloadedAt: string | null;
};
export type SastConfig = { sourcePath: string; runs: SastRun[] };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, init);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Erro HTTP ${response.status}`);
  return data as T;
}

export function getSourceConfig(scenarioId: string) {
  return api<SastConfig>(`/sast/scenarios/${scenarioId}`);
}
export function saveSourcePath(scenarioId: string, sourcePath: string) {
  return api<{ sourcePath: string }>(`/sast/scenarios/${scenarioId}/source`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourcePath }),
  });
}
export function getSourceRules() {
  return api<RulesStatus>("/sast/rules");
}
export function runSourceScan(scenarioId: string, profile: RulesProfile) {
  return api<SastRun>(`/sast/scenarios/${scenarioId}/scan`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile }),
  });
}
