import assert from 'node:assert/strict'
import { test } from 'vitest'
import { buildApp } from '@/app'
import { apiHeaders, apiKey, adminCookies, adminPassword } from './admin-session'

test('publica as rotas sob /api e responde 404 para endereço desconhecido', async ({ onTestFinished }) => {
  const app = buildApp({ access: { apiKey, adminPassword } })
  onTestFinished(() => app.close())
  const cookies = await adminCookies(app)

  const home = await app.inject('/rota-inexistente')
  assert.equal(home.statusCode, 404)
  assert.deepEqual(home.json(), { ok: false, error: 'Rota não encontrada' })

  for (const url of ['/api/health', '/api/status']) {
    const response = await app.inject({ url, headers: apiHeaders, cookies })
    assert.equal(response.statusCode, 200)
    assert.equal(response.json().ok, true)
  }
})
