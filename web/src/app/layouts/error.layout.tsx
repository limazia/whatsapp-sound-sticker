interface ErrorLayoutProps {
  title: string;
  description: string;
}

export function ErrorLayout({ title, description }: ErrorLayoutProps) {
  return <main className="page"><section className="card">
    <h1>{title}</h1><p className="hint">{description}</p><a href="/">Voltar</a>
  </section></main>;
}
