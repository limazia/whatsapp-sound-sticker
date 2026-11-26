import assert from 'node:assert/strict'
import { test } from 'vitest'
import { envSchema } from '@/config/env.config'

test('usa a porta padrão quando recebe um IPv4', () => {
  const env = envSchema.parse({ HOST: '127.0.0.1' })
  assert.equal(env.HOST, '127.0.0.1')
  assert.equal(env.PORT, 3000)
})

test('aceita apenas development, test e production', () => {
  const HOST = '127.0.0.1'
  for (const environment of ['development', 'test', 'production']) {
    assert.equal(envSchema.parse({ HOST, NODE_ENV: environment }).NODE_ENV, environment)
  }
  assert.equal(envSchema.safeParse({ HOST, NODE_ENV: 'qa' }).success, false)
})

test('aceita porta configurada e host IPv6', () => {
  const env = envSchema.parse({ PORT: '8080', HOST: '::1', LOG_LEVEL: 'debug' })
  assert.equal(env.HOST, '::1')
  assert.equal(env.PORT, 8080)
  assert.equal(env.LOG_LEVEL, 'debug')
})

test('normaliza localhost e IP com a mesma porta de PORT', () => {
  for (const [HOST, host] of [['localhost:3000', 'localhost'], ['127.0.0.1:3000', '127.0.0.1'], ['[::1]:3000', '::1']]) {
    const env = envSchema.parse({ HOST, PORT: '3000' })
    assert.equal(env.HOST, host)
    assert.equal(env.PORT, 3000)
  }
})

test('rejeita HOST ausente, URL e porta divergente', () => {
  for (const HOST of [undefined, 'http://localhost:3000', 'localhost:8080', '[::1]:8080']) {
    const result = envSchema.safeParse({ HOST, PORT: '3000' })
    assert.equal(result.success, false)
    if (!result.success) assert.deepEqual(result.error.issues.map((issue) => issue.path), [['HOST']])
  }
})

test('preserva as credenciais da API e da documentação', () => {
  const credentials = {
    API_KEY: 'test-api-key',
    ADMIN_PASSWORD: 'test-admin-password',
    DOCS_USERNAME: 'test-user',
    DOCS_PASSWORD: 'test-password'
  }
  assert.deepEqual(envSchema.parse({ HOST: '127.0.0.1', ...credentials }), {
    NODE_ENV: 'development',
    HOST: '127.0.0.1',
    PORT: 3000,
    LOG_LEVEL: 'info',
    ...credentials
  })
})

test('rejeita credenciais vazias quando fornecidas', () => {
  const result = envSchema.safeParse({ HOST: '127.0.0.1', API_KEY: '', ADMIN_PASSWORD: '', DOCS_USERNAME: '', DOCS_PASSWORD: '' })
  assert.equal(result.success, false)
  if (!result.success) {
    assert.deepEqual(result.error.issues.map((issue) => issue.path), [
      ['API_KEY'], ['ADMIN_PASSWORD'], ['DOCS_USERNAME'], ['DOCS_PASSWORD']
    ])
  }
})
