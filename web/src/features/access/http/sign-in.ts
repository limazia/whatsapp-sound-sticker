import { api, postJson } from "@lib/api";
import { sessionSchema } from "@/features/access/schemas/session.schema";

export function signIn(code: string) {
  return api("/api/session", sessionSchema, postJson({ code }));
}
