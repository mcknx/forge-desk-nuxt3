import { readValid, requireWriter } from '../../utils/guard'
import { useRepo } from '../../utils/repo'
import { clientCreateSchema } from '../../utils/schema'

export default defineEventHandler(async (event) => {
  const actor = requireWriter(event)
  const input = await readValid(event, clientCreateSchema)

  const repo = await useRepo()
  const client = await repo.clients.create(input)

  await repo.activity.log({
    actor,
    action: 'client.created',
    subject: `client:${client.id}`,
    summary: `Added ${client.name}`,
  })

  setResponseStatus(event, 201)
  return client
})
