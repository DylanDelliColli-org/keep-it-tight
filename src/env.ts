import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
});

type Env = z.infer<typeof envSchema>;

let env: Env | undefined;

export function getEnv(): Env {
  env ??= envSchema.parse(process.env);
  return env;
}
