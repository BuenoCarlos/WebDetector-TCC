import { Router } from "express";
import { ScenarioController } from "../controllers/scenarioController";

const router = Router();
const controller = new ScenarioController();

router.get(
  "/scenarios",
  controller.index.bind(controller)
);

router.post(
  "/scenarios",
  controller.store.bind(controller)
);

export default router;
