import { SecurityEventRepository } from "../repositories/securityEventRepository";
import type { Request, Response, NextFunction } from "express";
import { DeliveryService } from "../services/deliveryService";

const service = new DeliveryService();
const eventRepository = new SecurityEventRepository();

export class DeliveryController {

  index(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const startedAt = performance.now();

    try {
      const search = req.query.search;

      if (
        search !== undefined &&
        (typeof search !== "string" || search.length > 200)
      ) {
        const inputLength =
          typeof search === "string" ? search.length : 0;

        eventRepository.create({
          eventType: "DELIVERY_SEARCH",
          requestMethod: "GET",
          requestPath: "/api/deliveries",
          inputLength,
          responseStatus: 400,
          durationMs: performance.now() - startedAt,
        });

        res.status(400).json({
          success: false,
          message: "Parâmetro de pesquisa inválido.",
        });
        return;
      }

      const deliveries = service.listDeliveries(search);

      // Registra pesquisas, sem gravar o conteúdo pesquisado.
      if (typeof search === "string" && search.trim()) {
        eventRepository.create({
          eventType: "DELIVERY_SEARCH",
          requestMethod: "GET",
          requestPath: "/api/deliveries",
          inputLength: search.length,
          responseStatus: 200,
          durationMs: performance.now() - startedAt,
        });
      }

      res.status(200).json({
        success: true,
        total: deliveries.length,
        data: deliveries,
      });

    } catch (error) {
      next(error);
    }
  }


  summary(
    _req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      res.status(200).json({
        success: true,
        data: service.getSummary()
      });
    } catch (error) {
      next(error);
    }
  }

  show(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id <= 0) {
        res.status(400).json({
          success: false,
          message: "ID inválido."
        });
        return;
      }

      const delivery = service.getDelivery(id);

      if (!delivery) {
        res.status(404).json({
          success: false,
          message: "Entrega não encontrada."
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: delivery
      });
    } catch (error) {
      next(error);
    }
  }
}
