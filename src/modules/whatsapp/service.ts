import { join } from "node:path";
import { rm, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";

import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
} from "@/modules/whatsapp/client";
import type {
  MessageProto,
  Socket,
  StickerPayload,
} from "@/modules/whatsapp/client";
import { authDir } from "@/shared/paths";
import { errorMessage } from "@/shared/errors";

interface State {
  connection: "disconnected" | "connecting" | "qr" | "open";
  qrDataUrl: string | null;
  pairingCode: string | null;
  selfJid: string | null;
  lastError: string | null;
}

type ChangeHandler = (state: State & { hasAuth: boolean }) => void;

const silentLogger = {
  level: "warn",
  child() {
    return this;
  },
  trace() {},
  debug() {},
  info() {},
  warn(...args: unknown[]) {
    console.warn("[wa]", ...args);
  },
  error(...args: unknown[]) {
    console.error("[wa]", ...args);
  },
  fatal(...args: unknown[]) {
    console.error("[wa]", ...args);
  },
};

function emptyState(): State {
  return {
    connection: "disconnected",
    qrDataUrl: null,
    pairingCode: null,
    selfJid: null,
    lastError: null,
  };
}

function digitsOnly(phone: string | number) {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length < 10)
    throw new Error(
      "O número precisa incluir o DDI, por exemplo 5511999999999",
    );
  return d;
}

export function toJid(
  input: string | number | undefined,
  selfJid: string | null,
) {
  if (!input) {
    if (!selfJid)
      throw new Error("Sem destino e a conta ainda não está conectada");
    return selfJid;
  }
  const s = String(input).trim();
  if (s.includes("@")) return s;
  const digits = s.replace(/\D/g, "");
  if (digits.length < 8)
    throw new Error(`Número de destino inválido: ${input}`);
  return `${digits}@s.whatsapp.net`;
}

function summarizeProto(waMessage: unknown) {
  const message = waMessage as
    | (MessageProto & { message?: MessageProto })
    | undefined;
  const content = message?.message || message;
  const sticker = content?.stickerMessage || null;
  const audio = sticker?.audioMessage || null;
  const brief = (buffer: Uint8Array | string | null | undefined) => {
    if (!buffer) return null;
    return {
      type: typeof buffer === "string" ? "string" : "bytes",
      length: buffer.length,
    };
  };
  return {
    hasStickerMessage: Boolean(sticker),
    hasAudioMessage: Boolean(audio),
    stickerMessage: sticker && {
      mimetype: sticker.mimetype ?? null,
      width: sticker.width ?? null,
      height: sticker.height ?? null,
      isAnimated: sticker.isAnimated ?? null,
      fileLength:
        sticker.fileLength?.toString?.() ?? sticker.fileLength ?? null,
      hasUrl: Boolean(sticker.url),
      hasDirectPath: Boolean(sticker.directPath),
      fileSha256: brief(sticker.fileSha256),
      hasMediaKey: Boolean(sticker.mediaKey),
    },
    audioMessage: audio && {
      mimetype: audio.mimetype ?? null,
      ptt: audio.ptt ?? null,
      seconds: audio.seconds ?? null,
      fileLength: audio.fileLength?.toString?.() ?? audio.fileLength ?? null,
      hasUrl: Boolean(audio.url),
      hasDirectPath: Boolean(audio.directPath),
      hasMediaKey: Boolean(audio.mediaKey),
    },
  };
}

export function createWhatsAppManager({
  onChange,
}: { onChange?: ChangeHandler } = {}) {
  let sock: Socket | null = null;
  let state = emptyState();
  let connecting: Promise<ReturnType<typeof getState>> | undefined;
  let reconnect: NodeJS.Timeout | undefined;
  let disconnecting: Promise<ReturnType<typeof getState>> | undefined;
  let stopped = false;

  function emit(patch: Partial<State> = {}) {
    state = { ...state, ...patch };
    onChange?.(getState());
  }

  function getState() {
    return { ...state, hasAuth: existsSync(join(authDir(), "creds.json")) };
  }

  function detachSocket() {
    clearTimeout(reconnect);
    const current = sock;
    sock = null;
    return current;
  }

  async function startSocket() {
    detachSocket()?.end();
    emit({
      connection: "connecting",
      qrDataUrl: null,
      pairingCode: null,
      lastError: null,
    });

    await mkdir(authDir(), { recursive: true });
    const auth = await useMultiFileAuthState(authDir());
    if (stopped || disconnecting) return getState();

    const socket = makeWASocket({
      auth: auth.state,
      logger: silentLogger,
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });
    sock = socket;
    socket.ev.on("creds.update", async () => {
      if (sock === socket) await auth.saveCreds();
    });

    socket.ev.on(
      "connection.update",
      async ({ connection, lastDisconnect, qr }) => {
        if (sock !== socket) return;
        if (qr) {
          try {
            const { default: qrcode } = await import("qrcode");
            const qrDataUrl = await qrcode.toDataURL(qr, {
              margin: 1,
              width: 360,
              errorCorrectionLevel: "M",
            });
            if (sock === socket)
              emit({ connection: "qr", qrDataUrl, lastError: null });
          } catch (error) {
            if (sock === socket) emit({ lastError: errorMessage(error) });
          }
        }

        if (sock !== socket) return;
        if (connection === "open") {
          const selfJid = jidNormalizedUser(socket.user?.id);
          emit({
            connection: "open",
            qrDataUrl: null,
            pairingCode: null,
            selfJid,
            lastError: null,
          });
        }
        if (connection === "close") {
          const status = lastDisconnect?.error?.output?.statusCode;
          sock = null;
          if (status === DisconnectReason.loggedOut) {
            emit({
              ...emptyState(),
              lastError: "Sessão encerrada. Conecte de novo.",
            });
            return;
          }
          if (status === DisconnectReason.restartRequired) {
            emit({
              lastError: "O WhatsApp pediu para reconectar. Tentando de novo…",
            });
            reconnect = setTimeout(() => {
              void connect().catch(() => {});
            }, 800);
            reconnect.unref();
            return;
          }
          emit({
            connection: "disconnected",
            qrDataUrl: null,
            lastError: `Conexão fechada (código ${status ?? "desconhecido"}).`,
          });
        }
      },
    );

    return getState();
  }

  async function connect() {
    await disconnecting;
    if (stopped) throw new Error("O servidor está encerrando");
    if (sock) return getState();
    connecting ??= startSocket()
      .catch((error: unknown) => {
        emit({ ...emptyState(), lastError: errorMessage(error) });
        throw error;
      })
      .finally(() => {
        connecting = undefined;
      });
    return connecting;
  }

  async function requestPair(phone: string | number) {
    const digits = digitsOnly(phone);
    if (!sock) await connect();
    // pequeno atraso para o socket começar a negociar
    await new Promise((r) => setTimeout(r, 400));
    if (!sock?.requestPairingCode)
      throw new Error("Não foi possível pedir o código agora. Tente de novo.");
    const current = sock;
    const code = await current.requestPairingCode(digits);
    if (sock !== current)
      throw new Error("A conexão foi encerrada. Tente de novo.");
    const pretty = String(code)
      .replace(/(.{4})/g, "$1-")
      .replace(/-$/, "");
    emit({
      pairingCode: pretty || code,
      qrDataUrl: null,
      connection: state.connection === "open" ? "open" : "connecting",
    });
    return { code, pretty: pretty || code };
  }

  async function logout() {
    const current = detachSocket();
    await connecting?.catch(() => {});
    if (current) {
      try {
        await current.logout();
      } catch {}
      try {
        current.end();
      } catch {}
    }
    const directory = authDir();
    if (existsSync(directory)) {
      const entries = await readdir(directory);
      await Promise.all(entries.map((entry) => rm(join(directory, entry), { recursive: true, force: true })));
    }
    state = emptyState();
    emit();
    return getState();
  }

  function disconnect() {
    disconnecting ??= logout().finally(() => {
      disconnecting = undefined;
    });
    return disconnecting;
  }

  async function stop() {
    stopped = true;
    const current = detachSocket();
    try {
      current?.end();
    } catch {}
    await connecting?.catch(() => {});
    await disconnecting?.catch(() => {});
  }

  async function sendSticker({
    stickerPath,
    audioPath,
    isAnimated,
    to,
    alsoSilent,
  }: {
    stickerPath: string;
    audioPath: string | null;
    isAnimated: boolean;
    to?: string | number;
    alsoSilent: boolean;
  }) {
    if (!sock || state.connection !== "open") {
      throw new Error("Conecte o WhatsApp antes de enviar");
    }
    const socket = sock;
    const jid = toJid(to, state.selfJid);
    const stickerUrl = stickerPath;
    const results = [];

    if (alsoSilent) {
      const silentMsg = await socket.sendMessage(jid, {
        sticker: { url: stickerUrl },
        isAnimated: Boolean(isAnimated),
      });
      results.push({ kind: "silent", proto: summarizeProto(silentMsg) });
    }

    const payload: StickerPayload = {
      sticker: { url: stickerUrl },
      isAnimated: Boolean(isAnimated),
    };
    if (audioPath) {
      payload.stickerAudio = { url: audioPath };
    }
    const soundMsg = await socket.sendMessage(jid, payload);
    const proto = summarizeProto(soundMsg);
    results.push({ kind: audioPath ? "sound" : "silent", proto });
    if (!proto.hasStickerMessage) {
      throw new Error(
        "O WhatsApp aceitou o envio, mas a mensagem não veio como figurinha",
      );
    }
    return { jid, results };
  }

  return { getState, connect, requestPair, disconnect, sendSticker, stop };
}
