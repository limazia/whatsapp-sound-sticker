import assert from "node:assert/strict";
import { createCipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { test, vi } from "vitest";

import { checkUploadedAudio } from "@/modules/whatsapp/audio-check";
import { getMediaKeys } from "@/modules/whatsapp/client";

test("confere os hashes do download e do áudio aberto", async () => {
  const mediaKey = randomBytes(32);
  const { cipherKey, iv, macKey } = await getMediaKeys(mediaKey, "audio");
  const clear = Buffer.from("OggS\0OpusHead");
  const cipher = createCipheriv("aes-256-cbc", cipherKey, iv);
  const ciphertext = Buffer.concat([cipher.update(clear), cipher.final()]);
  const tag = createHmac("sha256", macKey).update(iv).update(ciphertext).digest().subarray(0, 10);
  const bytes = Buffer.concat([ciphertext, tag]);
  const hash = (data: Uint8Array) => createHash("sha256").update(data).digest();
  const audio = { url: "https://mmg.whatsapp.net/test", mediaKey, fileEncSha256: hash(bytes), fileSha256: hash(clear) };
  const request = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(bytes));
  try {
    assert.match(await checkUploadedAudio(audio), /idêntico/);
    assert.match(await checkUploadedAudio({ ...audio, fileEncSha256: hash(clear) }), /criptografado/);
    assert.match(await checkUploadedAudio({ ...audio, fileSha256: hash(bytes) }), /descriptografada/);
    assert.match(await checkUploadedAudio({ ...audio, url: "https://example.invalid/" }), /CDN esperado/);
    assert.equal(request.mock.calls.length, 3);
  } finally {
    request.mockRestore();
  }
});
