import { createDecipheriv, createHash } from "node:crypto";

import { getMediaKeys } from "@/modules/whatsapp/client";
import type { MessageProto, StickerProto } from "@/modules/whatsapp/client";

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

export function createAudioCheck(onActivity?: (line: string) => void) {
  if (!onActivity || process.env.NODE_ENV === "production") return;
  const uploads = new Map<string, { encrypted?: string; sidecar?: string }>();
  return async (message: MessageProto, source: "envio" | "citação" | "recebida") => {
    const sticker = message.audioStickerMessage?.message?.stickerMessage ?? message.stickerMessage;
    const audio = sticker?.audioMessage;
    const imageHash = digest(sticker?.fileSha256);
    const audioHash = digest(audio?.fileSha256);
    if (!audio || !imageHash || !audioHash) return;
    const key = imageHash + ":" + audioHash;
    const encrypted = digest(audio.fileEncSha256) || undefined;
    const sidecar = audio.streamingSidecar?.length ? sha256(audio.streamingSidecar) : undefined;
    if (source === "envio") {
      uploads.delete(key);
      uploads.set(key, { encrypted, sidecar });
      const oldest = uploads.keys().next().value;
      if (uploads.size > 30 && oldest) uploads.delete(oldest);
      try { onActivity(`Verificação do primeiro envio no servidor: ${await checkUploadedAudio(audio)}`); }
      catch { onActivity("Falha ao baixar ou abrir no servidor a faixa do primeiro envio."); }
      return;
    }
    const original = uploads.get(key);
    if (!original) return;
    function compare(left?: string, right?: string) {
      return left && right ? (left === right ? "igual" : "diferente") : "indisponível";
    }
    onActivity(`Comparação com o último envio do site desta figurinha: imagem e áudio idênticos; upload do áudio: ${compare(original.encrypted, encrypted)}; verificação para reprodução: ${compare(original.sidecar, sidecar)}.`);
  };
}
