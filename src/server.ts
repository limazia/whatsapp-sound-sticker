import { buildApp } from "@/app";
import { loadEnvironment } from "@/config/env.config";
import { docsPath, docsTitle } from "@/config/swagger.config";

const env = loadEnvironment();
const app = buildApp({
  logger: { level: env.LOG_LEVEL },
  nodeEnv: env.NODE_ENV,
  trustProxy: process.env.RAILWAY_ENVIRONMENT_ID ? (_address, hop) => hop === 0 : false,
  access: {
    apiKey: env.API_KEY,
    adminPassword: env.ADMIN_PASSWORD,
    friendCode: env.FRIEND_KEY,
    docsUser: env.DOCS_USER,
    docsPassword: env.DOCS_PASSWORD,
  },
});

try {
  const address = await app.listen({ host: env.HOST, port: env.PORT });
  const localUrl = new URL(address);
  if (env.HOST === "0.0.0.0") localUrl.hostname = "127.0.0.1";
  if (env.HOST === "::") localUrl.hostname = "[::1]";

  if (app.whatsapp.getState().hasAuth) {
    void app.whatsapp.connect().catch((error: unknown) => {
      app.log.warn(error, "Falha ao restaurar a sessão do WhatsApp");
    });
  }

  console.info([
    "",
    `${docsTitle} rodando em ${localUrl.origin} (${env.NODE_ENV})`,
    `  Interface       ${localUrl.origin}/`,
    `  Administração   ${new URL("/admin", localUrl)}`,
    `  Base da API     ${new URL("/api", localUrl)}`,
    `  Health          ${new URL("/api/health", localUrl)}`,
    `  Scalar          ${new URL(docsPath, localUrl)}`,
    "",
  ].join("\n"));

  let closing = false;
  function shutdown() {
    if (closing) return;
    closing = true;

    const timeout = setTimeout(() => process.exit(1), 1500);
    timeout.unref();
    void app
      .close()
      .catch((error: unknown) => {
        app.log.error(error, "Falha ao encerrar a API");
        process.exitCode = 1;
      })
      .finally(() => clearTimeout(timeout));
  }

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
} catch (error) {
  app.log.error(error, "Falha ao iniciar a API");
  process.exitCode = 1;
  await app.close();
}
