import { z } from "zod";

export const routeParamsSchema = z.object({
  id: z.string().uuid(),
});

export const deleteRouteParamsSchema = z.object({
  id: z.string().uuid(),
  routeId: z.string().uuid(),
});

export const createRouteSchema = z.object({
  path: z.string()
    .trim()
    .min(1, "Informe o caminho da rota.")
    .max(250)
    .refine(
      (path) =>
        path.startsWith("/") &&
        !path.startsWith("//") &&
        !path.includes("?") &&
        !path.includes("#") &&
        !path.includes("\\") &&
        !path.includes("://"),
      "Informe um caminho relativo, como /login ou /search."
    ),

  method: z.enum(["GET", "POST"]),

  enabled: z.boolean().default(true),
});

export type CreateRouteDTO = z.infer<
  typeof createRouteSchema
>;
