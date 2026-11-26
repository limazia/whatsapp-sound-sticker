import { z } from "zod";

export const preparedSchema = z.object({
  id: z.string(),
  preview: z.string(),
  audioUrl: z.string().startsWith("/api/jobs/").nullable(),
  audioSeconds: z.number(),
  isAnimated: z.boolean(),
  stickerBytes: z.number(),
  warnings: z.array(z.string()),
});

export type Prepared = z.infer<typeof preparedSchema>;
