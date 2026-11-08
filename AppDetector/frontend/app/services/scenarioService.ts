const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:4000/api";

export type AttackType =
  | "SQL Injection"
  | "XSS"
  | "Brute Force";

export interface ScenarioDefenses {
  sql_injection: boolean;
  xss: boolean;
  brute_force: boolean;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  base_url: string;
  attack_types: AttackType[];
  defenses: ScenarioDefenses;
  created_at: string;
  max_requests: number;
  duration_seconds: number;
  interval_ms: number;
  request_timeout_ms: number;
}

export interface CreateScenarioDTO {
  name: string;
  description: string;
  base_url: string;
  attack_types: AttackType[];
  defenses: ScenarioDefenses;
  max_requests: number;
  duration_seconds: number;
  interval_ms: number;
  request_timeout_ms: number;
}

async function parseResponse(response: Response) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || data.error || "Erro na comunicação com a API."
    );
  }

  return data;
}

export async function listScenarios(): Promise<Scenario[]> {
  const response = await fetch(`${API_URL}/scenarios`);
  return parseResponse(response);
}

export async function createScenario(
  scenario: CreateScenarioDTO
): Promise<Scenario> {
  const response = await fetch(`${API_URL}/scenarios`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(scenario),
  });

  const result = await parseResponse(response);
  return result.data;
}
