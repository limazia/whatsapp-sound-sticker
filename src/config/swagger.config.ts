import { readFile } from "node:fs/promises";
import type { SwaggerOptions } from "@fastify/swagger";

export const docsPath = "/api/docs";
export const docsTitle = "WhatsApp Sound Sticker API";

export async function createSwaggerConfig(): Promise<SwaggerOptions> {
  const { version } = JSON.parse(
    await readFile(new URL("../../package.json", import.meta.url), "utf8"),
  );
  return {
    openapi: {
      openapi: "3.1.0",
      info: { title: docsTitle, version },
      components: { securitySchemes: { apiKey: { type: "apiKey", in: "header", name: "X-API-Key" } } },
      security: [{ apiKey: [] }],
      tags: [{ name: "Health" }, { name: "WhatsApp" }, { name: "Stickers" }],
    },
  };
}
