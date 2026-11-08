import { ScenarioRepository } from "../repositories/scenarioRepository";
import type { CreateScenarioDTO } from "../validators/scenarioValidator";

export class ScenarioService {
  private repository = new ScenarioRepository();

  async listScenarios() {
    return this.repository.findAll();
  }

  async createScenario(scenario: CreateScenarioDTO) {
    return this.repository.create(scenario);
  }
}
