
import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { z } from "zod";
import { AuthService } from "../services/authService";
import { SessionService } from "../services/sessionService";
import { env } from "../config/env";

const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

const authService = new AuthService();
const sessionService = new SessionService();

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export class AuthController {
  async login(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const validation = loginSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Informe usuário e senha válidos.",
      });
      return;
    }

    try {
      const user = await authService.login(
        validation.data.username,
        validation.data.password
      );

      if (!user) {
        res.status(401).json({
          success: false,
          message: "Usuário ou senha inválidos.",
        });
        return;
      }

      const token = sessionService.createToken(user);

      res.cookie("chegalogo_session", token, {
        ...cookieOptions,
        maxAge: 2 * 60 * 60 * 1000,
      });

      res.status(200).json({
        success: true,
        message: "Login realizado com sucesso!",
        user,
      });
    } catch (error) {
      next(error);
    }
  }

  me(_req: Request, res: Response) {
    res.status(200).json({
      success: true,
      user: res.locals.user,
    });
  }

  logout(_req: Request, res: Response) {
    res.clearCookie("chegalogo_session", cookieOptions);

    res.status(200).json({
      success: true,
      message: "Logout realizado com sucesso.",
    });
  }
}
