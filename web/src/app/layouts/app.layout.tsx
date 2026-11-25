import { Button } from "@components/ui/button";
import { ApiError, message } from "@lib/api";
import { AccessForm } from "@/features/access/components/access-form";
import { useAccess } from "@/features/access/hooks/use-access";
import { StickersPage } from "@/features/stickers";
import { WhatsAppPage } from "@/features/whatsapp";

interface AppLayoutProps {
  adminView?: boolean;
}

export function AppLayout({ adminView = false }: AppLayoutProps) {
  const { session, sessionError, isFetchingSession, unlock, login, logout } = useAccess();
  const validSession = sessionError instanceof ApiError && sessionError.status === 401 ? undefined : session;
  const role = validSession?.role;
  const error = unlock.error ?? login.error ?? logout.error ?? sessionError;

  return <main className="page">
    <header className="hero-top">
      <div className="brand">
        <span className="brand-note" aria-hidden="true">♫</span>
        <h1>{adminView ? "Administrar WhatsApp" : "Figurinha com som"}</h1>
      </div>
      <nav className="account-actions" aria-label="Acesso">
        {adminView ? <a href="/">Figurinhas</a> : <a href="/admin">Administração</a>}
        {role && <Button variant="ghost" onClick={() => logout.mutate(undefined, {
          onSuccess: () => { if (adminView) location.assign("/"); },
        })}>Sair</Button>}
      </nav>
    </header>
    {error && <p className="feedback error" role="alert">{message(error)}</p>}
    {!validSession && (isFetchingSession
      ? <p role="status">Carregando…</p>
      : <AccessForm key="api" title="Acesso à API" label="Chave da API" action="Continuar"
          busy={unlock.isPending} onSubmit={(key) => unlock.mutate(key)} />)}
    {validSession && !role && !adminView &&
      <AccessForm key="friend" title="Entrar com código de amigo" label="Código de acesso" action="Entrar"
        busy={login.isPending} onSubmit={(code) => login.mutate(code)} />}
    {validSession && adminView && (role === "admin" ? <WhatsAppPage /> :
      <section className="card access-card">
        <h2>Área do administrador</h2>
        <p className="hint">Use o usuário <strong>admin</strong> e sua senha de administrador.</p>
        <a href="/admin/auth">Autenticar como administrador</a>
      </section>)}
    {validSession && role && !adminView && <StickersPage session={validSession} />}
  </main>;
}
