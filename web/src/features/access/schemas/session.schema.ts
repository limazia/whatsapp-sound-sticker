import { z } from "zod";

export const sessionSchema = z.object({
  role: z.enum(["admin", "friend"]).nullable(),
  whatsappConnected: z.boolean(),
});

export type Session = z.infer<typeof sessionSchema>;
