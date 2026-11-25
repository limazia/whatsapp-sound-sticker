import { join } from "node:path";
import { rm, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";

import {
  makeWASocket,
  prepareSoundSticker,
  generateMessageIDV2,
  generateWAMessageFromContent,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
} from "@/modules/whatsapp/client";
import type {
  MessageProto,
  Socket,
  StickerPayload,
} from "@/modules/whatsapp/client";
import { describeIncomingSticker, describeSticker } from "@/modules/whatsapp/sticker-diagnostic";
import { createAudioCheck } from "@/modules/whatsapp/audio-check";
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

export function toJid(input: string | number) {
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
  const sticker = content?.audioStickerMessage?.message?.stickerMessage ?? content?.stickerMessage ?? null;
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

export class UnknownRecipientError extends Error {}

export function createWhatsAppManager({
  onChange,
  onActivity,
}: { onChange?: ChangeHandler; onActivity?: (message: string) => void } = {}) {
  let sock: Socket | null = null;
  let checkAudio: Awaited<ReturnType<typeof createAudioCheck>>;
  let state = emptyState();
  let connecting: Promise<ReturnType<typeof getState>> | undefined;
  let reconnect: NodeJS.Timeout | undefined;
  let disconnecting: Promise<ReturnType<typeof getState>> | undefined;
  let stopped = false;
  const outgoing = new Map<string, string>();

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
    checkAudio = await createAudioCheck(onActivity);
    if (stopped || disconnecting) return getState();

    const socket = makeWASocket({
      auth: auth.state,
      logger: silentLogger,
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });
    sock = socket;
    const connectedAt = Math.floor(Date.now() / 1000);
    const transportTypes = new Map<string, string>();
    socket.ws.on("CB:message", ({ attrs, content }) => {
      if (!attrs.id || !Array.isArray(content)) return;
      const encrypted = content.find((child) => child.tag === "enc");
      if (!encrypted) return;
      transportTypes.set(attrs.id, `${attrs.type ?? "ausente"}/${encrypted.attrs.mediatype ?? "ausente"}`);
      const oldest = transportTypes.keys().next().value;
      if (transportTypes.size > 128 && oldest) transportTypes.delete(oldest);
    });
    socket.ev.on("messages.upsert", ({ messages, type }) => {
      if (sock !== socket) return;
      const self = [socket.user?.id, socket.user?.lid].filter(Boolean).map((id) => jidNormalizedUser(id));
      for (const { key, message, messageTimestamp } of messages) {
        const transport = key.id ? transportTypes.get(key.id) : undefined;
        if (key.id) transportTypes.delete(key.id);
        if (type !== "notify" && !(Number(messageTimestamp) >= connectedAt)) continue;
        if (!message || !key.remoteJid) continue;
        const synced = message.deviceSentMessage?.message ?? message;
        const content = synced.ephemeralMessage?.message ?? synced;
        if (!key.fromMe && /@(s\.whatsapp\.net|lid)$/.test(key.remoteJid)) {
          if (content.extendedTextMessage?.text?.trim().toLowerCase() === "testar áudio") {
            const quote = content.extendedTextMessage.contextInfo?.quotedMessage;
            const quotedSticker = quote && describeSticker(quote);
            onActivity?.(quotedSticker ? `Teste da figurinha citada. ${quotedSticker}` : "Teste recebido sem figurinha na citação.");
            if (quote && checkAudio) void checkAudio(quote, "citação");
          }
          const activity = describeIncomingSticker(content, transport);
          if (activity) onActivity?.(activity);
        }
        if (!key.fromMe || !self.includes(jidNormalizedUser(key.remoteJid))) continue;
        const description = describeSticker(content);
        if (description) onActivity?.(`Figurinha na conversa com você. ${description}`);
      }
    });
    socket.ev.on("messages.update", (updates) => {
      if (sock !== socket) return;
      for (const { key, update } of updates) {
        if (!key.id || !outgoing.has(key.id) || update.status == null) continue;
        const target = outgoing.get(key.id);
        if (update.status === 0 || update.status >= 3) {
          onActivity?.(update.status === 0 ? `WhatsApp recusou a mensagem para ${target}.` : `Entrega confirmada para ${target}.`);
          outgoing.delete(key.id);
        }
      }
    });
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
      await Promise.all(entries.filter((entry) => entry !== "activity").map((entry) => rm(join(directory, entry), { recursive: true, force: true })));
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
    to: string | number;
    alsoSilent: boolean;
  }) {
    if (!sock || state.connection !== "open") {
      throw new Error("Conecte o WhatsApp antes de enviar");
    }
    const socket = sock;
    let jid = toJid(to);
    if (jid.endsWith("@s.whatsapp.net")) {
      const matches = await socket.onWhatsApp(jid);
      if (!matches) throw new Error("Não foi possível consultar o destino no WhatsApp.");
      const recipient = matches.find((entry) => entry.exists && entry.jid);
      if (!recipient) throw new UnknownRecipientError("O WhatsApp não encontrou uma conta para esse número.");
      jid = recipient.jid;
    }
    async function transmit(content: StickerPayload) {
      const messageId = generateMessageIDV2(socket.user?.id);
      outgoing.set(messageId, String(to));
      const oldest = outgoing.keys().next().value;
      if (outgoing.size > 512 && oldest) outgoing.delete(oldest);
      try {
        if (!content.stickerAudio) return await socket.sendMessage(jid, content, { messageId });
        const prepared = await prepareSoundSticker(content, socket.waUploadToServer, silentLogger);
        const outgoingMessage = generateWAMessageFromContent(jid, prepared, { messageId, userJid: socket.user?.id });
        const { message } = outgoingMessage;
        await socket.relayMessage(jid, message, {
          messageId,
          mediaTypeOverride: "sticker",
          additionalAttributes: { type: "media" },
        });
        if (checkAudio) void checkAudio(message, "envio");
        onActivity?.(`Figurinha preparada pelo site. ${describeSticker(message)}`);
        return outgoingMessage;
      } catch (error) {
        outgoing.delete(messageId);
        throw error;
      }
    }
    const stickerUrl = stickerPath;
    const results = [];

    if (alsoSilent) {
      const silentMsg = await transmit({
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
    const soundMsg = await transmit(payload);
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
