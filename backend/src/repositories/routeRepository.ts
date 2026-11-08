import { supabase } from "../config/supabase";
import type { CreateRouteDTO } from "../validators/routeValidator";

export class RouteRepository {
  async findByScenario(scenarioId: string) {
    const { data, error } = await supabase
      .from("scenario_routes")
      .select("*")
      .eq("scenario_id", scenarioId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    return data;
  }

  async create(
    scenarioId: string,
    route: CreateRouteDTO
  ) {
    const { data, error } = await supabase
      .from("scenario_routes")
      .insert({
        scenario_id: scenarioId,
        ...route,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return data;
  }

  async delete(
    scenarioId: string,
    routeId: string
  ) {
    const { data, error } = await supabase
      .from("scenario_routes")
      .delete()
      .eq("scenario_id", scenarioId)
      .eq("id", routeId)
      .select("id");

    if (error) throw new Error(error.message);

    return data.length > 0;
  }
}
