import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { MultipartFile } from "@fastify/multipart";
import type { FastifyPluginAsync } from "fastify";

import { errorMessage } from "@/shared/errors";
import { apiErrorSchema } from "@/shared/http-schemas";
import { UnknownRecipientError } from "@/modules/whatsapp/service";
import { convertToSticker } from "@/modules/stickers/convert";

interface SendBody {
  id: string;
  to: string | number;
  alsoSilent?: boolean;
}

const stickerRoutes: FastifyPluginAsync = async (app) => {
  const { events, whatsapp } = app;
  const jobsRoot = await mkdtemp(join(tmpdir(), "soundsticker-"));
  type Job = Awaited<ReturnType<typeof convertToSticker>> & {
    owner: string;
    expires: NodeJS.Timeout;
    sending: boolean;
  };
  const jobs = new Map<string, Job>();
  let conversions = 0;
  const jobLifetime = 30 * 60 * 1000;

  app.addHook("onClose", async () => {
    for (const job of jobs.values()) clearTimeout(job.expires);
    jobs.clear();
    await rm(jobsRoot, { recursive: true, force: true });
  });

  app.post(
    "/prepare",
    {
      config: {
        access: "friend",
        rateLimit: { max: 8, timeWindow: "1 minute" },
        swaggerTransform: ({ schema, url }) => ({
          url,
          schema: {
            ...schema,
            consumes: ["multipart/form-data"],
            body: {
              type: "object",
              required: ["media"],
              properties: {
                media: {
                  type: "string",
                  format: "binary",
                  description: "Source video or image.",
                },
                audio: {
                  type: "string",
                  format: "binary",
                  description: "Optional replacement audio.",
                },
              },
            },
          },
        }),
      },
      schema: {
        summary: "Prepare a sticker from a video or image",
        description: "Accepts files up to 80 MB each.",
        tags: ["Stickers"],
        response: {
          200: {
            type: "object",
            required: [
              "ok",
              "id",
              "isAnimated",
              "stickerBytes",
              "audioSeconds",
              "hasAudio",
              "warnings",
              "preview",
              "audioUrl",
            ],
            properties: {
              ok: { const: true },
              id: { type: "string", format: "uuid" },
              isAnimated: { type: "boolean" },
              stickerBytes: { type: "integer" },
              audioSeconds: { type: "number" },
              hasAudio: { type: "boolean" },
              warnings: { type: "array", items: { type: "string" } },
              preview: { type: "string", description: "WebP data URL." },
              audioUrl: { type: ["string", "null"] },
            },
          },
          400: apiErrorSchema,
          406: apiErrorSchema,
          413: apiErrorSchema,
          415: apiErrorSchema,
          429: apiErrorSchema,
          500: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const access = request.access!;
      if (conversions >= 2 || jobs.size >= 100) {
        return reply.code(429).send({ ok: false, error: "Conversões ocupadas. Tente de novo em instantes." });
      }
      conversions++;
      try {
        let files: Awaited<ReturnType<typeof request.saveRequestFiles>>["files"];
        try {
          const uploads = await request.saveRequestFiles();
          files = uploads.files;
        } catch (error) {
          if (error instanceof app.multipartErrors.RequestFileTooLargeError) {
            return reply
              .code(413)
              .send({ ok: false, error: "Cada arquivo deve ter até 80 MB." });
          }
          throw error;
        }

        const uploads: Partial<
          Record<"media" | "audio", MultipartFile & { filepath: string }>
        > = {};
        for (const file of files) {
          const field = file.fieldname;
          if ((field !== "media" && field !== "audio") || uploads[field]) {
            return reply.code(400).send({
              ok: false,
              error: "Envie até um arquivo de mídia e um de áudio.",
            });
          }
          uploads[field] = file;
        }
        const { media, audio } = uploads;
        if (!media) {
          return reply
            .code(400)
            .send({ ok: false, error: "Escolha um vídeo ou uma imagem" });
        }

        const id = randomUUID();
        const workDir = join(jobsRoot, id);
        try {
          events.log("Convertendo para figurinha…");
          const result = await convertToSticker({
            mediaPath: media.filepath,
            mediaName: media.filename,
            audioPath: audio?.filepath,
            workDir,
          });
          const sticker = await readFile(result.stickerPath);
          const expires = setTimeout(() => {
            jobs.delete(id);
            void rm(workDir, { recursive: true, force: true }).catch((error: unknown) => {
              app.log.warn(error, "Falha ao remover figurinha temporária");
            });
          }, jobLifetime);
          expires.unref();
          jobs.set(id, { ...result, owner: access.id, expires, sending: false });
          const duration = result.audioPath
            ? `, áudio ${result.audioSeconds.toFixed(1)} s`
            : "";
          events.log(
            `Figurinha ${result.isAnimated ? "animada" : "estática"} pronta (${result.frameCount} quadro(s), ${(result.stickerBytes / 1024).toFixed(1)} KB${duration}).`,
          );
          return {
            ok: true,
            id,
            isAnimated: result.isAnimated,
            stickerBytes: result.stickerBytes,
            audioSeconds: result.audioSeconds,
            hasAudio: Boolean(result.audioPath),
            warnings: result.warnings,
            preview: `data:image/webp;base64,${sticker.toString("base64")}`,
            audioUrl: result.audioPath ? `/api/jobs/${id}/audio` : null,
          };
        } catch (error) {
          const message = errorMessage(error);
          events.log(`Falha na conversão: ${message}`);
          await rm(workDir, { recursive: true, force: true }).catch(() => {});
          return reply.code(500).send({ ok: false, error: access.role === "admin" ? message : "Falha ao converter a mídia." });
        }
      } finally {
        conversions--;
      }
    },
  );

  app.post<{ Body: SendBody }>(
    "/send",
    {
      config: { access: "friend", rateLimit: { max: 8, timeWindow: "1 minute" } },
      schema: {
        summary: "Send a prepared sticker",
        tags: ["Stickers"],
        response: {
          200: {
            type: "object",
            required: ["ok", "jid", "results"],
            properties: {
              ok: { const: true },
              jid: { type: "string" },
              results: {
                type: "array",
                items: { type: "object", additionalProperties: true },
              },
            },
          },
          400: apiErrorSchema,
          409: apiErrorSchema,
          500: apiErrorSchema,
        },
        body: {
          type: "object",
          required: ["id", "to"],
          properties: {
            id: { type: "string", minLength: 1, maxLength: 64 },
            to: {
              anyOf: [{ type: "string", pattern: "\\S", maxLength: 128 }, { type: "integer", minimum: 1 }],
            },
            alsoSilent: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const { id, to, alsoSilent } = request.body;
      const job = jobs.get(id);
      const access = request.access!;
      if (!job || job.owner !== access.id) {
        return reply
          .code(400)
          .send({ ok: false, error: "Prepare a figurinha antes de enviar" });
      }

      if (access.role === "friend" &&
          (!to || !/^\+?[\d ().-]+$/.test(String(to)) ||
            !/^\d{8,15}$/.test(String(to).replace(/\D/g, "")))) {
        return reply.code(400).send({ ok: false, error: "Informe o número de destino com DDI." });
      }
      if (job.sending) {
        return reply.code(409).send({ ok: false, error: "Esta figurinha já está sendo enviada." });
      }
      job.sending = true;
      job.expires.refresh();
      try {
        events.log(`Enviando para ${to}…`);
        const result = await whatsapp.sendSticker({
          stickerPath: job.stickerPath,
          audioPath: job.audioPath,
          isAnimated: job.isAnimated,
          to,
          alsoSilent: Boolean(alsoSilent),
        });
        const sound =
          result.results.find((entry) => entry.kind === "sound") ||
          result.results.at(-1);
        if (sound?.proto.hasAudioMessage)
          events.log("Mensagem encaminhada com áudio. Aguardando confirmação de entrega.");
        else if (job.audioPath)
          events.log("Mensagem encaminhada sem a faixa de áudio preparada.");
        else events.log("Mensagem encaminhada sem áudio. Aguardando confirmação de entrega.");
        return { ok: true, ...result };
      } catch (error) {
        const message = errorMessage(error);
        events.log(`Falha no envio: ${message}`);
        if (error instanceof UnknownRecipientError) return reply.code(400).send({ ok: false, error: message });
        return reply.code(500).send({ ok: false, error: access.role === "admin" ? message : "Falha ao enviar. Confira a conexão do WhatsApp." });
      } finally {
        job.sending = false;
      }
    },
  );

  const oggContent = {
    "audio/ogg": { schema: { type: "string", format: "binary" } },
  };
  app.get<{ Params: { id: string } }>(
    "/jobs/:id/audio",
    {
      config: { access: "friend" },
      schema: {
        summary: "Download the Ogg Opus audio of a prepared sticker",
        tags: ["Stickers"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: { description: "Ogg Opus audio.", content: oggContent },
          206: { description: "Requested byte range.", content: oggContent },
          404: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const job = jobs.get(request.params.id);
      const audioPath = job?.owner === request.access?.id ? job?.audioPath : null;
      if (!audioPath || !existsSync(audioPath)) {
        return reply
          .code(404)
          .send({ ok: false, error: "Áudio não encontrado" });
      }
      return reply
        .type("audio/ogg")
        .header("Cache-Control", "no-store")
        .sendFile(basename(audioPath), dirname(audioPath), {
          cacheControl: false,
        });
    },
  );
};

export default stickerRoutes;
