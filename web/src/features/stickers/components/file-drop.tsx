import { useId, useState } from "react";

import { Button } from "@components/ui/button";

interface FileDropProps {
  kind: "media" | "audio";
  file: File | null;
  disabled: boolean;
  onChange: (file: File | null) => void;
}

export function FileDrop({ kind, file, disabled, onChange }: FileDropProps) {
  const id = useId();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const media = kind === "media";
  const label = media ? "Imagem ou vídeo" : "Áudio opcional";
  const extensions = media ? /\.(png|jpe?g|webp|gif|avif|heic|mp4|mov|mkv|webm|avi)$/i : /\.(mp3|wav|aac|flac|m4a|ogg|opus)$/i;

  function select(files: FileList | null) {
    const selected = files?.[0];
    if (!selected || disabled) return;
    if (files.length > 1) return setError("Solte apenas um arquivo por vez.");
    if (selected.size > 80 * 1024 * 1024) return setError("Escolha um arquivo de até 80 MB.");
    const matches = media ? /^(image|video)\// : /^audio\//;
    if (!matches.test(selected.type) && !extensions.test(selected.name)) {
      return setError(media ? "Escolha uma imagem ou um vídeo." : "Escolha um arquivo de áudio.");
    }
    setError("");
    onChange(selected);
  }

  return <div className="drop-field">
    <label className={`drop-zone ${kind} ${dragging ? "dragging" : ""}`} onDragOver={(event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = disabled ? "none" : "copy";
      setDragging(!disabled);
    }} onDragLeave={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
    }} onDrop={(event) => {
      event.preventDefault();
      setDragging(false);
      select(event.dataTransfer.files);
    }}>
      <input className="sr-only" type="file" aria-label={label} aria-describedby={id} disabled={disabled}
        accept={media ? "image/*,video/*" : "audio/*,.ogg,.m4a,.opus"}
        onChange={(event) => { select(event.target.files); event.target.value = ""; }} />
      <span className="drop-icon" aria-hidden="true">{media ? "↑" : "♫"}</span>
      <span className="drop-copy"><strong>{file?.name ?? (media ? "Solte sua imagem ou vídeo" : "Adicionar uma faixa de áudio")}</strong>
        <small id={id}>{file ? `${Math.max(1, Math.ceil(file.size / 1024)).toLocaleString("pt-BR")} KB · Clique para trocar` :
          media ? "Ou clique para procurar · Até 80 MB" : "Opcional · Arraste ou clique para escolher"}</small></span>
    </label>
    {file && <Button type="button" variant="ghost" disabled={disabled} onClick={() => { setError(""); onChange(null); }}>Remover {media ? "mídia" : "áudio"}</Button>}
    {error && <p className="feedback error" role="alert">{error}</p>}
  </div>;
}
