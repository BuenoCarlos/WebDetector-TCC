import type {
  Request,
  Response,
  NextFunction
} from "express";

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error("[WebDetector API]", error);

  res.status(500).json({
    status: "error",
    message: "Erro interno do servidor."
  });
}
