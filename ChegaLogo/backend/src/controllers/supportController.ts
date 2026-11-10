
import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { z } from "zod";
import { SupportRepository } from "../repositories/supportRepository";

const repository = new SupportRepository();

const ticketSchema = z.object({
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(5).max(2000),
}).strict();

export class SupportController {
  create(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const validation = ticketSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Informe assunto e mensagem válidos.",
      });
      return;
    }

    const clientId = Number(res.locals.user?.id);

    if (
      res.locals.user?.role !== "client" ||
      !Number.isSafeInteger(clientId) ||
      clientId <= 0
    ) {
      res.status(403).json({
        success: false,
        message: "Acesso permitido somente a clientes.",
      });
      return;
    }

    try {
      const ticket = repository.create(
        clientId,
        validation.data.subject,
        validation.data.message
      );

      res.status(201).json({
        success: true,
        message: "Solicitação enviada com sucesso!",
        data: ticket,
      });
    } catch (error) {
      next(error);
    }
  }

  listMine(
    _req: Request,
    res: Response,
    next: NextFunction
  ) {
    const clientId = Number(res.locals.user?.id);

    if (
      res.locals.user?.role !== "client" ||
      !Number.isSafeInteger(clientId) ||
      clientId <= 0
    ) {
      res.status(403).json({
        success: false,
        message: "Acesso permitido somente a clientes.",
      });
      return;
    }

    try {
      res.json({
        success: true,
        data: repository.findByClient(clientId),
      });
    } catch (error) {
      next(error);
    }
  }

  listAll(
    _req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      res.json({
        success: true,
        data: repository.findAll(),
      });
    } catch (error) {
      next(error);
    }
  }
}
