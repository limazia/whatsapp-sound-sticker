import { useEffect, useState } from "react";

import { message } from "@lib/api";
import { getStickerAudio } from "@/features/stickers/http/get-sticker-audio";

interface AudioPreviewProps {
  path: string;
}

export function AudioPreview({ path }: AudioPreviewProps) {
  const [src, setSrc] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let url: string | undefined;
    async function load() {
      try {
        const audio = await getStickerAudio(path, controller.signal);
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(audio);
        setSrc(url);
      } catch (reason) {
        if (!controller.signal.aborted) setError(message(reason));
      }
    }
    void load();
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);

  if (error) return <p className="feedback error" role="alert">{error}</p>;
  if (!src) return <p className="hint" role="status">Carregando áudio…</p>;
  return <audio className="audio-preview" src={src} controls preload="metadata" aria-label="Ouvir o áudio da figurinha" />;
}
