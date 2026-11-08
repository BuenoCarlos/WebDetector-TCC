import type {
  Request,
  Response,
  NextFunction
} from "express";

import { ScenarioService } from "../services/scenarioService";
import { createScenarioSchema } from "../validators/scenarioValidator";

const scenarioService = new ScenarioService();

export class ScenarioController {
  async index(
    _req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const scenarios = await scenarioService.listScenarios();

      res.status(200).json(scenarios);
    } catch (error) {
      next(error);
    }
  }

  async store(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const validation = createScenarioSchema.safeParse(
        req.body
      );

      if (!validation.success) {
        res.status(400).json({
          status: "error",
          message: "Dados inválidos.",
          errors: validation.error.flatten()
        });
        return;
      }

      const scenario = await scenarioService.createScenario(
        validation.data
      );

      res.status(201).json({
        status: "success",
        message: "Cenário cadastrado com sucesso!",
        data: scenario
      });
    } catch (error) {
      next(error);
    }
  }
}
