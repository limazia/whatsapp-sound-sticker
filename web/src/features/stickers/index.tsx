import { useState } from "react";

import type { Session } from "@/features/access/schemas/session.schema";

import { Button } from "@components/ui/button";
import { BrazilPhoneField } from "@components/brazil-phone-field";
import { message } from "@lib/api";
import { FileDrop } from "@/features/stickers/components/file-drop";
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


  function prepare(onPrepared?: (id: string) => void) {
    if (!media) return;
    const body = new FormData();
    body.append("media", media);
    if (audio) body.append("audio", audio);
    sendSticker.reset();
    prepareSticker.mutate(body, { onSuccess: (job) => onPrepared?.(job.id) });
  }

  const validDestination = /^\d{10,11}$/.test(to);

  function send() {
    if (!media || !validDestination || busy || !session.whatsappConnected) return;
    const submit = (id: string) => sendSticker.mutate({ id, to: "55" + to, alsoSilent });
    if (prepared) submit(prepared.id);
    else prepare(submit);
  }

  const sentWithAudio = sendSticker.data?.results.some((entry) => entry.kind === "sound" && entry.proto.hasAudioMessage);

  function reset() {
    prepareSticker.reset();
    sendSticker.reset();
  }

  return (
    <div className="studio">
      <section className="card editor">
        <h2>Criar figurinha</h2>
        <form onSubmit={(event) => { event.preventDefault(); prepare(); }}>
          <FileDrop kind="media" file={media} disabled={busy} onChange={(file) => { setMedia(file); reset(); }} />
          <FileDrop kind="audio" file={audio} disabled={busy} onChange={(file) => { setAudio(file); reset(); }} />
          <div className="editor-footer">
            <p className="hint">WebP · 512 × 512 · Até 10 s</p>
            <Button disabled={!media || busy}>{prepareSticker.isPending ? "Preparando…" : "Gerar prévia"}</Button>
          </div>
        </form>
        {prepareSticker.error && <p className="feedback error" role="alert">{message(prepareSticker.error)}</p>}
        {prepared && <section className="preview" aria-label="Prévia da figurinha">
          <div className="preview-heading"><h3>Prévia da figurinha</h3><span>{prepared.isAnimated ? "Animada" : "Estática"} · WebP · {(prepared.stickerBytes / 1024).toFixed(1)} KB</span></div>
          <div className="preview-art"><img src={prepared.preview} alt="Prévia da figurinha" /></div>

            {prepared.audioUrl && <AudioPreview key={prepared.audioUrl} path={prepared.audioUrl} />}
          {!prepared.audioUrl && <p className="hint">Figurinha sem áudio</p>}
            {prepared.warnings.length > 0 && <ul className="hint">{prepared.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
        </section>}
      </section>
      <section className="card">
        <h2>Enviar pelo WhatsApp</h2>
        {session.whatsappConnected && <p className="connection">WhatsApp conectado</p>}
        {!session.whatsappConnected && <p className="hint">O WhatsApp do administrador está desconectado.</p>}
        <form onSubmit={(event) => { event.preventDefault(); send(); }}>
          <BrazilPhoneField label="Número de destino" value={to} onChange={setTo} disabled={busy} />
          <label className="check">
            <input type="checkbox" disabled={busy} checked={alsoSilent} onChange={(event) => setAlsoSilent(event.target.checked)} />
            Enviar também uma cópia sem som
          </label>
          <Button disabled={!validDestination || !media || !session.whatsappConnected || Boolean(busy)}>
            {prepareSticker.isPending ? "Preparando…" : sendSticker.isPending ? "Enviando…" : "Enviar figurinha"}
          </Button>
        </form>
        {sendSticker.isSuccess && <p className="feedback" role="status">
          {sentWithAudio ? "Mensagem encaminhada com áudio. Entrega ainda não confirmada."
            : prepared?.audioUrl ? "Mensagem encaminhada sem a faixa da prévia. Entrega ainda não confirmada."
            : "Mensagem encaminhada sem áudio. Entrega ainda não confirmada."}
        </p>}
        {sendSticker.error && <p className="feedback error" role="alert">{message(sendSticker.error)}</p>}
      </section>
    </div>
  );
}
