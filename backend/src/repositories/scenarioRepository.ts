import { supabase } from "../config/supabase";
import type { CreateScenarioDTO } from "../validators/scenarioValidator";

export class ScenarioRepository {
  async findAll() {
    const { data, error } = await supabase
      .from("scenarios")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(
        `Erro ao consultar cenários: ${error.code}`
      );
    }

    return data;
  }

  async create(scenario: CreateScenarioDTO) {
    const { data, error } = await supabase
      .from("scenarios")
      .insert(scenario)
      .select()
      .single();

    if (error) {
      throw new Error(
        `Erro ao salvar cenário: ${error.code}`
      );
    }

    return data;
  }
}
