
import type {
  Request,
  Response,
  NextFunction
} from "express";

import { z } from "zod";
import { AuthService } from "../services/authService";

const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200)
});

const authService = new AuthService();

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
        message: "Informe usuário e senha válidos."
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
          message: "Usuário ou senha inválidos."
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Credenciais verificadas.",
        user
      });
    } catch (error) {
      next(error);
    }
  }
}
