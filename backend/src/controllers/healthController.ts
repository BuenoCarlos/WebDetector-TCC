import type { Request, Response, NextFunction } from "express";
import { supabase } from "../config/supabase";

export class HealthController {
  health(_req: Request, res: Response) {
    res.status(200).json({
      status: "online",
      message: "API WebDetector funcionando!",
      version: "1.0.0",
      backend: "Node.js + Express"
    });
  }

  async database(
    _req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { error } = await supabase
        .from("scenarios")
        .select("id")
        .limit(1);

      if (error) {
        throw new Error(`Falha na consulta: ${error.code}`);
      }

      res.status(200).json({
        status: "connected",
        message: "Conexão com Supabase realizada!",
        database: "PostgreSQL"
      });
    } catch (error) {
      next(error);
    }
  }
}
