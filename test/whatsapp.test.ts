import assert from 'node:assert/strict'
import { test } from 'vitest'
import { buildApp } from '@/app'
import { apiHeaders, apiKey, adminCookies, adminPassword } from './admin-session'

test('abre SSE e encerra a conexão junto com o servidor', async ({ onTestFinished }) => {
  const app = buildApp({ nodeEnv: 'development', access: { apiKey, adminPassword } })
  onTestFinished(() => app.close())
  const cookies = await adminCookies(app)
  const address = await app.listen({ host: '127.0.0.1', port: 0 })
  const response = await fetch(`${address}/api/events`, {
    headers: { ...apiHeaders, origin: address, cookie: Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join('; ') },
    signal: AbortSignal.timeout(3000)
  })
  assert.equal(response.headers.get('access-control-allow-origin'), '*')
  assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/)
  assert.ok(response.body)
  const reader = response.body.getReader()
  const initial = await reader.read()
  assert.match(Buffer.from(initial.value ?? []).toString(), /^event: status\ndata: /)
  app.events.log('Log de teste')
  const update = await reader.read()
  assert.match(Buffer.from(update.value ?? []).toString(), /^event: log\ndata: .*Log de teste/)
  await app.close()
  assert.equal((await reader.read()).done, true)
})

test('rejeita um corpo inválido antes de conectar ao WhatsApp', async ({ onTestFinished }) => {
  const app = buildApp({ access: { apiKey, adminPassword } })
  onTestFinished(() => app.close())
  const cookies = await adminCookies(app)

  const response = await app.inject({
    method: 'POST',
    cookies,
    url: '/api/pair',
    headers: apiHeaders,
    payload: { phone: { number: '5511999999999' } }
  })

  assert.equal(response.statusCode, 400)
  assert.equal(response.json().ok, false)
  assert.match(response.json().error, /phone/)
})

test('rejeita um telefone curto antes de abrir a sessão', async ({ onTestFinished }) => {
  const app = buildApp({ access: { apiKey, adminPassword } })
  onTestFinished(() => app.close())
  const cookies = await adminCookies(app)

  const response = await app.inject({
    method: 'POST',
    cookies,
    url: '/api/pair',
    headers: apiHeaders,
    payload: { phone: '123' }
  })

  assert.equal(response.statusCode, 400)
  assert.match(response.json().error, /DDI/)
  const status = await app.inject({ url: '/api/status', headers: apiHeaders, cookies })
  assert.equal(status.json().connection, 'disconnected')
})
