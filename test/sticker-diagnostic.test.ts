import assert from "node:assert/strict";
import { test } from "vitest";

import { describeIncomingSticker, describeSticker } from "@/modules/whatsapp/sticker-diagnostic";

test("distingue a faixa interna da externa sem registrar dados de acesso da mídia", () => {
  const sticker = { audioMessage: { directPath: "/private-path", url: "private-url", ptt: true, seconds: 4 } };
  for (const [location, message] of [
    ["externa", { stickerMessage: sticker, audioStickerMessage: { message: {} } }],
    ["interna", { audioStickerMessage: { message: { stickerMessage: sticker } } }],
  ] as const) {
    const result = describeSticker(message);
    assert.ok(result);
    assert.ok(result.includes(`áudio ${location}:`));
    assert.doesNotMatch(result, /private/);
  }
  assert.equal(describeSticker({}), null);
});

test("compara o áudio citado com o salvo sem expor os hashes", async () => {
  const { compareStickerReply } = await import("@/modules/whatsapp/sticker-diagnostic");
  const fileSha256 = Buffer.from("amostra");
  const original = { audioMessage: { fileSha256, fileEncSha256: Buffer.from("original") } };
  const saved = { audioMessage: { fileSha256, fileEncSha256: Buffer.from("novo") },
    contextInfo: { quotedMessage: { audioStickerMessage: { message: { stickerMessage: original } } } } };
  const comparison = compareStickerReply({ audioStickerMessage: { message: { stickerMessage: saved } } });
  assert.match(comparison ?? "", /áudio: igual, upload do áudio: diferente/);
  assert.equal(compareStickerReply({ stickerMessage: original }), null);
});

test("registra a chegada mesmo sem citação ou faixa de áudio na mensagem citada", () => {
  const saved = { audioMessage: { seconds: 5 } };
  for (const stickerMessage of [saved, { ...saved, contextInfo: { quotedMessage: { stickerMessage: {} } } }, {}]) {
    assert.match(describeIncomingSticker({ stickerMessage }) ?? "", /^Figurinha recebida/);
    assert.match(describeIncomingSticker({ audioStickerMessage: { message: { stickerMessage } } }) ?? "", /^Figurinha recebida/);
  }
  assert.equal(describeIncomingSticker({}), null);
});

test("identifica uma cópia sem áudio com a mesma imagem da citada", () => {
  const fileSha256 = Buffer.from("imagem");
  const quotedMessage = { stickerMessage: { fileSha256, audioMessage: { seconds: 4 } } };
  const received = { stickerMessage: { fileSha256, contextInfo: { quotedMessage } } };
  assert.match(describeIncomingSticker(received) ?? "", /citada: com áudio, recebida: sem áudio, imagem: igual/);
});
