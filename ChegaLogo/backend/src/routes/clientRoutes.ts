import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { ClientController } from "../controllers/clientController";

const router = Router();
const controller = new ClientController();

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
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
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Muitas tentativas de login.",
  },
});

router.post(
  "/login",
  clientLoginLimiter,
  controller.login.bind(controller)
);

export default router;
