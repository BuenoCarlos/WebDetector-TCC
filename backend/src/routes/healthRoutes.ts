import { Router } from "express";
import { HealthController } from "../controllers/healthController";

const router = Router();
const controller = new HealthController();

router.get("/health", controller.health.bind(controller));
router.get("/database/test", controller.database.bind(controller));

export default router;
