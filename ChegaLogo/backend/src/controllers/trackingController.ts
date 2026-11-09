import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { z } from "zod";
import { TrackingService } from "../services/trackingService";

const service = new TrackingService();

const trackingSchema = z.object({
  code: z.string()
    .trim()
    .toUpperCase()
    .regex(
      /^CHG[0-9]{8}$/,
      "Código de rastreamento inválido."
    ),
});

export class TrackingController {
  async show(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const validation = trackingSchema.safeParse({
        code: req.params.code,
      });

      if (!validation.success) {
        res.status(400).json({
          success: false,
          message: "Código de rastreamento inválido.",
        });
        return;
      }

      const delivery = service.track(
        validation.data.code
      );

      if (!delivery) {
        res.status(404).json({
          success: false,
          message: "Encomenda não encontrada.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: delivery,
      });
    } catch (error) {
      next(error);
    }
  }
}
