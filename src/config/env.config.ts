import { existsSync } from "node:fs";
import { isIP } from "node:net";
import { join } from "node:path";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { z } from "zod";

const EnvType = z.enum(["development", "test", "qa", "production"]);

export const envSchema = z.object({
  NODE_ENV: EnvType.default("development"),
  HOST: z
    .string()
    .trim()
    .refine(
      (host) => isIP(host) !== 0 || /^[a-z\d][a-z\d.-]*$/i.test(host),
      "HOST deve conter um hostname ou endereço IP sem protocolo nem porta",
    )
    .default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  API_KEY: z.string().min(1).optional(),
  ADMIN_PASSWORD: z.string().min(1).max(256).optional(),
  FRIEND_KEY: z.string().min(1).max(256).optional(),

  DOCS_USER: z.string().min(1).refine((user) => !user.includes(":"), "DOCS_USER não pode conter dois-pontos").optional(),
  DOCS_PASSWORD: z.string().min(1).optional(),
});

export type NodeEnvironment = z.infer<typeof EnvType>;

export function loadEnvironment() {
  const path = join(process.cwd(), ".env");
  if (existsSync(path)) {
    const result = config({ path, quiet: true });
    if (result.error) throw result.error;
    expand(result);
  }
  const env = envSchema.parse(process.env);
  if (env.NODE_ENV !== "development" && (!env.DOCS_USER || !env.DOCS_PASSWORD)) {
    throw new Error("Configure DOCS_USER e DOCS_PASSWORD para acessar a documentação.");
  }
  const onLoopback = ["127.0.0.1", "localhost", "::1"].includes(env.HOST);
  const deployed = env.NODE_ENV === "production" || env.NODE_ENV === "qa" || !onLoopback;
  if (deployed && !env.API_KEY) {
    throw new Error("Configure API_KEY para publicar a API.");
  }
  if (deployed &&
      (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 24 || !env.FRIEND_KEY || env.FRIEND_KEY.length < 24)) {
    throw new Error("Configure ADMIN_PASSWORD e FRIEND_KEY com pelo menos 24 caracteres para publicar a API.");
  }
  const credentials = [env.API_KEY, env.ADMIN_PASSWORD, env.FRIEND_KEY].filter(Boolean);
  if (new Set(credentials).size !== credentials.length) {
    throw new Error("API_KEY, ADMIN_PASSWORD e FRIEND_KEY precisam ser diferentes.");
  }
  return env;
}
