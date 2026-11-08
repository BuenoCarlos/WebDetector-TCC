
import { Router } from "express";
import { HealthController } from "../controllers/healthController";

const router = Router();
const controller = new HealthController();

router.get("/health", controller.health.bind(controller));

export default router;
