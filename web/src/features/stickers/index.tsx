import { useState } from "react";

import type { Session } from "@/features/access/schemas/session.schema";

import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { message } from "@lib/api";
import { AudioPreview } from "@/features/stickers/components/audio-preview";
import { useStickers } from "@/features/stickers/hooks/use-stickers";

interface StickersPageProps {
  session: Session;
}

export function StickersPage({ session }: StickersPageProps) {
  const [media, setMedia] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [to, setTo] = useState("");
  const [alsoSilent, setAlsoSilent] = useState(false);
  const { prepareSticker, sendSticker } = useStickers();
  const prepared = prepareSticker.data;
  const busy = prepareSticker.isPending || sendSticker.isPending;
  const error = prepareSticker.error ?? sendSticker.error;

  function prepare() {
    if (!media) return;
    const body = new FormData();
    body.append("media", media);
    if (audio) body.append("audio", audio);
    sendSticker.reset();
    prepareSticker.mutate(body);
  }

  function send() {
    if (prepared) sendSticker.mutate({ id: prepared.id, to, alsoSilent });
  }

  function reset() {
    prepareSticker.reset();
    sendSticker.reset();
  }

  return (
    <>
      <section className="card">
        <h2>Preparar figurinha</h2>
        <form onSubmit={(event) => { event.preventDefault(); prepare(); }}>
          <div className="drops">
            <label className="upload stack">
              <strong>Vídeo ou imagem</strong>
              <Input type="file" accept="image/*,video/*" required disabled={Boolean(busy)}
                onChange={(event) => { setMedia(event.target.files?.[0] ?? null); reset(); }} />
            </label>
            <label className="upload stack">
              <strong>Áudio opcional</strong>
              <Input type="file" accept="audio/*,.ogg,.m4a,.opus" disabled={Boolean(busy)}
                onChange={(event) => { setAudio(event.target.files?.[0] ?? null); reset(); }} />
            </label>
          </div>
          <p className="hint">Até 80 MB por arquivo. A figurinha sai em WebP 512 × 512, com até 10 segundos.</p>
          <Button variant="secondary" disabled={!media || Boolean(busy)}>
            {prepareSticker.isPending ? "Preparando…" : "Preparar figurinha"}
          </Button>
        </form>
        {prepared && <div className="preview">
          <div className="preview-art"><img src={prepared.preview} alt="Prévia da figurinha" /></div>
          <div>
            <strong>{(prepared.stickerBytes / 1024).toFixed(1)} KB</strong>
            {prepared.audioUrl && <AudioPreview key={prepared.audioUrl} path={prepared.audioUrl} />}
            {prepared.warnings.length > 0 && <ul className="hint">{prepared.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
          </div>
        </div>}
      </section>
      <section className="card">
        <h2>Enviar pelo WhatsApp</h2>
        {!session.whatsappConnected && <p className="hint">O WhatsApp do administrador está desconectado.</p>}
        <form onSubmit={(event) => { event.preventDefault(); send(); }}>
          <label className="stack">
            <span>Número de destino</span>
            <Input type="tel" autoComplete="tel" placeholder={session.role === "admin" ? "DDI + número ou deixe vazio para você" : "DDI + número"}
              value={to} onChange={(event) => setTo(event.target.value)} required={session.role === "friend"} />
          </label>
          <label className="check">
            <input type="checkbox" checked={alsoSilent} onChange={(event) => setAlsoSilent(event.target.checked)} />
            Enviar também uma cópia sem som
          </label>
          <Button disabled={!prepared || !session.whatsappConnected || Boolean(busy)}>
            {sendSticker.isPending ? "Enviando…" : "Enviar figurinha"}
          </Button>
        </form>
        {sendSticker.isSuccess && <p className="feedback" role="status">Figurinha enviada.</p>}
        {error && <p className="feedback error" role="alert">{message(error)}</p>}
      </section>
    </>
  );
}
