import { Router } from "express";
import { z } from "zod";
import { applicationScanService } from "../services/applicationScanService";
import { supabase } from "../config/supabase";

const router = Router();

const schema = z.object({
  includeMutations: z.boolean().default(false),
  includeSecurityTests: z.boolean().default(true),
  authProfiles: z.record(
    z.string().max(40),
    z.object({
      username: z.string().min(1).max(120),
      password: z.string().min(1).max(300),
    })
  ).optional(),
});

const validId = z.uuid();

router.use((req, res, next) => {
  const ip = req.socket.remoteAddress || "";

  if (
    ![
      "127.0.0.1",
      "::1",
      "::ffff:127.0.0.1",
    ].includes(ip)
  ) {
    res.status(403).json({
      error: "A varredura ativa é restrita à interface local.",
    });
    return;
  }

  next();
});

router.get(
  "/security/scenarios/:id/scan-profiles",
  async (req, res) => {
    const id = validId.safeParse(req.params.id);

    if (!id.success) {
      res.status(400).json({ error: "Cenário inválido." });
      return;
    }

    try {
      res.json(await applicationScanService.profiles(id.data));
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Erro ao ler perfis.",
      });
    }
  }
);

router.post(
  "/security/scenarios/:id/scan",
  async (req, res) => {
    const id = validId.safeParse(req.params.id);
    const input = schema.safeParse(req.body || {});

    if (!id.success || !input.success) {
      res.status(400).json({
        error: "Cenário ou parâmetros inválidos.",
      });
      return;
    }

    try {
      const job = await applicationScanService.start(
        id.data,
        input.data
      );

      res.status(202).json(job);
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Falha na varredura.",
      });
    }
  }
);


router.get(
  "/security/scan-reports",
  async (_req, res) => {
    try {
      const reports =
        await applicationScanService.listSavedScans();

      res.json(reports);
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Falha ao listar relatórios.",
      });
    }
  }
);

router.get(
  "/security/scan-reports/:id",
  async (req, res) => {
    const id = validId.safeParse(req.params.id);

    if (!id.success) {
      res.status(400).json({
        error: "ID inválido.",
      });
      return;
    }

    try {
      const report =
        await applicationScanService.getSavedScan(
          id.data
        );

      res.json(report);
    } catch (error) {
      res.status(404).json({
        error:
          error instanceof Error
            ? error.message
            : "Relatório não encontrado.",
      });
    }
  }
);

router.get("/security/scans/:id", (req, res) => {
  const id = validId.safeParse(req.params.id);

  const job = id.success
    ? applicationScanService.getJob(id.data)
    : undefined;

  if (!job) {
    res.status(404).json({
      error: "Varredura não encontrada ou servidor reiniciado.",
    });
    return;
  }

  res.json(job);
});


router.get(
  "/security/assessments/:id",
  async (req, res) => {
    const id = validId.safeParse(req.params.id);

    if (!id.success) {
      res.status(400).json({
        error: "ID de avaliação inválido.",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("webdetector_assessments")
        .select(
          "id,scenario_id,created_at,outcome,report"
        )
        .eq("id", id.data)
        .single();

      if (error || !data) {
        res.status(404).json({
          error: "Avaliação não encontrada.",
        });
        return;
      }

      res.json(data);
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Falha ao consultar a avaliação.",
      });
    }
  }
);

export default router;