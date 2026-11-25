import { api, postJson } from "@lib/api";
import { whatsappSchema } from "@/features/whatsapp/schemas/whatsapp.schema";

export function connectWhatsApp() {
  return api("/api/connect", whatsappSchema, postJson({}));
}
