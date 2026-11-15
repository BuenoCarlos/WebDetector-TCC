import { Router } from "express";
import { RouteDiscoveryService } from "../services/routeDiscoveryService";

const router = Router();
const service = new RouteDiscoveryService();

router.post("/discovery/routes", async (req, res) => {
  try {
    if (typeof req.body?.base_url !== "string") {
      res.status(400).json({
        message: "Informe a URL da aplicação.",
      });
      return;
    }

    const result = await service.discover(
      req.body.base_url
    );

    res.json(result);
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Erro na descoberta das rotas.",
    });
  }
});

export default router;
