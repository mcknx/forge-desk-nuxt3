import { rateLimit, requireWriter } from '../../utils/guard'
import { useRepo } from '../../utils/repo'

export default defineEventHandler(async (event) => {
  // Auth first so anonymous traffic cannot burn the owner's window, then the
  // limiter so a signed-in demo visitor cannot sit on the button.
  requireWriter(event)
  rateLimit(event, 'reset', 3, 600_000)

  const repo = await useRepo()
  await repo.reset()
  return { ok: true, driver: repo.kind }
})
