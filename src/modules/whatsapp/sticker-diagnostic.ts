import type { MessageProto } from "@/modules/whatsapp/client";

export function describeSticker(message: MessageProto) {
  const inner = message.audioStickerMessage?.message;
  if (!message.stickerMessage && !message.audioStickerMessage) return null;
  const hasAudio = inner?.stickerMessage?.audioMessage || message.stickerMessage?.audioMessage;
  const parts = [
    hasAudio ? "Com faixa de áudio" : "Sem faixa de áudio",
    `campos externos: ${Object.keys(message).join(", ")}`,
    `campos internos: ${inner ? Object.keys(inner).join(", ") : "nenhum"}`,
  ];
  for (const [name, sticker] of [
    ["externa", message.stickerMessage],
    ["interna", inner?.stickerMessage],
  ] as const) {
    if (!sticker) continue;
    const audio = sticker.audioMessage;
    parts.push(`figurinha ${name}: ${Object.keys(sticker).join(", ")}`);
    if (audio) {
      parts.push(`áudio ${name}: ${Object.keys(audio).join(", ")} (${audio.mimetype ?? "tipo desconhecido"}, ptt=${audio.ptt ?? "ausente"}, ${audio.seconds ?? "?"} s)`);
    }
  }
  return parts.join(" | ");
}

export function compareStickerReply(message: MessageProto) {
  const saved = message.audioStickerMessage?.message?.stickerMessage ?? message.stickerMessage;
  const quoted = saved?.contextInfo?.quotedMessage;
  const original = quoted?.audioStickerMessage?.message?.stickerMessage ?? quoted?.stickerMessage;
  if (!saved || !original) return null;
  const originalAudio = quoted?.audioStickerMessage?.message?.stickerMessage?.audioMessage ?? quoted?.stickerMessage?.audioMessage;
  const savedAudio = message.audioStickerMessage?.message?.stickerMessage?.audioMessage ?? message.stickerMessage?.audioMessage;

  function compare(a?: Uint8Array | string | null, b?: Uint8Array | string | null) {
    if (!a?.length || !b?.length) return "indisponível";
    const bytes = (value: Uint8Array | string) => typeof value === "string" ? Buffer.from(value, "base64") : Buffer.from(value);
    return bytes(a).equals(bytes(b)) ? "igual" : "diferente";
  }
  if (!savedAudio || !originalAudio) {
    return `citada: ${originalAudio ? "com áudio" : "sem áudio"}, recebida: ${savedAudio ? "com áudio" : "sem áudio"}, imagem: ${compare(saved.fileSha256, original.fileSha256)}`;
  }
  return [
    `imagem: ${compare(saved.fileSha256, original.fileSha256)}`,
    `áudio: ${compare(savedAudio.fileSha256, originalAudio.fileSha256)}`,
    `upload do áudio: ${compare(savedAudio.fileEncSha256, originalAudio.fileEncSha256)}`,
    `verificação do áudio: ${compare(savedAudio.streamingSidecar, originalAudio.streamingSidecar)}`,
  ].join(", ");
}

export function describeIncomingSticker(message: MessageProto, transport?: string) {
  const description = describeSticker(message);
  if (!description) return null;
  const comparison = compareStickerReply(message);
  const status = comparison
    ? `Figurinha recebida. Comparação com a citada. ${comparison}.`
    : "Figurinha recebida.";
  return `${status} Transporte: ${transport ?? "indisponível"}. ${description}`;
}
