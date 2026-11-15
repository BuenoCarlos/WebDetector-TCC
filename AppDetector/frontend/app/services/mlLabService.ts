const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:4000/api";

export type RequestEvidence = {
  method: string;
  path: string;
  query: Record<string, unknown>;
  body: Record<string, unknown> | null;
  is_auth: boolean;
  test_kind: string;
  note: string;
};

export type MlEvent = {
  id: string;
  sequence_number: number;
  expected_label: string;
  predicted_label: string | null;
  severity: string | null;
  confidence: number | null;
  algorithm: string | null;
  reasons: string[];
  method: string;
  request_path: string;
  request_evidence: RequestEvidence | null;
  status_code: number | null;
  duration_ms: number | null;
  error_message: string | null;
};

export type MlRun = {
  id: string;
  status: string;
  created_at: string;
  events: MlEvent[];
};

async function parseRun(response: Response): Promise<MlRun> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Erro na execução ML");
  return data.data as MlRun;
}

export async function executeMlScenario(scenarioId: string): Promise<MlRun> {
  return parseRun(await fetch(
    `${API_URL}/ml-lab/scenarios/${encodeURIComponent(scenarioId)}/run`,
    { method: "POST" }
  ));
}

export async function getMlRun(runId: string): Promise<MlRun> {
  return parseRun(await fetch(`${API_URL}/ml-lab/runs/${encodeURIComponent(runId)}`));
}
