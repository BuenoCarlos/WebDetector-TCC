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
  })
});

export type CreateScenarioDTO = z.infer<
  typeof createScenarioSchema
>;
