import { api } from "@lib/api";
import { preparedSchema } from "@/features/stickers/schemas/prepared.schema";

export function prepareSticker(body: FormData) {
  return api("/api/prepare", preparedSchema, { method: "POST", body });
}
