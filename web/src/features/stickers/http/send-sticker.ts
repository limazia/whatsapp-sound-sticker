import { z } from "zod";

import { api, postJson } from "@lib/api";

interface SendStickerInput {
  id: string;
  to: string;
  alsoSilent: boolean;
}

export function sendSticker(body: SendStickerInput) {
  return api("/api/send", z.object({
    ok: z.literal(true),
    results: z.array(z.object({
      kind: z.enum(["sound", "silent"]),
      proto: z.object({ hasAudioMessage: z.boolean() }),
    })),
  }), postJson(body));
}
