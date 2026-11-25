import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { appDir } from "@/shared/paths";

const require = createRequire(import.meta.url);
const inputFormats = [
  "mov", "mp4", "m4a", "3gp", "3g2", "mj2", "matroska", "webm", "avi",
  "gif", "image2", "png_pipe", "jpeg_pipe", "webp_pipe", "bmp_pipe", "tiff_pipe",
  "ogg", "mp3", "wav", "flac", "aac",
].join(",");

export const fileInputOptions = [
  "-protocol_whitelist", "file",
  "-format_whitelist", inputFormats,
];

export function getFfmpegPath() {
  let packaged: string | null = null;
  try {
    packaged = require("ffmpeg-static");
  } catch {
    packaged = null;
  }
  const exe = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const candidates = [
    join(appDir(), "bin", exe),
    packaged,
    packaged && join(dirname(packaged), exe),
    join(appDir(), exe),
  ].filter(Boolean);
  for (const c of candidates) {
    if (c && existsSync(c)) return c;
  }
  throw new Error(
    "Não achei o FFmpeg. Rode `yarn fetch-ffmpeg` ou coloque o executável na pasta bin/.",
  );
}

export function runFfmpeg(args: string[], { timeoutMs = 120_000 } = {}) {
  const bin = getFfmpegPath();
  return new Promise<{ stdout: string; stderr: string; code: number }>(
    (resolve, reject) => {
      const proc = spawn(bin, args, {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        proc.kill("SIGKILL");
        reject(new Error("FFmpeg estourou o tempo limite"));
      }, timeoutMs);
      proc.stdout.on("data", (d) => {
        stdout += d.toString();
      });
      proc.stderr.on("data", (d) => {
        stderr += d.toString();
      });
      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve({ stdout, stderr, code });
        else
          reject(
            new Error(`FFmpeg saiu com código ${code}\n${stderr.slice(-2000)}`),
          );
      });
    },
  );
}

/** Usa `ffmpeg -i` (stderr) para inspecionar o arquivo. Não precisa de ffprobe. */
export async function probe(filePath: string) {
  const bin = getFfmpegPath();
  const { stderr } = await new Promise<{ stderr: string }>(
    (resolve, reject) => {
      const proc = spawn(bin, ["-hide_banner", ...fileInputOptions, "-i", filePath], {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stderr = "";
      proc.stderr.on("data", (d) => {
        stderr += d.toString();
      });
      const timer = setTimeout(() => {
        proc.kill("SIGKILL");
        reject(new Error("A inspeção da mídia estourou o tempo limite"));
      }, 15_000);
      proc.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      proc.on("close", () => {
        clearTimeout(timer);
        resolve({ stderr });
      }); // -i sem output sai != 0
    },
  );
  const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  let duration = 0;
  if (durationMatch) {
    duration =
      Number(durationMatch[1]) * 3600 +
      Number(durationMatch[2]) * 60 +
      Number(durationMatch[3]);
  }
  const hasAudio = /Stream #\d+:\d+.*?:\s*Audio:/.test(stderr);
  const hasVideo = /Stream #\d+:\d+.*?:\s*Video:/.test(stderr);
  const dim = stderr.match(/Video:.*?\s(\d{2,5})x(\d{2,5})/);
  return {
    duration,
    hasAudio,
    hasVideo,
    width: dim ? Number(dim[1]) : null,
    height: dim ? Number(dim[2]) : null,
    raw: stderr,
  };
}

export function ffmpegStatus() {
  try {
    getFfmpegPath();
    return { available: true };
  } catch {
    return { available: false };
  }
}
