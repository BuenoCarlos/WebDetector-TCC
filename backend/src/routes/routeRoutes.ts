import { Router } from "express";
import { RouteController } from "../controllers/routeController";

const router = Router();
const controller = new RouteController();

router.get(
  "/scenarios/:id/routes",
  controller.index.bind(controller)
);

router.post(
  "/scenarios/:id/routes",
  controller.store.bind(controller)
);

router.delete(
  "/scenarios/:id/routes/:routeId",
  controller.destroy.bind(controller)
);

export default router;
