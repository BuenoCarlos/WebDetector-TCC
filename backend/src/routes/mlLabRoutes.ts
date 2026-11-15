import { Router } from "express";
import { z } from "zod";

import { MlLabService } from "../services/mlLabService";

const router = Router();

const service = new MlLabService();

const uuidSchema = z.string().uuid();


router.post(
  "/ml-lab/scenarios/:scenarioId/run",
  async (req, res) => {
    const validation = uuidSchema.safeParse(
      req.params.scenarioId
    );

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "ID de cenário inválido.",
      });
      return;
    }

    try {
      const result = await service.executeScenario(
        validation.data
      );

      res.json({
        success: true,
        data: result,
      });

    } catch (error) {
      console.error("[ML LAB]", error);

      res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Erro na execução ML.",
      });
    }
  }
);


router.get(
  "/ml-lab/runs/:runId",
  async (req, res) => {
    const validation = uuidSchema.safeParse(
      req.params.runId
    );

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "ID da execução inválido.",
      });
      return;
    }

    try {
      const result = await service.getRun(
        validation.data
      );

      res.json({
        success: true,
        data: result,
      });

    } catch (error) {
      res.status(404).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Execução não encontrada.",
      });
    }
  }
);

export default router;
