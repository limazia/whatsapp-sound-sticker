import fp from "fastify-plugin";

import { createWhatsAppManager } from "@/modules/whatsapp/service";

declare module "fastify" {
  interface FastifyInstance {
    whatsapp: ReturnType<typeof createWhatsAppManager>;
  }
}

export default fp(
  async (app) => {
    const whatsapp = createWhatsAppManager({
      onChange(state) {
        app.events.broadcast("status", state);
      },
    });
    app.decorate("whatsapp", whatsapp);
    app.addHook("onClose", async () => whatsapp.stop());
  },
  { name: "whatsapp", dependencies: ["events"] },
);
