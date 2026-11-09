import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { z } from "zod";
import { ClientService } from "../services/clientService";
import { SessionService } from "../services/sessionService";
import { env } from "../config/env";

const service = new ClientService();
const sessionService = new SessionService();
const registerSchema = z.object({
  fullName: z.string().trim().min(3).max(120),

  username: z.string().trim().toLowerCase()
    .regex(/^[a-z0-9_]{3,30}$/, {
      message: "Usuário deve ter de 3 a 30 caracteres.",
    }),

  email: z.email().max(254),

  phone: z.union([
    z.literal(""),
    z.string().regex(/^\d{10,11}$/, {
      message: "Telefone deve conter 10 ou 11 números.",
    }),
  ]).optional(),

  password: z.string().min(8).max(72),
}).strict();

export class ClientController {
  async register(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const validation = registerSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Verifique os dados informados.",
      });
      return;
    }

    try {
      const client = await service.register(validation.data);

      res.status(201).json({
        success: true,
        message: "Conta criada com sucesso!",
        data: client,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "CLIENT_ALREADY_EXISTS"
      ) {
        res.status(409).json({
          success: false,
          message: "Usuário ou e-mail já cadastrado.",
        });
        return;
      }

      next(error);
    }
  }
  
async login(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const validation = z.object({
    username: z.string().min(1).max(100),
    password: z.string().min(1).max(200),
  }).safeParse(req.body);

  if (!validation.success) {
    res.status(400).json({
      success: false,
      message: "Informe usuário e senha.",
    });
    return;
  }

  try {
    const client = await service.login(
      validation.data.username,
      validation.data.password
    );

    if (!client) {
      res.status(401).json({
        success: false,
        message: "Usuário ou senha inválidos.",
      });
      return;
    }

    const token = sessionService.createToken(client);

    res.cookie("chegalogo_session", token, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 2 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: "Login realizado com sucesso!",
      user: client,
    });
  } catch (error) {
    next(error);
  }
}

}


