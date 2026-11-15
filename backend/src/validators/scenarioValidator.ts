import { z } from "zod";

export const createScenarioSchema = z.object({
  name: z.string().trim().min(3).max(150),
  description: z.string().max(2000).default(""),
  base_url: z.string().url().refine(value => {
    try {
      const u = new URL(value);
      return u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname) &&
        u.port !== "" && Number(u.port) >= 1024 && Number(u.port) <= 65535 &&
        u.pathname === "/" && !u.search && !u.hash && !u.username && !u.password;
    } catch { return false; }
  }, "Informe http://localhost:PORTA ou http://127.0.0.1:PORTA."),
  attack_types: z.array(z.enum(["SQL Injection", "XSS", "Brute Force"]))
    .min(1, "Selecione um ataque."),
  defenses: z.object({
    sql_injection: z.boolean().default(false),
    xss: z.boolean().default(false),
    brute_force: z.boolean().default(false),
  }).default({ sql_injection: false, xss: false, brute_force: false }),
  max_requests: z.number().int().min(1).max(100).default(20),
  duration_seconds: z.number().int().min(5).max(120).default(60),
  interval_ms: z.number().int().min(1000).max(10000).default(2000),
  request_timeout_ms: z.number().int().min(1000).max(10000).default(5000),
  routes: z.array(z.object({
    path: z.string().startsWith("/").max(250)
      .refine(p => !p.startsWith("//") && !/[?#\\]/.test(p), "Caminho inválido."),
    method: z.enum(["GET", "POST"]),
  })).min(1, "Selecione pelo menos uma rota.").max(20)
    .refine(routes => new Set(routes.map(r => `${r.method}:${r.path}`)).size === routes.length,
      "Não repita rotas."),
});

export type CreateScenarioDTO = z.infer<typeof createScenarioSchema>;
