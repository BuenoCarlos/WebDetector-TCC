
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { TrackingController } from "../controllers/trackingController";

const router = Router();
const controller = new TrackingController();

const trackingLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Muitas consultas. Tente novamente mais tarde.",
  },
});

router.get(
  "/:code",
  trackingLimiter,
  controller.show.bind(controller)
);

export default router;
