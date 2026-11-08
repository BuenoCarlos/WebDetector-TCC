import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  SUPABASE_URL: z.string().url(),

  SUPABASE_SECRET_KEY: z.string().min(1),

  FRONTEND_URL: z.string().url()
    .default("http://localhost:3000"),
});

export const env = envSchema.parse(process.env);
