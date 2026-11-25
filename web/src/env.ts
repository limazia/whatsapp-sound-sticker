import { z } from "zod";

const envSchema = z.object({
  BASE_URL: z.literal("/"),
});

export const environment = envSchema.safeParse(import.meta.env);
export const env = environment.success ? environment.data : undefined;
