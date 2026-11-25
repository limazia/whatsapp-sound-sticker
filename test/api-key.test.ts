import assert from "node:assert/strict";
import { test } from "vitest";
import { buildApp } from "@/app";
import { adminCookies, adminPassword, apiHeaders, apiKey } from "./admin-session";

test("aplica a chave antes do login e das operações", async ({ onTestFinished }) => {
  const app = buildApp({ access: { apiKey, adminPassword } });
  onTestFinished(() => app.close());
  const cookies = await adminCookies(app);

  for (const url of ["/api", "/api/session", "/api/status", "/api/events",
    "/api/prepare", "/api/jobs/test/audio"]) {
    for (const headers of [{}, { "x-api-key": adminPassword }]) {
      const response = await app.inject({ url, headers, cookies });
      assert.equal(response.statusCode, 401, url);
      assert.equal(response.json().error, "API_KEY ausente ou inválida.");
    }
  }
  assert.equal((await app.inject("/api/health")).statusCode, 200);
  assert.equal((await app.inject({ url: "/api/status", headers: apiHeaders, cookies })).statusCode, 200);
  assert.equal((await app.inject({ url: "/api/status", headers: apiHeaders })).statusCode, 401);

  const panel = await app.inject({ url: "/admin", headers: apiHeaders });
  assert.equal(panel.statusCode, 401);
  assert.match(String(panel.headers["www-authenticate"]), /SoundSticker Admin/);
});

test("mantém a API fechada quando a chave não foi configurada", async ({ onTestFinished }) => {
  const app = buildApp();
  onTestFinished(() => app.close());
  assert.equal((await app.inject({ url: "/api/session", headers: apiHeaders })).statusCode, 401);
});

test("abre a sessão pública com X-API-Key sem revelar a chave", async ({ onTestFinished }) => {
  const app = buildApp({ access: { apiKey } });
  onTestFinished(() => app.close());
  const session = await app.inject({ url: "/api/session", headers: apiHeaders });
  assert.equal(session.statusCode, 200);
  assert.equal(session.json().role, "friend");
  assert.equal(session.body.includes(apiKey), false);
  assert.equal((await app.inject("/auth/session")).statusCode, 404);
});
