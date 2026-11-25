import { api } from "@lib/api";
import { sessionSchema } from "@/features/access/schemas/session.schema";

export function getSession(signal?: AbortSignal, key?: string) {
  return api("/api/session", sessionSchema, { signal }, key);
}
