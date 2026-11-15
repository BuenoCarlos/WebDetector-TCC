import { supabase } from "../config/supabase";
import { ScenarioRepository } from "../repositories/scenarioRepository";
import type { CreateScenarioDTO } from "../validators/scenarioValidator";

export class ScenarioService {
  private repository = new ScenarioRepository();

  async listScenarios() {
    return this.repository.findAll();
  }

  async createScenario(input: CreateScenarioDTO) {
    const { routes, ...scenarioData } = input;

    const base = new URL(scenarioData.base_url);
    if (!["localhost", "127.0.0.1"].includes(base.hostname) ||
        base.protocol !== "http:" || !base.port || base.pathname !== "/" ||
        base.search || base.hash || base.username || base.password) {
      throw new Error("Destino local inválido.");
    }
    base.hostname = "127.0.0.1";
    let paths: Record<string, unknown> | null = null;
    for (const docPath of ["/openapi.json", "/swagger.json", "/api-docs.json", "/api/openapi.json"]) {
      try {
        const response = await fetch(new URL(docPath, base), {
          redirect: "error", signal: AbortSignal.timeout(3000),
        });
        if (!response.ok) continue;
        const spec: unknown = await response.json();
        if (spec && typeof spec === "object" && "paths" in spec &&
            spec.paths && typeof spec.paths === "object") {
          paths = spec.paths as Record<string, unknown>;
          break;
        }
      } catch { }
    }
    if (!paths) throw new Error("A aplicação local não disponibiliza um OpenAPI válido.");
    for (const route of routes) {
      const item = paths[route.path];
      const operation = item && typeof item === "object"
        ? (item as Record<string, unknown>)[route.method.toLowerCase()]
        : undefined;
      if (!operation || typeof operation !== "object") {
        throw new Error(`Rota não existe no OpenAPI: ${route.method} ${route.path}`);
      }
      if (route.method === "POST" &&
          (operation as Record<string, unknown>)["x-webdetector-safe-to-test"] !== true) {
        throw new Error(`POST ${route.path} não está autorizado para o laboratório no OpenAPI.`);
      }
    }

    const scenario = await this.repository.create(scenarioData as CreateScenarioDTO);
    try {
      const { error } = await supabase.from("scenario_routes").insert(
        routes.map(route => ({
          scenario_id: scenario.id,
          path: route.path,
          method: route.method,
          enabled: true,
        }))
      );
      if (error) throw error;
    } catch (error) {
      const { error: rollbackError } = await supabase.from("scenarios")
        .delete().eq("id", scenario.id);
      if (rollbackError) {
        throw new Error(`Falha ao salvar rotas e reverter cenário: ${rollbackError.message}`);
      }
      throw error;
    }
    return { ...scenario, routes };
  }
}