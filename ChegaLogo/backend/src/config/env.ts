import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8000),

  JWT_SECRET: z.string().min(32),
  
  NODE_ENV: z.enum([
    "development",
    "production",
    "test"
  ]).default("development"),

  FRONTEND_URL: z.string().url()
    .default("http://localhost:3001")
});

export const env = envSchema.parse(process.env);
