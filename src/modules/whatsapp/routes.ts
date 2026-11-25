import type { FastifyPluginAsync } from "fastify";

import { errorMessage } from "@/shared/errors";
import { ffmpegStatus } from "@/shared/ffmpeg";
import { apiErrorSchema, ffmpegStatusSchema } from "@/shared/http-schemas";

const sessionProperties = {
  ok: { const: true },
  connection: {
    type: "string",
    enum: ["disconnected", "connecting", "qr", "open"],
  },
  qrDataUrl: { type: ["string", "null"] },
  pairingCode: { type: ["string", "null"] },
  selfJid: { type: ["string", "null"] },
  lastError: { type: ["string", "null"] },
  hasAuth: { type: "boolean" },
};

const sessionSchema = {
  type: "object",
  required: Object.keys(sessionProperties),
  properties: sessionProperties,
};

const whatsappRoutes: FastifyPluginAsync = async (app) => {
  const { events, whatsapp } = app;

  app.get(
    "/status",
    {
      schema: {
        summary: "Get the WhatsApp session status",
        tags: ["WhatsApp"],
        response: {
          200: {
            ...sessionSchema,
            required: [...sessionSchema.required, "ffmpeg"],
            properties: { ...sessionProperties, ffmpeg: ffmpegStatusSchema },
          },
        },
      },
    },
    async () => ({ ok: true, ...whatsapp.getState(), ffmpeg: ffmpegStatus() }),
  );

  app.get(
    "/events",
    {
      sse: "manual",
      schema: {
        summary: "Stream session status and log events",
        tags: ["WhatsApp"],
        response: {
          200: {
            description:
              "Server-Sent Events stream with status and log events.",
            content: { "text/event-stream": { schema: { type: "string" } } },
          },
        },
      },
    },
    async (_request, reply) => {
      const unsubscribe = _request.access?.onRevoke(() => reply.sse.close());
      if (unsubscribe) reply.sse.onClose(unsubscribe);
      await events.subscribe(reply.sse, whatsapp.getState());
    },
  );

  app.post(
    "/connect",
    {
      schema: {
        summary: "Connect to WhatsApp",
        tags: ["WhatsApp"],
        response: { 200: sessionSchema, 500: apiErrorSchema },
      },
    },
    async (_request, reply) => {
      try {
        const state = await whatsapp.connect();
        events.log("Iniciando conexão com o WhatsApp…");
        return { ok: true, ...state };
      } catch (error) {
        return reply.code(500).send({ ok: false, error: errorMessage(error) });
      }
    },
  );

  app.post<{ Body: { phone: string | number } }>(
    "/pair",
    {
      schema: {
        summary: "Request a pairing code",
        tags: ["WhatsApp"],
        response: {
          200: {
            ...sessionSchema,
            required: [...sessionSchema.required, "code", "pretty"],
            properties: {
              ...sessionProperties,
              code: { type: "string" },
              pretty: { type: "string" },
            },
          },
          400: apiErrorSchema,
        },
        body: {
          type: "object",
          required: ["phone"],
          properties: {
            phone: {
              anyOf: [
                { type: "string", minLength: 1, maxLength: 64 },
                { type: "integer" },
              ],
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { phone } = request.body;
        const result = await whatsapp.requestPair(phone);
        events.log(
          `Código de emparelhamento gerado para +${String(phone).replace(/\D/g, "")}`,
        );
        return { ok: true, ...result, ...whatsapp.getState() };
      } catch (error) {
        return reply.code(400).send({ ok: false, error: errorMessage(error) });
      }
    },
  );

  app.post(
    "/disconnect",
    {
      schema: {
        summary: "Disconnect and remove the local session",
        tags: ["WhatsApp"],
        response: { 200: sessionSchema, 500: apiErrorSchema },
      },
    },
    async (_request, reply) => {
      try {
        const state = await whatsapp.disconnect();
        events.log("Desconectado. A sessão local foi apagada.");
        return { ok: true, ...state };
      } catch (error) {
        return reply.code(500).send({ ok: false, error: errorMessage(error) });
      }
    },
  );
};

export default whatsappRoutes;
