
import type { Request, Response } from "express";

export class HealthController {
  health(_req: Request, res: Response) {
    res.status(200).json({
      status: "online",
      application: "ChegaLogo",
      message: "API da transportadora funcionando!",
      version: "1.0.0"
    });
  }
}
