import { join } from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = fileURLToPath(new URL("../../", import.meta.url));

export function appDir() {
  return APP_DIR;
}

export function authDir() {
  return join(APP_DIR, "auth");
}

export function tmpDir() {
  return join(APP_DIR, "tmp");
}
