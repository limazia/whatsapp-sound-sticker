import { existsSync } from "node:fs";
import { join } from "node:path";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import fp from "fastify-plugin";
import { appDir } from "@/shared/paths";

export default fp(
  async (app) => {
    await app.register(multipart, {
      limits: { files: 2, fileSize: 80 * 1024 * 1024 },
    });
    const root = join(appDir(), "public");
    const built = existsSync(join(root, "index.html"));
    await app.register(fastifyStatic, built ? { root } : { serve: false });

    const adminRoute = {
      config: { access: "public" as const, rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: { hide: true },
      preHandler: app.basicAuth,
    };
    app.get("/admin", adminRoute, async (_request, reply) => {
      if (built) return reply.sendFile("index.html");
      return reply.code(503).send({ ok: false, error: "Compile a interface com yarn build." });
    });
    app.get("/admin/auth", adminRoute, async (_request, reply) => reply.redirect("/admin", 303));
  },
  { name: "http", dependencies: ["access"] },
);
