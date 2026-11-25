import { cp, mkdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const appDir = dirname(
  fileURLToPath(new URL("../package.json", import.meta.url)),
);
const stage = join(appDir, "dist-windows", "FigurinhaComSom");
const zipPath = join(appDir, "..", "FigurinhaComSom-Windows.zip");

const nodeSrc = process.env.WIN_NODE_DIR;
const ffmpegExe = process.env.WIN_FFMPEG_EXE;

if (!nodeSrc || !existsSync(join(nodeSrc, "node.exe"))) {
  throw new Error(
    "Defina WIN_NODE_DIR apontando para a pasta com node.exe do Windows",
  );
}
if (!ffmpegExe || !existsSync(ffmpegExe)) {
  throw new Error("Defina WIN_FFMPEG_EXE apontando para o ffmpeg.exe");
}

await rm(join(appDir, "dist-windows"), { recursive: true, force: true });
await mkdir(join(stage, "runtime"), { recursive: true });
await mkdir(join(stage, "app"), { recursive: true });

await cp(join(nodeSrc, "node.exe"), join(stage, "runtime", "node.exe"));
// LICENSE do Node, se existir
for (const f of ["LICENSE", "license.rtf", "README.md"]) {
  if (existsSync(join(nodeSrc, f))) {
    await cp(join(nodeSrc, f), join(stage, "runtime", f));
  }
}

const copyList = ["dist", "public", "package.json"];
for (const name of copyList) {
  await cp(join(appDir, name), join(stage, "app", name), { recursive: true });
}
await cp(join(appDir, "node_modules"), join(stage, "app", "node_modules"), {
  recursive: true,
});
await cp(join(appDir, "README.md"), join(stage, "README.txt"));

const ffmpegDestDir = join(stage, "app", "node_modules", "ffmpeg-static");
await mkdir(ffmpegDestDir, { recursive: true });
await cp(ffmpegExe, join(ffmpegDestDir, "ffmpeg.exe"));

// Não levar o binário Linux no pacote do Windows.
try {
  await rm(join(ffmpegDestDir, "ffmpeg"));
} catch {}

// não levar sessões nem temporários
await rm(join(stage, "app", "auth"), { recursive: true, force: true }).catch(
  () => {},
);
await rm(join(stage, "app", "tmp"), { recursive: true, force: true }).catch(
  () => {},
);
await rm(join(stage, "auth"), { recursive: true, force: true }).catch(() => {});
await rm(join(stage, "tmp"), { recursive: true, force: true }).catch(() => {});

if (existsSync(zipPath)) await rm(zipPath);
const staged = join(appDir, "dist-windows");
try {
  execFileSync("zip", ["-r", "-q", zipPath, "FigurinhaComSom"], { cwd: staged });
} catch {
  execFileSync("python3", ["-c", `
import sys
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
src, out = map(Path, sys.argv[1:])
with ZipFile(out, "w", compression=ZIP_DEFLATED) as archive:
    for file in src.rglob("*"):
        if file.is_file():
            archive.write(file, Path(src.name) / file.relative_to(src))
`, stage, zipPath], { cwd: staged });
}
const size = (await stat(zipPath)).size;
console.log(`ZIP: ${zipPath} (${(size / 1024 / 1024).toFixed(1)} MB)`);
