import { z } from "zod";

import { api } from "@lib/api";

export function signOut() {
  return api("/api/session", z.object({ ok: z.literal(true) }), { method: "DELETE" });
}
