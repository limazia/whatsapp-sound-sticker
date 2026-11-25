import { useEffect } from "react";

import { Button } from "@components/ui/button";
import { ApiError, message } from "@lib/api";
import { useAccess } from "@/features/access/hooks/use-access";
import { StickersPage } from "@/features/stickers";
import { WhatsAppPage } from "@/features/whatsapp";

interface AppLayoutProps {
  adminView?: boolean;
}

export function AppLayout({ adminView = false }: AppLayoutProps) {
  const { session, sessionError, isFetchingSession, logout } = useAccess();
  const validSession = sessionError instanceof ApiError && sessionError.status === 401 ? undefined : session;
  const role = validSession?.role;
  const error = logout.error ?? sessionError;
  const loading = !validSession && isFetchingSession;

  const title = adminView ? "Administrar WhatsApp" : "Figurinha com som";

  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;
    return () => { document.title = previousTitle; };
  }, [title]);

  return <main className="page">
    <header className="hero-top">
      <div className="brand">
        <span className="brand-note" aria-hidden="true">♫</span>
        <h1><a href="/">Figurinha com som</a></h1>
      </div>
      {role === "admin" && <div className="account-actions">
        <Button variant="ghost" onClick={() => logout.mutate(undefined, {
          onSuccess: () => { if (adminView) location.assign("/"); },
        })}>Sair</Button>
      </div>}
    </header>
    {error && <p className="feedback error" role="alert">{message(error)}</p>}
    {loading && <p role="status">Carregando…</p>}
    {!loading && adminView && (role === "admin" ? <WhatsAppPage /> :
      <section className="card w-full">
        <h2>Área do administrador</h2>
        <p className="hint">Use o usuário <strong>admin</strong> e sua senha de administrador.</p>
        <a href="/admin/auth">Autenticar como administrador</a>
      </section>)}
    {validSession && role && !adminView && <StickersPage session={validSession} />}
  </main>;
}
