import { queryValid } from '../../utils/guard'
import { todayISO } from '../../utils/logic'
import { useRepo } from '../../utils/repo'
import { timeQuerySchema } from '../../utils/schema'
import type { TimeEntry } from '~~/types/domain'

/** Quote every field and double embedded quotes — a note with a comma must not shift a column. */
function cell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

export default defineEventHandler(async (event) => {
  const filters = queryValid(event, timeQuerySchema)
  const repo = await useRepo()

  // The caller's page/perPage are deliberately ignored: a spreadsheet missing
  // page two is worse than no spreadsheet.
  const entries: TimeEntry[] = []
  for (let page = 1; ; page++) {
    const chunk = await repo.time.list({ ...filters, page, perPage: 200 })
    entries.push(...chunk.items)
    if (page >= chunk.pages) break
  }

  // ponytail: one flat fetch for the name lookups, capped at 1000 each. Past
  // that, join in the driver instead of paging two more lists here.
  const [clients, tasks] = await Promise.all([
    repo.clients.list({ status: 'all', sort: 'name', dir: 'asc', page: 1, perPage: 1000 }),
    repo.tasks.list({ status: 'all', priority: 'all', sort: 'title', dir: 'asc', page: 1, perPage: 1000 }),
  ])
  const clientName = new Map(clients.items.map((c) => [c.id, c.name]))
  const taskTitle = new Map(tasks.items.map((t) => [t.id, t.title]))

  const rows = [
    ['Date', 'Client', 'Task', 'Minutes', 'Hours', 'Billable', 'Invoice', 'Note'],
    ...entries.map((e) => [
      e.workedOn,
      clientName.get(e.clientId) ?? e.clientId,
      taskTitle.get(e.taskId) ?? e.taskId,
      e.minutes,
      (e.minutes / 60).toFixed(2),
      e.billable ? 'yes' : 'no',
      e.invoiceId ?? '',
      e.note,
    ]),
  ]

  setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="forge-desk-time-${todayISO()}.csv"`)
  // CRLF: what RFC 4180 asks for and what Excel opens without a wizard.
  return rows.map((row) => row.map(cell).join(',')).join('\r\n')
})
