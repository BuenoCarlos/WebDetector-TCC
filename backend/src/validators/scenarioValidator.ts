import { z } from "zod";

export const createScenarioSchema = z.object({
  name: z.string()
    .trim()
    .min(3, "O nome deve ter pelo menos 3 caracteres.")
    .max(150),

  description: z.string()
    .max(2000)
    .default(""),

  base_url: z.url({
    protocol: /^https?$/,
    hostname: z.regexes.domain
  }).or(
    z.string().refine((value) => {
      try {
        const url = new URL(value);
        return (
          ["http:", "https:"].includes(url.protocol) &&
          ["localhost", "127.0.0.1"].includes(url.hostname) &&
          !url.username &&
          !url.password &&
          !url.hash
        );
      } catch {
        return false;
      }
    }, "Informe uma URL HTTP/HTTPS válida.")
  ),

  attack_types: z.array(
    z.enum(["SQL Injection", "XSS", "Brute Force"])
  ).min(1, "Selecione pelo menos um tipo de ataque."),

  defenses: z.object({
    sql_injection: z.boolean().default(false),
    xss: z.boolean().default(false),
    brute_force: z.boolean().default(false)
  }).default({
    sql_injection: false,
    xss: false,
    brute_force: false
  }),
 
  max_requests: z.number()
    .int()
    .min(1, "O mínimo é 1 tentativa.")
    .max(100, "O máximo é 100 tentativas.")
    .default(20),

  duration_seconds: z.number()
    .int()
    .min(5, "O mínimo é 5 segundos.")
    .max(120, "O máximo é 120 segundos.")
    .default(60),

  interval_ms: z.number()
    .int()
    .min(1000, "O intervalo mínimo é 1000 ms.")
    .max(10000, "O intervalo máximo é 10000 ms.")
    .default(2000),

  request_timeout_ms: z.number()
    .int()
    .min(1000, "O timeout mínimo é 1000 ms.")
    .max(10000, "O timeout máximo é 10000 ms.")
    .default(5000),
});

export type CreateScenarioDTO = z.infer<
  typeof createScenarioSchema
>;
