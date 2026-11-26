import { useState } from "react";

import { Button } from "@components/ui/button";
import { BrazilPhoneField } from "@components/brazil-phone-field";
import { message } from "@lib/api";
import { useWhatsApp } from "@/features/whatsapp/hooks/use-whatsapp";

export function WhatsAppPage() {
  const [phone, setPhone] = useState("");
  const { whatsAppState: state, updateWhatsApp, logs, eventsError, activityLive } = useWhatsApp();
  const busy = updateWhatsApp.isPending;
  const error = updateWhatsApp.error;
  const connection = state?.connection ?? "disconnected";

  const canPair = !busy && connection !== "open" && /^\d{10,11}$/.test(phone);

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
        <form onSubmit={(event) => {
          event.preventDefault();
          if (canPair) updateWhatsApp.mutate({ type: "pair", phone: "55" + phone });
        }}>
          <BrazilPhoneField label="Ou conecte pelo número do WhatsApp" value={phone} onChange={setPhone}
            disabled={busy || connection === "open"} />
          <Button variant="secondary" disabled={!canPair}>Gerar código</Button>
        </form>
        {state?.qrDataUrl && <div className="qr-wrap">
          <div className="qr-glow"><img src={state.qrDataUrl} alt="QR para conectar ao WhatsApp" /></div>
          <p className="hint">No celular, abra Aparelhos conectados → Conectar um aparelho.</p>
        </div>}
        {state?.pairingCode && <p className="code" aria-live="polite">{state.pairingCode}</p>}
        {(error || state?.lastError) && <p className="feedback error" role="alert">{error ? message(error) : state?.lastError}</p>}
      </section>
      <section className="card">
        <div className="card-head">
          <h2>Atividade</h2>
          <span role="status" className={activityLive ? "pill open" : "pill"}>{activityLive ? "Ao vivo" : eventsError ? "Sem conexão" : "Conectando ao painel…"}</span>
        </div>
        {eventsError && <p role="alert" className="feedback error">{message(eventsError)}</p>}
        {logs.length ? <ul className="log-list">{logs.map((line, index) => <li key={`${index}:${line}`}>{line}</li>)}</ul>
          : activityLive && <div className="activity-empty">
              <span className="activity-wave" aria-hidden="true"><i /><i /><i /><i /><i /></span>
              <h3>Nenhuma atividade por aqui ainda</h3>
              <p className="hint">{connection === "open"
                ? "Envie uma figurinha para acompanhar o envio aqui."
                : "Conecte o WhatsApp pelo QR ou pelo código de pareamento acima."}</p>
              {connection === "open" && <Button asChild variant="secondary"><a href="/">Criar figurinha</a></Button>}
            </div>}
      </section>
    </>
  );
}
