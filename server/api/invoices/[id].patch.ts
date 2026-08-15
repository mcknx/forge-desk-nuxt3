import { orNotFound, readValid, requireWriter } from '../../utils/guard'
import { useRepo } from '../../utils/repo'
import { invoiceStatusSchema } from '../../utils/schema'

export default defineEventHandler(async (event) => {
  const user = requireWriter(event)
  const id = getRouterParam(event, 'id')!
  const { status } = await readValid(event, invoiceStatusSchema)
  const repo = await useRepo()
  const invoice = orNotFound(await repo.invoices.setStatus(id, status), 'Invoice')

  // Only the money-moving transitions are worth a feed entry; draft and void
  // are housekeeping.
  if (status === 'sent' || status === 'paid') {
    await repo.activity.log({
      actor: user,
      action: status === 'sent' ? 'invoice.sent' : 'invoice.paid',
      subject: `invoice:${invoice.id}`,
      summary: `${user.name} marked ${invoice.number} ${status}`,
    })
  }

  return invoice
})
