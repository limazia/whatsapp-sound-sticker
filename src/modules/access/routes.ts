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

  app.delete("/session", { config: publicAccess, schema: { hide: true } }, async (request, reply) => {
    app.access.logout(request, reply);
    return { ok: true };
  });
};

export default accessRoutes;
