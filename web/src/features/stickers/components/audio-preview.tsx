import { useEffect, useRef, useState } from "react";

import { Button } from "@components/ui/button";
import { message } from "@lib/api";
import { getStickerAudio } from "@/features/stickers/http/get-sticker-audio";

interface AudioPreviewProps {
  path: string;
}

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function AudioPreview({ path }: AudioPreviewProps) {
  const player = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
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
  async function togglePlayback() {
    const audio = player.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    try {
      await audio.play();
    } catch (reason) {
      if (player.current === audio) setError(message(reason));
    }
  }

  return <div className="sound-player" role="group" aria-label="Áudio da figurinha">
    <audio ref={player} src={src} preload="metadata"
      onDurationChange={({ currentTarget }) => setDuration(Number.isFinite(currentTarget.duration) ? currentTarget.duration : 0)}
      onTimeUpdate={({ currentTarget }) => setPosition(currentTarget.currentTime)}
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
      onError={() => setError("Não foi possível reproduzir este áudio.")} />
    <Button type="button" className="sound-toggle" onClick={togglePlayback} aria-label={playing ? "Pausar áudio" : "Reproduzir áudio"}>
      <span aria-hidden="true" className={playing ? "pause-symbol" : "play-symbol"} />
    </Button>
    <div className="sound-track">
      <div className="sound-caption"><strong>Áudio da figurinha</strong><span>{clock(position)} / {clock(duration)}</span></div>
      <input type="range" min="0" max={duration} step="0.01" value={Math.min(position, duration)} disabled={!duration}
        aria-label="Posição do áudio" aria-valuetext={clock(position)}
        onChange={({ currentTarget }) => {
          if (player.current) {
            player.current.currentTime = currentTarget.valueAsNumber;
            setPosition(currentTarget.valueAsNumber);
          }
        }} />
    </div>
  </div>;
}
