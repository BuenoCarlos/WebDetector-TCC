
import type { Request, Response, NextFunction } from "express";
import { DeliveryService } from "../services/deliveryService";

const service = new DeliveryService();

export class DeliveryController {

  index(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const search = req.query.search;

      if (
        search !== undefined &&
        (typeof search !== "string" || search.length > 200)
      ) {
        res.status(400).json({
          success: false,
          message: "Parâmetro de pesquisa inválido."
        });
        return;
      }

      const deliveries = service.listDeliveries(search);

      res.status(200).json({
        success: true,
        total: deliveries.length,
        data: deliveries
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
