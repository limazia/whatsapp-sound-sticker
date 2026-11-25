import { z } from "zod";

export const whatsappSchema = z.object({
  connection: z.enum(["disconnected", "connecting", "qr", "open"]),
  qrDataUrl: z.string().nullable(),
  pairingCode: z.string().nullable(),
  selfJid: z.string().nullable(),
  lastError: z.string().nullable(),
  hasAuth: z.boolean(),
});

export const logSchema = z.object({ message: z.string() });

export type WhatsAppState = z.infer<typeof whatsappSchema>;
