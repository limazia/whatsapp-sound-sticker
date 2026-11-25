import { api } from "@lib/api";
import { sessionSchema } from "@/features/access/schemas/session.schema";

export function getSession(signal: AbortSignal) {
  return api("/api/session", sessionSchema, { signal });
}
