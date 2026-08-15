import { queryValid } from '../../utils/guard'
import { useRepo } from '../../utils/repo'
import { taskQuerySchema } from '../../utils/schema'

export default defineEventHandler(async (event) => {
  const query = queryValid(event, taskQuerySchema)
  const repo = await useRepo()
  return repo.tasks.list(query)
})
