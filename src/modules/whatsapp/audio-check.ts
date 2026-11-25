import { createDecipheriv, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { getMediaKeys } from "@/modules/whatsapp/client";
import type { MessageProto, StickerProto } from "@/modules/whatsapp/client";
import { tmpDir } from "@/shared/paths";

const maxBytes = 512 * 1024;
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function digest(value?: Uint8Array | string | null) {
  return typeof value === "string" ? Buffer.from(value, "base64").toString("hex") : value && Buffer.from(value).toString("hex");
}

export async function checkUploadedAudio(audio: NonNullable<StickerProto["audioMessage"]>) {
  if (!audio.url || !audio.mediaKey) return "A citação veio sem o endereço ou a chave do áudio.";
  const url = new URL(audio.url);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".whatsapp.net") || url.port || url.username || url.password) {
    return "O endereço da mídia não corresponde ao CDN esperado.";
  }
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(10000), headers: { Origin: "https://web.whatsapp.com" } });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    return `Download do áudio retornou HTTP ${response.status}.`;
  }
  const blocks: Uint8Array[] = [];
  let size = 0;
  for await (const block of response.body) {
    size += block.byteLength;
    if (size > maxBytes) return "Download excedeu o tamanho esperado.";
    blocks.push(block);
  }
  const encrypted = Buffer.concat(blocks);
  if (sha256(encrypted) !== digest(audio.fileEncSha256)) return "Os bytes baixados diferem do áudio criptografado da mensagem.";
  const { cipherKey, iv } = await getMediaKeys(audio.mediaKey, "audio");
  const decipher = createDecipheriv("aes-256-cbc", cipherKey, iv);
  const clear = Buffer.concat([decipher.update(encrypted.subarray(0, -10)), decipher.final()]);
  if (sha256(clear) !== digest(audio.fileSha256)) return "A faixa descriptografada difere da original.";
  if (!clear.subarray(0, 4).equals(Buffer.from("OggS")) || !clear.subarray(0, 256).includes(Buffer.from("OpusHead"))) {
    return "O arquivo recuperado não tem cabeçalho Ogg Opus.";
  }
  return "Download e descriptografia confirmados. O Ogg Opus recuperado é idêntico ao original.";
}

export async function createAudioCheck(onActivity?: (line: string) => void) {
  if (!onActivity || process.env.NODE_ENV === "production") return;
  const marker = await readFile(join(tmpDir(), "audio-check.json"), "utf8").catch(() => "");
  if (!marker) return;
  let check;
  try { check = JSON.parse(marker); } catch { return; }
  if (!/^[a-f0-9]{64}$/.test(check?.sha256) || !Number.isFinite(check.until) || check.until <= Date.now()) return;
  let running = false;
  let checkedOutgoing = false;
  return async (message: MessageProto, source: "envio" | "citação") => {
    if (running || check.until <= Date.now()) return;
    if (source === "envio" && checkedOutgoing) return;
    const audio = (message.audioStickerMessage?.message?.stickerMessage ?? message.stickerMessage)?.audioMessage;
    if (!audio || (source === "citação" && digest(audio.fileSha256) !== check.sha256)) {
      onActivity("Diagnóstico: a citação não contém a faixa do último teste.");
      return;
    }
    if (source === "envio") checkedOutgoing = true;
    running = true;
    try { onActivity(`Diagnóstico do ${source === "envio" ? "envio original" : "áudio citado"}: ${await checkUploadedAudio(audio)}`); }
    catch { onActivity("Diagnóstico: falha ao baixar ou abrir a faixa no servidor."); }
    finally { running = false; }
  };
}
