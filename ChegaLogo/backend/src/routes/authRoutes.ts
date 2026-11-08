
import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import { AuthController } from "../controllers/authController";
import { requireAuth } from "../middlewares/authMiddleware";

const router = Router();
const controller = new AuthController();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Muitas tentativas. Tente novamente mais tarde.",
  },
});

router.post(
  "/login",
  loginLimiter,
  controller.login.bind(controller)
);

router.get(
  "/me",
  requireAuth,
  controller.me.bind(controller)
);

router.post(
  "/logout",
  requireAuth,
  controller.logout.bind(controller)
);

export default router;
