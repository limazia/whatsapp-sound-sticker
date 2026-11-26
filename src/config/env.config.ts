import { existsSync } from "node:fs";
import { isIP } from "node:net";
import { join } from "node:path";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { z } from "zod";

const envRequired = {
  string: (key: string) => z.string().min(1, `${key} é obrigatório`),
  email: (key: string) => z.email(`${key} deve ser um email válido`),
  url: (key: string) =>
    z.url(`${key} deve ser uma URL válida`).min(1, `${key} é obrigatório`),
};
const EnvType = z.enum(["development", "test", "production"]);
export const nodeEnvironmentSchema = EnvType.default("development");

export const envSchema = z.object({
  NODE_ENV: nodeEnvironmentSchema,
  HOST: envRequired.string("HOST"),
  PORT: z.coerce.number().default(3000),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  API_KEY: z.string().min(1).optional(),
  ADMIN_PASSWORD: z.string().min(1).max(256).optional(),

  DOCS_USERNAME: z
    .string()
    .min(1)
    .refine(
      (user) => !user.includes(":"),
      "DOCS_USERNAME não pode conter dois-pontos",
    )
    .optional(),
  DOCS_PASSWORD: z.string().min(1).optional(),
}).transform((env, ctx) => {
  const endpoint = /^(localhost|[\d.]+|\[[^\]]+\]):(\d+)$/.exec(env.HOST);
  const host = endpoint?.[1]?.replace(/^\[|\]$/g, "") ?? env.HOST;
  if (host !== "localhost" && isIP(host) === 0) {
    ctx.addIssue({ code: "custom", path: ["HOST"], message: "HOST deve ser localhost ou um endereço IP, sem protocolo" });
    return z.NEVER;
  }
  if (endpoint && Number(endpoint[2]) !== env.PORT) {
    ctx.addIssue({ code: "custom", path: ["HOST"], message: "A porta em HOST precisa ser igual a PORT" });
    return z.NEVER;
  }
  return { ...env, HOST: host };
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
  if (
    env.NODE_ENV !== "development" &&
    (!env.DOCS_USERNAME || !env.DOCS_PASSWORD)
  ) {
    throw new Error(
      "Configure DOCS_USERNAME e DOCS_PASSWORD para acessar a documentação.",
    );
  }
  const onLoopback = ["localhost", "127.0.0.1", "::1"].includes(env.HOST);
  const deployed = env.NODE_ENV === "production" || !onLoopback;
  if (deployed && !env.API_KEY) {
    throw new Error("Configure API_KEY para publicar a API.");
  }
  if (deployed && (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 24)) {
    throw new Error("Configure ADMIN_PASSWORD com pelo menos 24 caracteres.");
  }
  if (env.API_KEY && [env.ADMIN_PASSWORD, env.DOCS_PASSWORD].includes(env.API_KEY)) {
    throw new Error("Use senhas diferentes da API_KEY pública do frontend.");
  }
  return env;
}
