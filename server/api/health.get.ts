import { isSessionSecretConfigured } from '../utils/auth'
import { useRepo } from '../utils/repo'

/**
 * Names the storage driver actually serving traffic. When this says "memory"
 * the deploy has no DATABASE_URL and writes reset on cold start — the UI shows
 * a banner saying so rather than letting a visitor discover it by losing data.
 */
export default defineEventHandler(async (event) => {
  const started = Date.now()
  const repo = await useRepo()
  const stats = await repo.stats()

  return {
    ok: true,
    driver: repo.kind,
    persistent: repo.kind === 'postgres',
    // False means sessions are signed with a per-process random key and will
    // not survive a restart. Worth knowing before debugging a "random logout".
    sessionSecretConfigured: isSessionSecretConfigured(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
    region: process.env.VERCEL_REGION || 'local',
    counts: { clients: stats.clients.total, tasks: stats.tasks.total },
    latencyMs: Date.now() - started,
    checkedAt: new Date().toISOString(),
  }
})
