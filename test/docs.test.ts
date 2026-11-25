import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { onTestFinished, test } from 'vitest'
import { buildApp } from '@/app'
import { apiKey } from './admin-session'

test('serve o Scalar e o OpenAPI gerado a partir das rotas', async ({ onTestFinished }) => {
  const app = buildApp({ nodeEnv: "development", access: { apiKey } })
  onTestFinished(() => app.close())

  const entry = await app.inject({ url: '/api/docs' })
  assert.equal(entry.statusCode, 301)
  assert.equal(entry.headers.location, '/api/docs/')

  const docs = await app.inject({ url: '/api/docs/' })
  assert.equal(docs.statusCode, 200)
  assert.match(docs.headers['content-type'] ?? '', /text\/html/)
  assert.match(docs.body, /js\/scalar\.js/)
  assert.ok(docs.body.includes(apiKey))
  assert.equal((await app.inject({ url: '/api/docs/js/scalar.js' })).statusCode, 200)

  const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const response = await app.inject({ url: '/api/docs/openapi.json' })
  assert.equal(response.statusCode, 200)
  const yaml = await app.inject({ url: '/api/docs/openapi.yaml' })
  assert.equal(yaml.statusCode, 200)
  assert.match(yaml.headers['content-type'] ?? '', /application\/yaml/)
  const spec = response.json()
  assert.equal(spec.info.version, version)
  assert.deepEqual(spec.security, [{ apiKey: [] }])
  assert.equal(spec.components.securitySchemes.apiKey.name, 'X-API-Key')
  assert.deepEqual(spec.paths['/api/health'].get.security, [])
  assert.ok(spec.paths['/api/health'].get)
  assert.ok(spec.paths['/api/status'].get)
  assert.ok(spec.paths['/api/events'].get.responses['200'].content['text/event-stream'])
  assert.ok(spec.paths['/api/connect'].post)
  assert.ok(spec.paths['/api/disconnect'].post)
  assert.ok(spec.paths['/api/pair'].post.requestBody.content['application/json'])
  assert.ok(spec.paths['/api/send'].post.requestBody.content['application/json'])
  assert.ok(spec.paths['/api/jobs/{id}/audio'].get.parameters.some(
    (parameter: { name: string; in: string }) => parameter.name === 'id' && parameter.in === 'path'
  ))
  const upload = spec.paths['/api/prepare'].post.requestBody.content['multipart/form-data'].schema
  assert.deepEqual(upload.required, ['media'])
  assert.equal(upload.properties.media.format, 'binary')
  assert.equal(upload.properties.audio.format, 'binary')
  assert.equal(Object.keys(spec.paths).filter((path) => path.startsWith('/api/docs')).length, 0)
})

test.each(["qa", "production"] as const)("protege o Scalar e os schemas em %s", async (nodeEnv) => {
  const docsUser = "docs-user";
  const docsPassword = "docs-password";
  const app = buildApp({ nodeEnv, access: { apiKey, docsUser, docsPassword } });
  onTestFinished(() => app.close());

  const authorization = "Basic " + Buffer.from(`${docsUser}:${docsPassword}`).toString("base64");
  for (const path of ["/api/docs/", "/api/docs/openapi.json", "/api/docs/openapi.yaml", "/api/docs/js/scalar.js"]) {
    const challenge = await app.inject({ url: path, headers: { "x-api-key": apiKey } });
    assert.equal(challenge.statusCode, 401);
    assert.match(String(challenge.headers["www-authenticate"]), /SoundSticker Docs/);
    const response = await app.inject({ url: path, headers: { authorization } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.includes(apiKey), false);
  }

  assert.equal((await app.inject({ url: "/api/session", headers: { authorization } })).statusCode, 401);
});
