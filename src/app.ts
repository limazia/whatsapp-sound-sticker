import autoload from "@fastify/autoload";
import cors from "@fastify/cors";
import Fastify from "fastify";
import type { FastifyServerOptions } from "fastify";
import { join } from "node:path";

import { createCorsConfig } from "@/config/cors.config";
import { envSchema } from "@/config/env.config";
import accessPlugin from "@/modules/access/plugin";
import type { AccessOptions } from "@/modules/access/plugin";
import type { NodeEnvironment } from "@/config/env.config";

type AppOptions = FastifyServerOptions & { nodeEnv?: NodeEnvironment; access?: AccessOptions };

export function buildApp({
  nodeEnv = envSchema.parse(process.env).NODE_ENV,
  access = {},
  ...options
}: AppOptions = {}) {
  const app = Fastify({
    bodyLimit: 2 * 1024 * 1024,
    ajv: { customOptions: { coerceTypes: false } },
    ...options,
  });

  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({ ok: false, error: "Rota não encontrada" });
  });
  app.setErrorHandler(
    (error: Error & { statusCode?: number }, request, reply) => {
      const status = error.statusCode ?? 500;
      if (status >= 500) {
        request.log.error(error);
        return reply
          .code(status)
          .send({ ok: false, error: "Erro interno da API" });
      }
      return reply.code(status).send({ ok: false, error: error.message });
    },
  );
  app.register(cors, createCorsConfig(nodeEnv));
  app.register(accessPlugin, {
    ...access,
    development: nodeEnv === "development",
    secure: nodeEnv === "production" || nodeEnv === "qa",
  });
  app.register(autoload, {
    dir: join(import.meta.dirname, "plugins"),
    options: { scalarApiKey: nodeEnv === "development" ? access.apiKey : undefined },
  });
  app.register(autoload, {
    dir: join(import.meta.dirname, "modules"),
    dirNameRoutePrefix: false,
    matchFilter: /[/\\]routes\.(?:ts|js)$/,
    options: { prefix: "/api" },
  });

  return app;
}
