const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:4000/api";

export type RunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export interface RunRequest {
  id: string;
  run_id: string;
  sequence_number: number;
  route_path: string;
  method: string;
  status_code: number | null;
  success: boolean;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
}

export interface TestRun {
  id: string;
  scenario_id: string;
  route_id: string;
  status: RunStatus;
  max_requests: number;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  requests?: RunRequest[];
}

async function parseResponse(response: Response) {
  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message ||
      "Erro na comunicação com o WebDetector."
    );
  }

  return result.data;
}

export async function startRun(
  scenarioId: string,
  routeId: string
): Promise<TestRun> {
  const response = await fetch(`${API_URL}/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      scenarioId,
      routeId,
    }),
  });

  return parseResponse(response);
}

export async function getRun(
  runId: string
): Promise<TestRun> {
  const response = await fetch(
    `${API_URL}/runs/${encodeURIComponent(runId)}`
  );

  return parseResponse(response);
}

export async function listRuns(
  scenarioId: string
): Promise<TestRun[]> {
  const response = await fetch(
    `${API_URL}/runs?scenarioId=${encodeURIComponent(scenarioId)}`
  );

  return parseResponse(response);
}