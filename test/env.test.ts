import assert from 'node:assert/strict'
import { test } from 'vitest'
import { envSchema } from '@/config/env.config'

test('usa host e porta locais por padrão', () => {
  const env = envSchema.parse({})
  assert.equal(env.HOST, '127.0.0.1')
  assert.equal(env.PORT, 3000)
})

test('aceita development, test, qa e production como ambientes', () => {
  for (const environment of ['development', 'test', 'qa', 'production']) {
    assert.equal(envSchema.parse({ NODE_ENV: environment }).NODE_ENV, environment)
  }
  assert.equal(envSchema.safeParse({ NODE_ENV: 'other' }).success, false)
})

test('aceita porta configurada e host IPv6', () => {
  const env = envSchema.parse({ PORT: '8080', HOST: '::1', LOG_LEVEL: 'debug' })
  assert.equal(env.HOST, '::1')
  assert.equal(env.PORT, 8080)
  assert.equal(env.LOG_LEVEL, 'debug')
})

test('rejeita URL no HOST e porta fora do intervalo', () => {
  const result = envSchema.safeParse({ HOST: 'http://localhost:3000', PORT: '65536' })
  assert.equal(result.success, false)
  if (!result.success) {
    assert.deepEqual(result.error.issues.map((issue) => issue.path), [['HOST'], ['PORT']])
  }
})

test('preserva as credenciais da API e da documentação', () => {
  const credentials = {
    API_KEY: 'test-api-key',
    ADMIN_PASSWORD: 'test-admin-password',
    DOCS_USER: 'test-user',
    DOCS_PASSWORD: 'test-password'
  }
  assert.deepEqual(envSchema.parse(credentials), {
    NODE_ENV: 'development',
    HOST: '127.0.0.1',
    PORT: 3000,
    LOG_LEVEL: 'info',
    ...credentials
  })
})

test('rejeita credenciais vazias quando fornecidas', () => {
  const result = envSchema.safeParse({ API_KEY: '', ADMIN_PASSWORD: '', DOCS_USER: '', DOCS_PASSWORD: '' })
  assert.equal(result.success, false)
  if (!result.success) {
    assert.deepEqual(result.error.issues.map((issue) => issue.path), [
      ['API_KEY'], ['ADMIN_PASSWORD'], ['DOCS_USER'], ['DOCS_PASSWORD']
    ])
  }
})
