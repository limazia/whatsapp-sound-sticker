import { createWriteStream, existsSync } from "node:fs";
import { chmod, mkdir, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { createRequire } from "node:module";
import { Readable } from "node:stream";

const require = createRequire(import.meta.url);
const VERSION = "b6.1.1";
const BASE = `https://github.com/eugeneware/ffmpeg-static/releases/download/${VERSION}`;

interface TargetOptions {
  platform?: NodeJS.Platform;
  arch?: string;
}

function target({ platform = process.platform, arch = process.arch }: TargetOptions) {
  const exe = platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const asset =
    platform === "win32"
      ? `ffmpeg-${platform}-${arch}.gz`
      : `ffmpeg-${platform}-${arch}`;
  return { exe, asset };
}

async function destDir() {
  try {
    const pkg = require.resolve("ffmpeg-static/package.json");
    return dirname(pkg);
  } catch {
    return join(process.cwd(), "node_modules", "ffmpeg-static");
  }
}

export async function fetchFfmpeg(opts: TargetOptions = {}) {
  const { exe, asset } = target(opts);
  const dir = await destDir();
  await mkdir(dir, { recursive: true });
  const out = join(dir, exe);
  const url = `${BASE}/${asset}`;
  if (existsSync(out)) return out;
  console.log(`Baixando ${url}`);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body)
    throw new Error(`Falha ao baixar FFmpeg: ${res.status} ${res.statusText}`);
  const tmp = join(dir, `${exe}.partial`);
  try {
    const body = Readable.from(res.body as AsyncIterable<Uint8Array>);
    const file = createWriteStream(tmp);
    if (asset.endsWith(".gz")) await pipeline(body, createGunzip(), file);
    else await pipeline(body, file);
    if (process.platform !== "win32") await chmod(tmp, 0o755);
    await rename(tmp, out);
  } finally {
    await rm(tmp, { force: true });
  }
  console.log(`OK: ${out}`);
  return out;
}

if (import.meta.main) await fetchFfmpeg();
