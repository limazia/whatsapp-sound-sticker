import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync } from "node:fs";

const authDir = "/app/auth";
mkdirSync(authDir, { recursive: true });
execFileSync("chown", ["-R", "node:node", authDir]);
chmodSync(authDir, 0o700);

const gosu = "/usr/sbin/gosu";
if (!process.execve) throw new Error("O entrypoint precisa de Node.js com suporte a execve.");
process.execve(gosu, [gosu, "node", ...process.argv.slice(2)], process.env);
