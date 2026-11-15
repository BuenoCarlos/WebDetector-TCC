import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { ClientController } from "../controllers/clientController";

const router = Router();
const controller = new ClientController();

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Muitas tentativas de cadastro.",
  },
});

router.post(
  "/register",
  registrationLimiter,
  controller.register.bind(controller)
);

const clientLoginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Muitas tentativas de login.",
  },
});

/**
 * @openapi
 * /api/clients/login:
 *   post:
 *     summary: Login de clientes
 *     tags:
 *       - Clientes
 * 
 *     x-webdetector-safe-to-test: true
 *     x-webdetector-auth: true
 * 
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login realizado
 *       401:
 *         description: Credenciais inválidas
 *       429:
 *         description: Muitas tentativas
 */
router.post(
  "/login",
  clientLoginLimiter,
  controller.login.bind(controller)
);

export default router;
