const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:4000/api";

export interface IntegrationResult {
  success: boolean;
  scenario: {
    id: string;
    name: string;
  };
  route: {
    id: string;
    path: string;
    method: string;
  };
  target: string;
  statusCode: number;
  durationMs: number;
  response: unknown;
  timestamp: string;
}

export async function checkScenarioRoute(
  scenarioId: string,
  routeId: string
): Promise<IntegrationResult> {
  const response = await fetch(
    `${API_URL}/integration/scenarios/${encodeURIComponent(scenarioId)}/routes/${encodeURIComponent(routeId)}/check`,
    {
      method: "POST",
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message ||
      "Não foi possível verificar a rota."
    );
  }

  return result as IntegrationResult;
}
