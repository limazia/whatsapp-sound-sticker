import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";

export const apiKey = "test-only-api-key";
export const apiHeaders = { "x-api-key": apiKey };
export const adminPassword = "test-only-administrator-password";

export function adminAuthorization(password = adminPassword) {
  return "Basic " + Buffer.from(`admin:${password}`).toString("base64");
}

export async function adminCookies(app: FastifyInstance) {
  const response = await app.inject({
    url: "/admin/auth",
    headers: { authorization: adminAuthorization() },
  });
  assert.equal(response.statusCode, 303);
  const cookie = response.cookies[0];
  assert.ok(cookie);
  return { [cookie.name]: cookie.value };
}
