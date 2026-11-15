const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:4000/api";

export interface AvailableRoute {
  method: "GET" | "POST";
  path: string;
  name: string;
}

export async function discoverRoutes(
  baseUrl: string
): Promise<AvailableRoute[]> {
  const response = await fetch(
    `${API_URL}/discovery/routes`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        base_url: baseUrl,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.message ||
      "Não foi possível buscar as rotas."
    );
  }

  return data.routes.filter(
    (route: AvailableRoute) =>
      route.method === "GET" ||
      route.method === "POST"
  );
}
