const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:4000/api";

export interface ScenarioRoute {
  id: string;
  scenario_id: string;
  path: string;
  method: "GET" | "POST";
  enabled: boolean;
  created_at: string;
}

export interface CreateRouteDTO {
  path: string;
  method: "GET" | "POST";
  enabled: boolean;
}

async function handleResponse(response: Response) {
  if (response.status === 204) {
    return null;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || data.error ||
      "Erro na comunicação com a API."
    );
  }

  return data;
}

export async function listScenarioRoutes(
  scenarioId: string
): Promise<ScenarioRoute[]> {
  const response = await fetch(
    `${API_URL}/scenarios/${scenarioId}/routes`
  );

  return handleResponse(response);
}

export async function createScenarioRoute(
  scenarioId: string,
  route: CreateRouteDTO
): Promise<ScenarioRoute> {
  const response = await fetch(
    `${API_URL}/scenarios/${scenarioId}/routes`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(route)
    }
  );

  const result = await handleResponse(response);
  return result.data;
}

export async function deleteScenarioRoute(
  scenarioId: string,
  routeId: string
): Promise<void> {
  const response = await fetch(
    `${API_URL}/scenarios/${scenarioId}/routes/${routeId}`,
    {
      method: "DELETE"
    }
  );

  await handleResponse(response);
}
