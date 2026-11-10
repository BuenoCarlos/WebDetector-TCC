
import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import { SupportController } from "../controllers/supportController";
import {
  requireAuth,
  requireAdmin,
} from "../middlewares/authMiddleware";

const router = Router();
const controller = new SupportController();

const supportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Muitas solicitações. Tente novamente mais tarde.",
  },
});

router.use(requireAuth);

router.post("/", supportLimiter, controller.create.bind(controller));
router.get("/mine", controller.listMine.bind(controller));
router.get(
  "/admin",
  requireAdmin,
  controller.listAll.bind(controller)
);

export default router;
