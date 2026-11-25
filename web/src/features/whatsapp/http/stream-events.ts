import { apiResponse } from "@lib/api";
import { logSchema, whatsappSchema } from "@/features/whatsapp/schemas/whatsapp.schema";

import type { WhatsAppState } from "@/features/whatsapp/schemas/whatsapp.schema";

interface WhatsAppEvents {
  onStatus: (state: WhatsAppState) => void;
  onLog: (message: string) => void;
}

export async function streamEvents(signal: AbortSignal, events: WhatsAppEvents) {
  const response = await apiResponse("/api/events", { headers: { Accept: "text/event-stream" }, signal });
  if (!response.body) throw new Error("Fluxo de eventos indisponível.");

  let buffer = "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, "\n");
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const event = /^event: ?(status|log)$/m.exec(frame)?.[1];
        const payload = /^data: ?(.+)$/m.exec(frame)?.[1];
        if (!event || !payload) continue;
        const data: unknown = JSON.parse(payload);
        if (event === "status") events.onStatus(whatsappSchema.parse(data));
        else events.onLog(logSchema.parse(data).message);
      }
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
