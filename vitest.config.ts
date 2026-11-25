import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    // Fastify autoload imports plugins through Node rather than Vitest.
    execArgv: ['--import', 'tsx'],
    coverage: { include: ['src/**/*.ts'] }
  }
})
