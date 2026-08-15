/**
 * In-process storage driver. Serves the demo when no DATABASE_URL is set and
 * backs the whole test suite, so it has to obey exactly the same rules as the
 * Postgres driver — same filters, same sort order, same invoice maths.
 *
 * Honest limit: state lives in one lambda instance, so a serverless cold start
 * resets it. That is why the UI shows a "demo data" banner when this driver is
 * live, and why /api/health names the driver.
 */
import seed from '../../data/seed.json'
import { hashPassword } from './auth'
import type { Repo, StoredUser } from './repo'
import {
  PRIORITY_RANK,
  buildInvoiceLines,
  computeStats,
  isOverdue,
  matches,
  newId,
  nextInvoiceNumber,
  paginate,
  todayISO,
  totalsFor,
} from './logic'
import type { Activity, Client, Invoice, Task, TimeEntry } from '~~/types/domain'

interface State {
  users: StoredUser[]
  clients: Client[]
  tasks: Task[]
  timeEntries: TimeEntry[]
  invoices: Invoice[]
  activity: Activity[]
}

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'forge-desk-demo'

async function freshState(): Promise<State> {
  // Everyone in the demo shares one password; it is published in the README on
  // purpose. Still stored hashed, because the login path being real is the
  // point of the exercise.
  const passwordHash = await hashPassword(DEMO_PASSWORD)
  const clone = structuredClone(seed) as unknown as Omit<State, 'users'> & { users: Omit<StoredUser, 'passwordHash'>[] }
  return {
    users: clone.users.map((u) => ({ ...u, passwordHash })),
    clients: clone.clients,
    tasks: clone.tasks,
    timeEntries: clone.timeEntries,
    invoices: clone.invoices,
    activity: clone.activity,
  }
}

export async function createMemoryRepo(): Promise<Repo> {
  let state = await freshState()
  const now = () => new Date().toISOString()

  const sortClients = (items: Client[], sort: string, dir: string) => {
    const sign = dir === 'desc' ? -1 : 1
    return [...items].sort((a, b) => {
      if (sort === 'name') return sign * a.name.localeCompare(b.name)
      const key = sort === 'updatedAt' ? 'updatedAt' : 'createdAt'
      return sign * a[key].localeCompare(b[key])
    })
  }

  const sortTasks = (items: Task[], sort: string, dir: string) => {
    const sign = dir === 'desc' ? -1 : 1
    return [...items].sort((a, b) => {
      switch (sort) {
        case 'priority':
          return sign * (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
        case 'title':
          return sign * a.title.localeCompare(b.title)
        case 'createdAt':
          return sign * a.createdAt.localeCompare(b.createdAt)
        default:
          // Undated tasks sink to the bottom either way — a null due date is
          // "someday", not ""the year 1970".
          if (!a.dueDate && !b.dueDate) return 0
          if (!a.dueDate) return 1
          if (!b.dueDate) return -1
          return sign * a.dueDate.localeCompare(b.dueDate)
      }
    })
  }

  return {
    kind: 'memory',

    users: {
      async findByEmail(email) {
        return state.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null
      },
      async get(id) {
        const user = state.users.find((u) => u.id === id)
        if (!user) return null
        const { passwordHash: _drop, ...safe } = user
        return safe
      },
    },

    clients: {
      async list(query) {
        let items = state.clients
        if (query.status !== 'all') items = items.filter((c) => c.status === query.status)
        if (query.q) items = items.filter((c) => matches([c.name, c.company, c.email, c.notes], query.q))
        return paginate(sortClients(items, query.sort, query.dir), query.page, query.perPage)
      },
      async get(id) {
        return state.clients.find((c) => c.id === id) ?? null
      },
      async create(input) {
        const ts = now()
        const client: Client = { ...input, id: newId('c'), createdAt: ts, updatedAt: ts }
        state.clients.push(client)
        return client
      },
      async update(id, patch) {
        const idx = state.clients.findIndex((c) => c.id === id)
        if (idx === -1) return null
        state.clients[idx] = { ...state.clients[idx], ...patch, updatedAt: now() }
        return state.clients[idx]
      },
      async remove(id) {
        const before = state.clients.length
        state.clients = state.clients.filter((c) => c.id !== id)
        if (state.clients.length === before) return false
        // Mirrors the ON DELETE CASCADE in schema.sql.
        const taskIds = new Set(state.tasks.filter((t) => t.clientId === id).map((t) => t.id))
        state.tasks = state.tasks.filter((t) => t.clientId !== id)
        state.timeEntries = state.timeEntries.filter((e) => !taskIds.has(e.taskId) && e.clientId !== id)
        state.invoices = state.invoices.filter((i) => i.clientId !== id)
        return true
      },
    },

    tasks: {
      async list(query) {
        let items = state.tasks
        if (query.clientId) items = items.filter((t) => t.clientId === query.clientId)
        if (query.status !== 'all') items = items.filter((t) => t.status === query.status)
        if (query.priority !== 'all') items = items.filter((t) => t.priority === query.priority)
        if (query.overdue) items = items.filter((t) => isOverdue(t))
        if (query.q) items = items.filter((t) => matches([t.title, t.description], query.q))
        return paginate(sortTasks(items, query.sort, query.dir), query.page, query.perPage)
      },
      async get(id) {
        return state.tasks.find((t) => t.id === id) ?? null
      },
      async create(input) {
        const ts = now()
        const task: Task = { ...input, id: newId('t'), createdAt: ts, updatedAt: ts }
        state.tasks.push(task)
        return task
      },
      async update(id, patch) {
        const idx = state.tasks.findIndex((t) => t.id === id)
        if (idx === -1) return null
        state.tasks[idx] = { ...state.tasks[idx], ...patch, updatedAt: now() }
        return state.tasks[idx]
      },
      async remove(id) {
        const before = state.tasks.length
        state.tasks = state.tasks.filter((t) => t.id !== id)
        state.timeEntries = state.timeEntries.filter((e) => e.taskId !== id)
        return state.tasks.length < before
      },
    },

    time: {
      async list(query) {
        let items = state.timeEntries
        if (query.clientId) items = items.filter((e) => e.clientId === query.clientId)
        if (query.taskId) items = items.filter((e) => e.taskId === query.taskId)
        if (query.from) items = items.filter((e) => e.workedOn >= query.from!)
        if (query.to) items = items.filter((e) => e.workedOn <= query.to!)
        if (query.unbilledOnly) items = items.filter((e) => e.billable && !e.invoiceId)
        const sorted = [...items].sort((a, b) => b.workedOn.localeCompare(a.workedOn))
        return paginate(sorted, query.page, query.perPage)
      },
      async create(input) {
        const task = state.tasks.find((t) => t.id === input.taskId)
        if (!task) throw new Error(`unknown task ${input.taskId}`)
        const entry: TimeEntry = {
          ...input,
          id: newId('te'),
          clientId: task.clientId,
          invoiceId: null,
          createdAt: now(),
        }
        state.timeEntries.push(entry)
        return entry
      },
      async remove(id) {
        const before = state.timeEntries.length
        // Billed time is immutable — unbill it by deleting the invoice instead.
        state.timeEntries = state.timeEntries.filter((e) => e.id !== id || e.invoiceId !== null)
        return state.timeEntries.length < before
      },
    },

    invoices: {
      async list(clientId) {
        const items = clientId ? state.invoices.filter((i) => i.clientId === clientId) : state.invoices
        return [...items].sort((a, b) => b.issuedOn.localeCompare(a.issuedOn))
      },
      async get(id) {
        return state.invoices.find((i) => i.id === id) ?? null
      },
      async createFromUnbilled(input) {
        const client = state.clients.find((c) => c.id === input.clientId)
        if (!client) throw new Error(`unknown client ${input.clientId}`)
        const pool = state.timeEntries.filter((e) => e.clientId === client.id && e.billable && !e.invoiceId)
        if (pool.length === 0) throw new Error('no unbilled billable time for this client')

        const lines = buildInvoiceLines(pool, state.tasks, client.hourlyRateMinor)
        const invoice: Invoice = {
          id: newId('inv'),
          clientId: client.id,
          number: nextInvoiceNumber(state.invoices, Number(input.issuedOn.slice(0, 4))),
          status: 'draft',
          issuedOn: input.issuedOn,
          dueOn: input.dueOn,
          currency: client.currency,
          lines,
          taxRateBp: input.taxRateBp,
          ...totalsFor(lines, input.taxRateBp),
          createdAt: now(),
        }
        state.invoices.push(invoice)
        for (const entry of pool) entry.invoiceId = invoice.id
        return invoice
      },
      async setStatus(id, status) {
        const invoice = state.invoices.find((i) => i.id === id)
        if (!invoice) return null
        invoice.status = status
        return invoice
      },
      async remove(id) {
        const before = state.invoices.length
        state.invoices = state.invoices.filter((i) => i.id !== id)
        if (state.invoices.length === before) return false
        // Return the time to the unbilled pool — see the SET NULL in schema.sql.
        for (const entry of state.timeEntries) {
          if (entry.invoiceId === id) entry.invoiceId = null
        }
        return true
      },
    },

    activity: {
      async list(limit = 25) {
        return state.activity.slice(0, limit)
      },
      async log({ actor, action, subject, summary }) {
        const entry: Activity = {
          id: newId('a'),
          actorId: actor.id,
          actorName: actor.name,
          action,
          subject,
          summary,
          createdAt: now(),
        }
        state.activity.unshift(entry)
        // Unbounded growth in a long-lived instance is a leak; 500 is plenty
        // for a feed nobody pages past 25 of.
        if (state.activity.length > 500) state.activity.length = 500
        return entry
      },
    },

    async stats() {
      return computeStats(state.clients, state.tasks, state.timeEntries, state.invoices, todayISO())
    },

    async reset() {
      state = await freshState()
    },
  }
}
