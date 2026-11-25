import type { FastifyPluginAsync } from "fastify";

import { ffmpegStatus } from "@/shared/ffmpeg";
import { ffmpegStatusSchema } from "@/shared/http-schemas";

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/health",
    {
      schema: {
        summary: "Check API and FFmpeg availability",
        tags: ["Health"],
        security: [],
        response: {
          200: {
            type: "object",
            required: ["ok", "ffmpeg"],
            properties: { ok: { const: true }, ffmpeg: ffmpegStatusSchema },
          },
        },
      },
    },
    async () => ({ ok: true, ffmpeg: ffmpegStatus() }),
  );
};

export default healthRoutes;
