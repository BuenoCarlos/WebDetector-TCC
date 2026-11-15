import { Router } from "express";
import { z } from "zod";
import { SqlInjectionTestService } from "../services/sqlInjectionTestService";

const router = Router();
const service = new SqlInjectionTestService();
const schema = z.object({
  scenarioId: z.string().uuid(),
  routeId: z.string().uuid(),
  field: z.enum(["username", "password"]),
});

router.post("/security/test-sqli", async (req, res) => {
  const input = schema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ message: "Informe cenário, rota e campo válidos." });
    return;
  }
  try {
    const result = await service.execute(input.data);
    res.status(200).json(result);
  } catch (err) {
    console.error("[SQLi test]", err);
    res.status(400).json({ message: err instanceof Error ? err.message : "Falha no teste." });
  }
});

export default router;
