import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = dirname(fileURLToPath(import.meta.url))

/**
 * Plain vitest, not the Nuxt environment. Everything under test/ is a pure
 * function or the in-memory repo, so booting Nuxt would add seconds per run and
 * a whole framework's worth of failure modes for no extra coverage.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts'],
  },
  resolve: {
    // The server code imports '~~/types/domain'; outside Nuxt nothing defines it.
    alias: { '~~': root, '@@': root },
  },
})
