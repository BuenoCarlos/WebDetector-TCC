import { supabase } from "../config/supabase";
import { RouteRepository } from "../repositories/routeRepository";
import type { CreateRouteDTO } from "../validators/routeValidator";

export class RouteService {
  private repository = new RouteRepository();

  private async ensureScenarioExists(scenarioId: string) {
    const { data, error } = await supabase
      .from("scenarios")
      .select("id")
      .eq("id", scenarioId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) {
      throw new Error("SCENARIO_NOT_FOUND");
    }
  }

  async list(scenarioId: string) {
    await this.ensureScenarioExists(scenarioId);

    return this.repository.findByScenario(scenarioId);
  }

  async create(
    scenarioId: string,
    route: CreateRouteDTO
  ) {
    await this.ensureScenarioExists(scenarioId);

    const existing = await this.repository.findByScenario(
      scenarioId
    );

    const duplicate = existing.some(
      (item) =>
        item.path === route.path &&
        item.method === route.method
    );

    if (duplicate) {
      throw new Error("ROUTE_ALREADY_EXISTS");
    }

    return this.repository.create(scenarioId, route);
  }

  async delete(
    scenarioId: string,
    routeId: string
  ) {
    await this.ensureScenarioExists(scenarioId);

    return this.repository.delete(scenarioId, routeId);
  }
}
