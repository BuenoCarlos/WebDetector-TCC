import type {
  Request,
  Response,
} from "express";

import { z } from "zod";
import { IntegrationService } from "../services/integrationService";

const service = new IntegrationService();

const paramsSchema = z.object({
  scenarioId: z.string().uuid(),
  routeId: z.string().uuid(),
});

export class IntegrationController {
  async check(req: Request, res: Response) {
    const validation = paramsSchema.safeParse(req.params);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "IDs do cenário ou da rota inválidos.",
      });
      return;
    }

    try {
      const result = await service.checkScenarioRoute(
        validation.data.scenarioId,
        validation.data.routeId
      );

      res.status(200).json(result);
    
    } catch (error) {
    console.error(
        "[WebDetector] Erro na integração:",
        error
    );

    const code =
        error instanceof Error ? error.message : "";

      const knownErrors: Record<
        string,
        { status: number; message: string }
      > = {
        SCENARIO_NOT_FOUND: {
          status: 404,
          message: "Cenário não encontrado.",
        },
        ROUTE_NOT_FOUND: {
          status: 404,
          message: "Rota não encontrada neste cenário.",
        },
        ROUTE_DISABLED: {
          status: 400,
          message: "A rota selecionada está desativada.",
        },
        UNSUPPORTED_TEST_ROUTE: {
          status: 400,
          message:
            "Esta etapa permite somente rotas GET de rastreamento da ChegaLogo.",
        },
        TARGET_NOT_ALLOWED: {
          status: 403,
          message:
            "O destino não pertence ao laboratório autorizado.",
        },
      };

      const known = knownErrors[code];

      if (known) {
        res.status(known.status).json({
          success: false,
          message: known.message,
        });
        return;
      }

      res.status(502).json({
        success: false,
        message: "Falha na comunicação com a aplicação-alvo.",
      });
    }
  }
}
