import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { z } from "zod";
import { RunService } from "../services/runService";

const service = new RunService();

const idSchema = z.string().uuid();

const startSchema = z.object({
  scenarioId: idSchema,
  routeId: idSchema,
});

export class RunController {
  async start(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const validation = startSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Informe um cenário e uma rota válidos.",
      });
      return;
    }

    try {
      const run = await service.start(
        validation.data.scenarioId,
        validation.data.routeId
      );

      res.status(202).json({
        success: true,
        message: "Execução iniciada.",
        data: run,
      });
    } catch (error) {
      if (error instanceof Error) {
        const validationErrors = [
          "Cenário não encontrado.",
          "Rota não encontrada neste cenário.",
          "A rota está desativada.",
          "Destino fora do laboratório autorizado.",
          "Esta versão aceita somente rotas GET de rastreamento.",
          "Já existe uma execução ativa neste cenário.",
        ];

        if (validationErrors.includes(error.message)) {
          res.status(400).json({
            success: false,
            message: error.message,
          });
          return;
        }
      }

      next(error);
    }
  }

  async show(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const validation = idSchema.safeParse(req.params.id);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "ID inválido.",
      });
      return;
    }

    try {
      const run = await service.getById(validation.data);

      res.json({
        success: true,
        data: run,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "RUN_NOT_FOUND"
      ) {
        res.status(404).json({
          success: false,
          message: "Execução não encontrada.",
        });
        return;
      }

      next(error);
    }
  }

  async index(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const validation = idSchema.safeParse(
      req.query.scenarioId
    );

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Informe um ID de cenário válido.",
      });
      return;
    }

    try {
      const runs = await service.list(validation.data);

      res.json({
        success: true,
        data: runs,
      });
    } catch (error) {
      next(error);
    }
  }
}