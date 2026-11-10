import { Router } from "express";
import { IntegrationController } from "../controllers/integrationController";

const router = Router();
const controller = new IntegrationController();

router.post(
  "/integration/scenarios/:scenarioId/routes/:routeId/check",
  controller.check.bind(controller)
);

export default router;
