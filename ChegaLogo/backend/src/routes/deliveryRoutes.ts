
import { Router } from "express";
import { DeliveryController } from "../controllers/deliveryController";
import { requireAuth, requireAdmin, } from "../middlewares/authMiddleware";

const router = Router();
const controller = new DeliveryController();

router.use(requireAuth, requireAdmin);

router.get("/", controller.index.bind(controller));
router.get("/summary", controller.summary.bind(controller));
router.get("/:id", controller.show.bind(controller));

export default router;
