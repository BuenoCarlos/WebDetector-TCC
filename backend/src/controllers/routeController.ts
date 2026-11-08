import type {
  Request,
  Response,
  NextFunction
} from "express";

import { RouteService } from "../services/routeService";

import {
  createRouteSchema,
  routeParamsSchema,
  deleteRouteParamsSchema,
} from "../validators/routeValidator";

const service = new RouteService();

function handleRouteError(
  error: unknown,
  next: NextFunction,
  res: Response
) {
  if (error instanceof Error) {
    if (error.message === "SCENARIO_NOT_FOUND") {
      res.status(404).json({
        message: "Cenário não encontrado."
      });
      return;
    }

    if (error.message === "ROUTE_ALREADY_EXISTS") {
      res.status(409).json({
        message: "Essa rota já está cadastrada."
      });
      return;
    }
  }

  next(error);
}

export class RouteController {
  async index(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const params = routeParamsSchema.safeParse(req.params);

    if (!params.success) {
      res.status(400).json({
        message: "ID do cenário inválido."
      });
      return;
    }

    try {
      const routes = await service.list(params.data.id);
      res.json(routes);
    } catch (error) {
      handleRouteError(error, next, res);
    }
  }

  async store(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const params = routeParamsSchema.safeParse(req.params);
    const body = createRouteSchema.safeParse(req.body);

    if (!params.success || !body.success) {
      res.status(400).json({
        message: "Dados da rota inválidos.",
        errors: body.success ? [] : body.error.issues
      });
      return;
    }

    try {
      const route = await service.create(
        params.data.id,
        body.data
      );

      res.status(201).json({
        message: "Rota cadastrada com sucesso!",
        data: route
      });
    } catch (error) {
      handleRouteError(error, next, res);
    }
  }

  async destroy(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const params = deleteRouteParamsSchema.safeParse(
      req.params
    );

    if (!params.success) {
      res.status(400).json({
        message: "IDs inválidos."
      });
      return;
    }

    try {
      const deleted = await service.delete(
        params.data.id,
        params.data.routeId
      );

      if (!deleted) {
        res.status(404).json({
          message: "Rota não encontrada."
        });
        return;
      }

      res.status(204).send();
    } catch (error) {
      handleRouteError(error, next, res);
    }
  }
}
