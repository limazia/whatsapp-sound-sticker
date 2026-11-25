import type { FastifyPluginAsync } from "fastify";

const accessRoutes: FastifyPluginAsync = async (app) => {
  const publicAccess = { access: "public" } as const;
  function sessionResponse(role: "admin" | "friend" | null) {
    return {
      ok: true,
      role,
      whatsappConnected: Boolean(role && app.whatsapp.getState().connection === "open"),
    };
  }

  app.get("/session", { config: publicAccess, schema: { hide: true } }, async (request) => {
    return sessionResponse(request.access?.role ?? null);
  });

  app.post<{ Body: { code: string } }>("/session", {
    config: { ...publicAccess, rateLimit: { max: 10, timeWindow: "1 minute" } },
    schema: {
      hide: true,
      body: {
        type: "object",
        required: ["code"],
        properties: { code: { type: "string", minLength: 1, maxLength: 256 } },
      },
    },
  }, async (request, reply) => {
    const session = app.access.login(request.body.code, request, reply);
    if (!session) return reply.code(401).send({ ok: false, error: "Código de acesso inválido." });
    return sessionResponse(session.role);
  });

  app.delete("/session", { config: publicAccess, schema: { hide: true } }, async (request, reply) => {
    app.access.logout(request, reply);
    return { ok: true };
  });
};

export default accessRoutes;
