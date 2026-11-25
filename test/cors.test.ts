import assert from 'node:assert/strict'
import { onTestFinished, test } from 'vitest'
import { buildApp } from '@/app'
import { apiHeaders, apiKey } from './admin-session'

test('aceita preflight do frontend em outra origem', async ({ onTestFinished }) => {
  const app = buildApp({ nodeEnv: 'development' })
  onTestFinished(() => app.close())

  const response = await app.inject({
    method: 'OPTIONS',
    url: '/api/prepare',
    headers: {
      origin: 'https://frontend.example',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type,x-api-key'
    }
  })
  assert.equal(response.statusCode, 204)
  assert.equal(response.headers['access-control-allow-origin'], '*')
  assert.match(response.headers['access-control-allow-methods'] ?? '', /\bPOST\b/)
  assert.match(response.headers['access-control-allow-headers'] ?? '', /content-type/i)
  assert.match(response.headers['access-control-allow-headers'] ?? '', /x-api-key/i)
})

test('libera a resposta da API para qualquer origem', async ({ onTestFinished }) => {
  const app = buildApp({ nodeEnv: 'development' })
  onTestFinished(() => app.close())

  const response = await app.inject({
    url: '/api/health',
    headers: { origin: 'https://another-frontend.example' }
  })
  assert.equal(response.statusCode, 200)
  assert.equal(response.headers['access-control-allow-origin'], '*')
})

test.each(['test', 'production'] as const)(
  'libera qualquer origem para a API e o OpenAPI em %s',
  async (nodeEnv) => {
    const app = buildApp({ nodeEnv, access: { apiKey, docsUser: 'docs', docsPassword: 'test' } })
    onTestFinished(() => app.close())

    for (const url of ['/api/health', '/api/docs/openapi.json', '/api/docs/openapi.yaml']) {
      const response = await app.inject({ url, headers: { ...apiHeaders, origin: 'https://frontend.example', authorization: 'Basic ' + Buffer.from('docs:test').toString('base64') } })
      assert.equal(response.statusCode, 200)
      assert.equal(response.headers['access-control-allow-origin'], '*')
    }
  }
)
