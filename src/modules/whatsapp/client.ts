import * as plogme from "plogme";
import type { WASocket } from "plogme";

interface ConnectionUpdate {
  connection?: "connecting" | "open" | "close";
  lastDisconnect?: { error?: { output?: { statusCode?: number } } };
  qr?: string;
}

type Socket = Pick<WASocket, "sendMessage"> & {
  user?: { id?: string };
  end(): void;
  logout(): Promise<void>;
  requestPairingCode(phone: string): Promise<string>;
  ev: {
    on(event: "creds.update", listener: () => Promise<void>): void;
    on(
      event: "connection.update",
      listener: (update: ConnectionUpdate) => void | Promise<void>,
    ): void;
  };
};

interface MediaProto {
  mimetype?: string | null;
  fileLength?: number | bigint | { toString(): string } | null;
  url?: string | null;
  directPath?: string | null;
  mediaKey?: Uint8Array | null;
}

interface StickerProto extends MediaProto {
  width?: number | null;
  height?: number | null;
  isAnimated?: boolean | null;
  fileSha256?: Uint8Array | string | null;
  audioMessage?: MediaProto & { ptt?: boolean | null; seconds?: number | null };
}

export interface MessageProto {
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
  jidNormalizedUser(jid?: string): string;
  generateWAMessageContent(
    payload: StickerPayload,
    options: {
      upload: () => Promise<{ mediaUrl: string; directPath: string }>;
      logger: Record<string, unknown>;
    },
  ): Promise<MessageProto>;
};

export const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  generateWAMessageContent,
} = client;

export type { Socket };
