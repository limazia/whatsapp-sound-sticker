import sse from "@fastify/sse";
import type { SSEReplyInterface } from "@fastify/sse";
import fp from "fastify-plugin";

interface AppEvents {
  subscribe: (client: SSEReplyInterface, status: unknown) => Promise<void>;
  broadcast: (event: "status" | "log", data: unknown) => void;
  log: (message: string) => void;
}

declare module "fastify" {
  interface FastifyInstance {
    events: AppEvents;
  }
}

export default fp(
  async (app) => {
    await app.register(sse);
    const clients = new Set<SSEReplyInterface>();

    const events: AppEvents = {
      async subscribe(client, status) {
        client.keepAlive();
        client.onClose(() => clients.delete(client));
        clients.add(client);
        await client.send({ event: "status", data: status });
      },
      broadcast(event, data) {
        for (const client of clients) {
          if (client.isConnected) {
            void client.send({ event, data }).catch(() => client.close());
          }
        }
      },
      log(message) {
        app.log.info(message);
        events.broadcast("log", { t: new Date().toISOString(), message });
      },
    };

    app.decorate("events", events);
    app.addHook("preClose", async () => {
      for (const client of clients) client.close();
      clients.clear();
    });
  },
  { name: "events" },
);
