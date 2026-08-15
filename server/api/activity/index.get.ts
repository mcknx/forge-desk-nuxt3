import { queryValid } from '../../utils/guard'
import { useRepo } from '../../utils/repo'
import { activityQuerySchema } from '../../utils/schema'

export default defineEventHandler(async (event) => {
  const { limit } = queryValid(event, activityQuerySchema)
  const repo = await useRepo()
  return repo.activity.list(limit)
})
