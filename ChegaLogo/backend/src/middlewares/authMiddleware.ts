
import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { SessionService } from "../services/sessionService";

const sessionService = new SessionService();

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies?.chegalogo_session;

  if (typeof token !== "string") {
    res.status(401).json({
      success: false,
      message: "Sessão não encontrada.",
    });
    return;
  }

  const user = sessionService.verifyToken(token);

  if (!user) {
    res.status(401).json({
      success: false,
      message: "Sessão inválida ou expirada.",
    });
    return;
  }

  res.locals.user = user;
  next();
}
