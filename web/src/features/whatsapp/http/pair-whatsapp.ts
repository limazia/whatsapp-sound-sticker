import { api, postJson } from "@lib/api";
import { whatsappSchema } from "@/features/whatsapp/schemas/whatsapp.schema";

export function pairWhatsApp(phone: string) {
  return api("/api/pair", whatsappSchema, postJson({ phone }));
}
