import assert from "node:assert/strict";
import { test } from "vitest";
import { buildApp } from "@/app";

import { apiHeaders, apiKey, adminAuthorization, adminCookies, adminPassword } from "./admin-session";
const friendCode = "friend-test-code";

test("separa os acessos de administrador e amigo", async ({ onTestFinished }) => {
  const app = buildApp({ access: { apiKey, adminPassword } });
  onTestFinished(() => app.close());

  assert.equal((await app.inject({ url: "/api/status", headers: apiHeaders })).statusCode, 401);
  assert.equal((await app.inject("/api/health")).statusCode, 200);

  const friend = await app.inject({ method: "GET", url: "/api/session", headers: apiHeaders });
  assert.equal(friend.statusCode, 200);
  assert.equal(friend.json().role, "friend");
  assert.equal(friend.json().qrDataUrl, undefined);
  const cookie = friend.cookies[0];
  assert.ok(cookie?.httpOnly);
  assert.equal(cookie.sameSite, "Strict");
  const cookies = { [cookie.name]: cookie.value };

  for (const url of ["/api/status", "/api/events"]) {
    assert.equal((await app.inject({ url, headers: apiHeaders, cookies })).statusCode, 403);
  }
  for (const url of ["/api/connect", "/api/pair", "/api/disconnect"]) {
    assert.equal((await app.inject({ method: "POST", url, headers: apiHeaders, cookies })).statusCode, 403);
  }
  assert.equal((await app.inject({
    method: "POST", url: "/api/send", headers: apiHeaders, cookies,
    payload: { id: "unknown", to: "5511999999999" },
  })).statusCode, 400);

  const logout = await app.inject({ method: "DELETE", url: "/api/session", headers: apiHeaders, cookies });
  assert.equal(logout.statusCode, 200);
  assert.equal((await app.inject({ url: "/api/session", headers: apiHeaders, cookies })).json().role, "friend");

  const denied = await app.inject({ method: "POST", url: "/api/session", headers: apiHeaders, payload: { code: adminPassword } });
  assert.equal(denied.statusCode, 404);
  const admin = await adminCookies(app);
  assert.equal((await app.inject({
    url: "/api/status", headers: apiHeaders, cookies: admin,
  })).statusCode, 200);
});

test("o login em produção emite cookie seguro e rejeita outra origem", async ({ onTestFinished }) => {
  const app = buildApp({ nodeEnv: "production", trustProxy: (_address, hop) => hop === 0, access: { apiKey, adminPassword } });
  onTestFinished(() => app.close());
  const request = { method: "GET" as const, url: "/api/session", headers: apiHeaders };
  const rejected = await app.inject({
    ...request, headers: { ...apiHeaders, host: "container.internal", "x-forwarded-host": "app.example", origin: "https://other.example" },
  });
  assert.equal(rejected.statusCode, 403);
  const login = await app.inject({
    ...request, headers: { ...apiHeaders, host: "container.internal", "x-forwarded-host": "app.example", origin: "https://app.example" },
  });
  assert.equal(login.statusCode, 200);
  assert.ok(login.cookies[0]?.secure);
});

test("pede Basic Auth antes de servir o painel e rejeita o código de amigo", async ({ onTestFinished }) => {
  const app = buildApp({ access: { apiKey, adminPassword } });
  onTestFinished(() => app.close());
  const response = await app.inject("/admin");
  assert.equal(response.statusCode, 401);
  assert.match(String(response.headers["www-authenticate"] ?? ""), /^Basic\b/);
  const authorization = adminAuthorization(friendCode);
  const denied = await app.inject({ url: "/admin", headers: { authorization } });
  assert.equal(denied.statusCode, 401);
  assert.equal(denied.cookies.length, 0);
});

test("a instalação local sem senha mantém a API administrativa fechada", async ({ onTestFinished }) => {
  const app = buildApp({ nodeEnv: "development" });
  onTestFinished(() => app.close());
  assert.equal((await app.inject("/admin")).statusCode, 401);
  assert.equal((await app.inject("/api/status")).statusCode, 401);
});
