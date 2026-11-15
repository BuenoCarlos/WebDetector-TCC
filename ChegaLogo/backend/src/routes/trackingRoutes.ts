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

/**
 * @openapi
 * /api/tracking/{code}:
 *   get:
 *     summary: Consultar rastreamento de entrega
 *     tags:
 *       - Rastreamento
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         example: CHG20260001
 *     responses:
 *       200:
 *         description: Rastreamento encontrado
 *       404:
 *         description: Rastreamento não encontrado
 */
router.get(
  "/:code",
  trackingLimiter,
  controller.show.bind(controller)
);

export default router;
