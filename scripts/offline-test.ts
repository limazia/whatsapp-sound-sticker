import { mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { generateWAMessageContent, generateWAMessageFromContent, prepareSoundSticker } from "@/modules/whatsapp/client";
import { convertToSticker } from "@/modules/stickers/convert";
import { getFfmpegPath } from "@/shared/ffmpeg";
import { tmpDir } from "@/shared/paths";

const input = process.argv[2];
if (!input || !existsSync(input)) {
  console.error("Usage: yarn offline-test /path/to/video-or-image");
  process.exit(1);
}

const logger = {
  level: "silent",
  child() {
    return this;
  },
  trace() {},
  debug() {},
  info() {},
  warn() {},
  error() {},
  fatal() {},
};
const fakeUpload = async () => ({
  mediaUrl: "https://example.invalid/media",
  directPath: "/invalid",
});

function ok(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
  console.log("OK:", msg);
}

const ffmpeg = getFfmpegPath();
ok(existsSync(ffmpeg), `FFmpeg found: ${ffmpeg}`);

const workDir = join(tmpDir(), "offline-test");
await mkdir(workDir, { recursive: true });
console.log("Converting", input);
const result = await convertToSticker({
  mediaPath: input,
  mediaName: input,
  workDir,
});
ok(
  existsSync(result.stickerPath),
  `sticker generated (${(result.stickerBytes / 1024).toFixed(1)} KB)`,
);
ok(result.width === 512 && result.height === 512, "512×512");
if (result.isAnimated) {
  ok(result.stickerBytes <= 500 * 1024, "animated ≤ 500 KB");
} else {
  ok(result.stickerBytes <= 100 * 1024, "static ≤ 100 KB");
}

const silent = await generateWAMessageContent(
  { sticker: { url: result.stickerPath }, isAnimated: result.isAnimated },
  { upload: fakeUpload, logger },
);
ok(silent.stickerMessage, "silent proto has stickerMessage");
ok(!silent.stickerMessage.audioMessage, "silent proto has no audioMessage");

if (result.audioPath) {
  ok((await stat(result.audioPath)).size > 1000, "ogg extracted");
  ok(
    result.audioSeconds > 0 && result.audioSeconds <= 10.05,
    `audio ${result.audioSeconds.toFixed(2)} s`,
  );
  const sound = await prepareSoundSticker(
    {
      sticker: { url: result.stickerPath },
      stickerAudio: { url: result.audioPath },
      isAnimated: result.isAnimated,
    },
    fakeUpload, logger,
  );
  const outgoing = generateWAMessageFromContent("5500000000000@s.whatsapp.net", sound, { messageId: "offline" });
  const sticker = outgoing.message.audioStickerMessage?.message?.stickerMessage;
  ok(sticker, "sound proto has stickerMessage");
  ok(Number(sticker.stickerSentTs) > 0, "sticker send timestamp present");
  ok(sticker.audioMessage, "stickerMessage.audioMessage present");
  ok(sticker.audioMessage.ptt == null, "audio is not marked as a voice note");
  ok(sticker.audioMessage.streamingSidecar?.length, "streaming sidecar present");
  console.log("sticker mimetype:", sticker.mimetype);
  console.log("audio mimetype:", sticker.audioMessage.mimetype);
  ok(sticker.width === 512 && sticker.height === 512, "prepared message includes sticker dimensions");
  ok(Boolean(sticker.isAnimated) === (result.frameCount > 1), "animation flag matches encoded WebP frames");
}

if (result.warnings.length) console.log("warnings:", result.warnings);
console.log("\nOffline test finished. No WhatsApp socket was opened.");
