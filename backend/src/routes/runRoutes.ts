import { Router } from "express";
import { RunController } from "../controllers/runController";

const router = Router();
const controller = new RunController();

router.post(
  "/runs",
  controller.start.bind(controller)
);

router.get(
  "/runs",
  controller.index.bind(controller)
);

router.get(
  "/runs/:id",
  controller.show.bind(controller)
);

export default router;
