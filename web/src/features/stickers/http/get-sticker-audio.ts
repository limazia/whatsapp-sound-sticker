import { apiResponse } from "@lib/api";

export async function getStickerAudio(path: string, signal: AbortSignal) {
  return (await apiResponse(path, { signal })).blob();
}
