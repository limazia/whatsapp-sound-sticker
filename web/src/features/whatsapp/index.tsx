import { useState } from "react";

import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { message } from "@lib/api";
import { useWhatsApp } from "@/features/whatsapp/hooks/use-whatsapp";

export function WhatsAppPage() {
  const [phone, setPhone] = useState("");
  const { whatsAppState: state, updateWhatsApp, logs, eventsError } = useWhatsApp();
  const busy = updateWhatsApp.isPending;
  const error = updateWhatsApp.error ?? eventsError;
  const connection = state?.connection ?? "disconnected";

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2>Sessão do WhatsApp</h2>
          <span className={`pill ${connection}`}>
            {({ open: "conectado", qr: "aguardando QR", connecting: "conectando", disconnected: "desconectado" })[connection]}
          </span>
        </div>
        {state?.selfJid && <p className="hint">Conta conectada · {state.selfJid.split("@")[0]}</p>}
        {state?.hasAuth && connection !== "open" && <p className="hint">Há uma sessão salva neste servidor.</p>}
        <div className="row">
          <Button disabled={busy || connection === "open"} onClick={() => updateWhatsApp.mutate({ type: "connect" })}>Mostrar QR</Button>
          <Button variant="destructive" disabled={busy || (!state?.hasAuth && connection === "disconnected")} onClick={() => {
            if (window.confirm("Desconectar e apagar a sessão salva do WhatsApp?")) updateWhatsApp.mutate({ type: "disconnect" });
          }}>Desconectar WhatsApp</Button>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); updateWhatsApp.mutate({ type: "pair", phone }); }}>
          <label className="stack">
            <span>Ou conecte com o número e DDI</span>
            <Input type="tel" autoComplete="tel" placeholder="5511999999999" value={phone} onChange={(event) => setPhone(event.target.value)} required />
          </label>
          <Button variant="secondary" disabled={busy || connection === "open"}>Gerar código</Button>
        </form>
        {state?.qrDataUrl && <div className="qr-wrap">
          <div className="qr-glow"><img src={state.qrDataUrl} alt="QR para conectar ao WhatsApp" /></div>
          <p className="hint">No celular, abra Aparelhos conectados → Conectar um aparelho.</p>
        </div>}
        {state?.pairingCode && <p className="code" aria-live="polite">{state.pairingCode}</p>}
        {(error || state?.lastError) && <p className="feedback error" role="alert">{error ? message(error) : state?.lastError}</p>}
      </section>
      <section className="card">
        <h2>Atividade</h2>
        {logs.length ? <ul className="log-list">{logs.map((line, index) => <li key={`${index}:${line}`}>{line}</li>)}</ul>
          : <p className="hint">Os eventos da sessão aparecem aqui.</p>}
      </section>
    </>
  );
}
