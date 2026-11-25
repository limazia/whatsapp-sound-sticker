import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import sse from "@fastify/sse";
import type { SSEReplyInterface } from "@fastify/sse";
import fp from "fastify-plugin";

interface AppEvents {
  subscribe: (client: SSEReplyInterface, status: object) => Promise<void>;
  broadcast: (event: "status" | "log", data: unknown) => void;
  log: (message: string) => void;
}

declare module "fastify" {
  interface FastifyInstance {
    events: AppEvents;
  }
}

export default fp(
  async (app, { activityFile }: { activityFile?: string }) => {
    await app.register(sse);
    const clients = new Set<SSEReplyInterface>();

    if (activityFile) mkdirSync(dirname(activityFile), { recursive: true, mode: 0o700 });
    const db = new DatabaseSync(activityFile ?? ":memory:");
    app.addHook("onClose", async () => db.close());
    db.exec(`
      CREATE TABLE IF NOT EXISTS activity (id INTEGER PRIMARY KEY, message TEXT NOT NULL);
      CREATE TRIGGER IF NOT EXISTS trim_activity AFTER INSERT ON activity BEGIN
        DELETE FROM activity WHERE id <= NEW.id - 30;
      END;
    `);
    const insert = db.prepare("INSERT INTO activity (message) VALUES (?)");
    const recent = db.prepare("SELECT message FROM activity ORDER BY id DESC LIMIT 30");

    const events: AppEvents = {
      async subscribe(client, status) {
        client.keepAlive();
        client.onClose(() => clients.delete(client));
        clients.add(client);
        await client.send({ event: "status", data: { ...status, history: recent.all().map((row) => row.message) } });
      },
      broadcast(event, data) {
        for (const client of clients) {
          if (client.isConnected) {
            void client.send({ event, data }).catch(() => client.close());
          }
        }
      },
      log(message) {
        try { insert.run(message); } catch (error) { app.log.error(error, "Falha ao salvar a atividade"); }
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
