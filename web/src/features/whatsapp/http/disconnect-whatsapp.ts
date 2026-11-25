import { api, postJson } from "@lib/api";
import { whatsappSchema } from "@/features/whatsapp/schemas/whatsapp.schema";

export function disconnectWhatsApp() {
  return api("/api/disconnect", whatsappSchema, postJson({}));
}
