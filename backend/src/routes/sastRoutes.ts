import { Router } from "express";
import { z } from "zod";
import { SastService, getSastRulesStatus, type RulesProfile } from "../services/sastService";

const router = Router();
const service = new SastService();
const uuid = z.string().uuid();

function getId(value: unknown): string {
  if (value === "local") return "local";
  const parsed = uuid.safeParse(value);
  if (!parsed.success) throw new Error("ID de cenário inválido.");
  return parsed.data;
}
function sendError(res: any, error: unknown) {
  res.status(400).json({ error: error instanceof Error ? error.message : "Erro na análise de código." });
}

router.get("/sast/rules", (_req, res) => {
  res.json(getSastRulesStatus());
});

router.get("/sast/scenarios/:id", async (req, res) => {
  try { res.json(await service.getConfig(getId(req.params.id))); }
  catch (error) { sendError(res, error); }
});

router.put("/sast/scenarios/:id/source", async (req, res) => {
  try {
    const body = z.object({ sourcePath: z.string().max(1024) }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Informe o caminho da pasta de código-fonte." }); return; }
    res.json(await service.saveConfig(getId(req.params.id), body.data.sourcePath));
  } catch (error) { sendError(res, error); }
});

router.post("/sast/scenarios/:id/scan", async (req, res) => {
  try {
    const body = z.object({ profile: z.enum(["basic", "community"]).default("basic") }).safeParse(req.body || {});
    if (!body.success) { res.status(400).json({ error: "Perfil de regras inválido." }); return; }
    res.json(await service.scan(getId(req.params.id), body.data.profile as RulesProfile));
  }
  catch (error) { sendError(res, error); }
});

export default router;
