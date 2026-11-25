import { useState } from "react";

import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";

interface AccessFormProps {
  title: string;
  label: string;
  action: string;
  busy: boolean;
  onSubmit: (value: string) => void;
}

export function AccessForm({ title, label, action, busy, onSubmit }: AccessFormProps) {
  const [value, setValue] = useState("");
  return <section className="card access-card">
    <h2>{title}</h2>
    <form onSubmit={(event) => {
      event.preventDefault();
      if (value.trim()) onSubmit(value.trim());
    }}>
      <label className="stack">
        <span>{label}</span>
        <Input type="password" autoComplete="off" required value={value}
          onChange={(event) => setValue(event.target.value)} />
      </label>
      <Button disabled={busy || !value.trim()}>{busy ? "Validando…" : action}</Button>
    </form>
  </section>;
}
