import { orNotFound, readValid, requireWriter } from '../../utils/guard'
import { useRepo } from '../../utils/repo'
import { taskCreateSchema } from '../../utils/schema'

export default defineEventHandler(async (event) => {
  const actor = requireWriter(event)
  const input = await readValid(event, taskCreateSchema)

  const repo = await useRepo()
  // A task hanging off a missing client is the orphan a foreign key would have
  // caught; the memory driver has no foreign keys, so catch it at the boundary.
  const client = orNotFound(await repo.clients.get(input.clientId), 'Client')
  const task = await repo.tasks.create(input)

  await repo.activity.log({
    actor,
    action: 'task.created',
    subject: `task:${task.id}`,
    summary: `Added "${task.title}" for ${client.name}`,
  })

  setResponseStatus(event, 201)
  return task
})
