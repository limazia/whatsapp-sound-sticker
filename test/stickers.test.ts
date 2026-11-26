import assert from 'node:assert/strict'
import { test } from 'vitest'
import { buildApp } from '@/app'
import { apiHeaders, apiKey, adminCookies, adminPassword } from './admin-session'

test('rejeita um upload sem a mídia principal', async ({ onTestFinished }) => {
  const app = buildApp({ access: { apiKey, adminPassword } })
  onTestFinished(() => app.close())
  const cookies = await adminCookies(app)

  const boundary = 'soundsticker-boundary'
  const response = await app.inject({
    method: 'POST',
    cookies,
    url: '/api/prepare',
    headers: { ...apiHeaders, 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload: [
      `--${boundary}`,
      'Content-Disposition: form-data; name="audio"; filename="audio.ogg"',
      'Content-Type: audio/ogg',
      '',
      'audio',
      `--${boundary}--`,
      ''
    ].join('\r\n')
  })

  assert.equal(response.statusCode, 400)
  assert.deepEqual(response.json(), { ok: false, error: 'Escolha um vídeo ou uma imagem' })
})

test('retorna 404 para o áudio de uma figurinha que não foi preparada', async ({ onTestFinished }) => {
  const app = buildApp({ access: { apiKey, adminPassword } })
  onTestFinished(() => app.close())
  const cookies = await adminCookies(app)

  const response = await app.inject({ url: '/api/jobs/unknown/audio', headers: apiHeaders, cookies })
  assert.equal(response.statusCode, 404)
  assert.deepEqual(response.json(), { ok: false, error: 'Áudio não encontrado' })
})

test('rejeita o envio de uma figurinha que não foi preparada', async ({ onTestFinished }) => {
  const app = buildApp({ access: { apiKey, adminPassword } })
  onTestFinished(() => app.close())
  const cookies = await adminCookies(app)

  const response = await app.inject({
    method: 'POST',
    cookies,
    url: '/api/send',
    headers: apiHeaders,
    payload: { id: 'unknown', to: '5500000000000' }
  })

  assert.equal(response.statusCode, 400)
  assert.deepEqual(response.json(), { ok: false, error: 'Prepare a figurinha antes de enviar' })
})

test('rejeita uma opção de envio com tipo incorreto', async ({ onTestFinished }) => {
  const app = buildApp({ access: { apiKey, adminPassword } })
  onTestFinished(() => app.close())
  const cookies = await adminCookies(app)

  const response = await app.inject({
    method: 'POST',
    cookies,
    url: '/api/send',
    headers: apiHeaders,
    payload: { id: 'unknown', to: '5500000000000', alsoSilent: 'false' }
  })

  assert.equal(response.statusCode, 400)
  assert.equal(response.json().ok, false)
  assert.match(response.json().error, /alsoSilent/)
})

test.each([{}, { to: '' }, { to: '   ' }])('exige destino mesmo para o administrador (%j)', async (destination) => {
  const app = buildApp({ access: { apiKey, adminPassword } })
  try {
    const cookies = await adminCookies(app)
    const response = await app.inject({
      method: 'POST', url: '/api/send', cookies, headers: apiHeaders,
      payload: { id: 'unknown', ...destination }
    })
    assert.equal(response.statusCode, 400)
    assert.match(response.json().error, /to/)
  } finally {
    await app.close()
  }
})
