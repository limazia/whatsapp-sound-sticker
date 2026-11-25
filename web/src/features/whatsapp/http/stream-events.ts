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
  for await (const chunk of response.body.pipeThrough(new TextDecoderStream())) {
    buffer += chunk;
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const event = /^event: (status|log)\ndata: (.+)$/m.exec(frame);
      if (!event?.[2]) continue;
      const data: unknown = JSON.parse(event[2]);
      if (event[1] === "status") {
        const status = whatsappSchema.safeParse(data);
        if (status.success) events.onStatus(status.data);
      } else {
        const log = logSchema.safeParse(data);
        if (log.success) events.onLog(log.data.message);
      }
    }
  }
}
