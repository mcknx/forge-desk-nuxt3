import { orNotFound, requireWriter } from '../../utils/guard'
import { useRepo } from '../../utils/repo'

export default defineEventHandler(async (event) => {
  const actor = requireWriter(event)
  const id = getRouterParam(event, 'id') ?? ''

  const repo = await useRepo()
  // Read first: it 404s the unknown id, and the title is gone once it is deleted.
  const task = orNotFound(await repo.tasks.get(id), 'Task')
  await repo.tasks.remove(id)

  await repo.activity.log({
    actor,
    action: 'task.deleted',
    subject: `task:${id}`,
    summary: `Deleted "${task.title}"`,
  })

  return { ok: true }
})
