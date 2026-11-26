import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import * as plogme from "plogme";
import type { WASocket } from "plogme";

interface ConnectionUpdate {
  connection?: "connecting" | "open" | "close";
  lastDisconnect?: { error?: { output?: { statusCode?: number } } };
  qr?: string;
}

type MediaUpload = (path: string, options: { mediaType: string; fileEncSha256B64: string }) => Promise<{ mediaUrl: string; directPath: string }>;

type Socket = Pick<WASocket, "sendMessage"> & {
  ws: { on(event: "CB:message", listener: (node: {
    attrs: { id?: string; type?: string };
    content?: Uint8Array | { tag: string; attrs: { mediatype?: string } }[];
  }) => void): void };
  waUploadToServer: MediaUpload;
  relayMessage(jid: string, message: MessageProto, options: {
    messageId: string; mediaTypeOverride: string; additionalAttributes: { type: string };
  }): Promise<unknown>;
  onWhatsApp(jid: string): Promise<{ exists: boolean; jid: string }[] | undefined>;
  user?: { id?: string; lid?: string };
  end(): void;
  logout(): Promise<void>;
  requestPairingCode(phone: string): Promise<string>;
  ev: {
    on(event: "messages.upsert", listener: (event: {
      messages: { messageTimestamp?: number | { toString(): string } | null; key: { id?: string | null; fromMe?: boolean | null; remoteJid?: string | null }; message?: MessageProto | null }[];
      type: string;
    }) => void): void;
    on(event: "messages.update", listener: (updates: { key: { id?: string | null }; update: { status?: number | null } }[]) => void): void;
    on(event: "creds.update", listener: () => Promise<void>): void;
    on(
      event: "connection.update",
      listener: (update: ConnectionUpdate) => void | Promise<void>,
    ): void;
  };
};

interface MediaProto {
  fileSha256?: Uint8Array | string | null;
  fileEncSha256?: Uint8Array | string | null;
  mimetype?: string | null;
  fileLength?: number | bigint | { toString(): string } | null;
  url?: string | null;
  directPath?: string | null;
  mediaKey?: Uint8Array | null;
}

export interface StickerProto extends MediaProto {
  stickerSentTs?: number | { toString(): string } | null;
  width?: number | null;
  height?: number | null;
  isAnimated?: boolean | null;
  contextInfo?: { quotedMessage?: MessageProto | null };
  audioMessage?: MediaProto & { ptt?: boolean | null; seconds?: number | null; streamingSidecar?: Uint8Array; contextInfo?: object };
}

export interface MessageProto {
  extendedTextMessage?: { text?: string | null; contextInfo?: { quotedMessage?: MessageProto | null } };
  messageContextInfo?: object | null;
  audioStickerMessage?: { message?: MessageProto | null } | null;
  deviceSentMessage?: { message?: MessageProto | null } | null;
  ephemeralMessage?: { message?: MessageProto | null } | null;
  stickerMessage?: StickerProto | null;
}

export interface StickerPayload extends Record<string, unknown> {
  sticker: { url: string };
  stickerAudio?: { url: string };
  isAnimated: boolean;
}

// The fork exposes these Baileys APIs at runtime, but its declaration file omits them.
const client = plogme as unknown as {
  default(config: Record<string, unknown>): Socket;
  useMultiFileAuthState(
    path: string,
  ): Promise<{ state: unknown; saveCreds(): Promise<void> }>;
  DisconnectReason: { loggedOut: number; restartRequired: number };
  generateMessageIDV2(userId?: string): string;
  jidNormalizedUser(jid?: string): string;
  getMediaKeys(key: Uint8Array, kind: "audio"): Promise<{ iv: Uint8Array; macKey: Uint8Array; cipherKey: Uint8Array }>;
  prepareWAMessageMedia(
    payload: { audio: { url: string }; mimetype: string },
    options: { upload: MediaUpload; logger: Record<string, unknown> },
  ): Promise<{ audioMessage?: NonNullable<StickerProto["audioMessage"]> }>;
  generateWAMessageFromContent(jid: string, message: MessageProto, options: { messageId: string; userJid?: string }): { message: MessageProto };
  generateWAMessageContent(
    payload: StickerPayload,
    options: {
      upload: MediaUpload;
      logger: Record<string, unknown>;
    },
  ): Promise<MessageProto>;
};

export const {
  default: makeWASocket,
  getMediaKeys,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  generateMessageIDV2,
  generateWAMessageFromContent,
  generateWAMessageContent,
} = client;

export type { Socket };

export async function prepareSoundSticker(payload: StickerPayload, upload: MediaUpload, logger: Record<string, unknown>) {
  const { stickerAudio, ...sticker } = payload;
  if (!stickerAudio) throw new Error("A figurinha precisa de uma faixa de áudio.");
  const { stickerMessage, messageContextInfo } = await generateWAMessageContent(
    { ...sticker, width: 512, height: 512, stickerSentTs: Date.now() }, { upload, logger },
  );
  if (!stickerMessage) throw new Error("Não foi possível preparar a figurinha.");

  let uploadedAudio: Buffer | undefined;
  const { audioMessage } = await client.prepareWAMessageMedia(
    { audio: stickerAudio, mimetype: "audio/ogg; codecs=opus" },
    { logger, upload: async (path, options) => {
      uploadedAudio = await readFile(path);
      return upload(path, options);
    } },
  );
  if (!uploadedAudio || !audioMessage?.mediaKey) throw new Error("Não foi possível preparar a faixa de áudio.");

  const { iv, macKey } = await client.getMediaKeys(audioMessage.mediaKey, "audio");
  const chunkSize = 64 * 1024;
  const tags: Buffer[] = [];
  for (let offset = 0; offset < uploadedAudio.length; offset += chunkSize) {
    const previousBlock = offset === 0 ? iv : uploadedAudio.subarray(offset - 16, offset);
    const chunk = uploadedAudio.subarray(offset, offset + chunkSize);
    tags.push(createHmac("sha256", macKey).update(previousBlock).update(chunk).digest().subarray(0, 10));
  }
  audioMessage.streamingSidecar = Buffer.concat(tags);
  audioMessage.contextInfo = {};
  stickerMessage.audioMessage = audioMessage;
  return { audioStickerMessage: { message: { stickerMessage } }, messageContextInfo };
}
