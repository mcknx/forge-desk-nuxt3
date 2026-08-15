/**
 * Postgres storage driver (Neon in production).
 *
 * Schema lives in server/db/schema.sql and is loaded through Nitro server
 * assets so the DDL has exactly one definition — the file a reviewer reads is
 * the file that runs. Applying it is idempotent (CREATE ... IF NOT EXISTS), so
 * a cold start converges rather than needing a separate migration step.
 */
import postgres from 'postgres'
import { hashPassword } from './auth'
import type { Repo, StoredUser } from './repo'
import {
  PRIORITY_RANK,
  buildInvoiceLines,
  computeStats,
  newId,
  nextInvoiceNumber,
  todayISO,
  totalsFor,
} from './logic'
import type { Activity, Client, Invoice, Task, TimeEntry } from '~~/types/domain'
import seed from '../../data/seed.json'

type Row = Record<string, any>

const iso = (v: unknown): string =>
  v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : new Date(String(v)).toISOString()
const isoDay = (v: unknown): string => iso(v).slice(0, 10)
const isoDayOrNull = (v: unknown): string | null => (v == null ? null : isoDay(v))

const toClient = (r: Row): Client => ({
  id: r.id,
  name: r.name,
  email: r.email,
  company: r.company,
  status: r.status,
  notes: r.notes,
  hourlyRateMinor: Number(r.hourly_rate_minor),
  currency: r.currency,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
})

const toTask = (r: Row): Task => ({
  id: r.id,
  clientId: r.client_id,
  title: r.title,
  description: r.description,
  status: r.status,
  priority: r.priority,
  dueDate: isoDayOrNull(r.due_date),
  estimateMinutes: Number(r.estimate_minutes),
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
})

const toTimeEntry = (r: Row): TimeEntry => ({
  id: r.id,
  taskId: r.task_id,
  clientId: r.client_id,
  minutes: Number(r.minutes),
  note: r.note,
  workedOn: isoDay(r.worked_on),
  billable: r.billable,
  invoiceId: r.invoice_id ?? null,
  createdAt: iso(r.created_at),
})

const toInvoice = (r: Row): Invoice => ({
  id: r.id,
  clientId: r.client_id,
  number: r.number,
  status: r.status,
  issuedOn: isoDay(r.issued_on),
  dueOn: isoDay(r.due_on),
  currency: r.currency,
  lines: r.lines ?? [],
  subtotalMinor: Number(r.subtotal_minor),
  taxRateBp: Number(r.tax_rate_bp),
  taxMinor: Number(r.tax_minor),
  totalMinor: Number(r.total_minor),
  createdAt: iso(r.created_at),
})

const toActivity = (r: Row): Activity => ({
  id: r.id,
  actorId: r.actor_id,
  actorName: r.actor_name,
  action: r.action,
  subject: r.subject,
  summary: r.summary,
  createdAt: iso(r.created_at),
})

/**
 * Sort keys are mapped through this allow-list, never interpolated. A user
 * -supplied ORDER BY string reaching sql.unsafe is a SQL injection.
 */
const CLIENT_SORT: Record<string, string> = {
  name: 'name',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
}
const TASK_SORT: Record<string, string> = {
  dueDate: 'due_date',
  priority: 'priority_rank',
  createdAt: 'created_at',
  title: 'title',
}

export async function createPostgresRepo(url: string): Promise<Repo> {
  const sql = postgres(url, {
    // Neon and other poolers cap connections hard; a serverless instance only
    // ever serves one request at a time, so one socket is the right size.
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: url.includes('sslmode=disable') ? false : 'require',
    transform: { undefined: null },
  })

  await applySchema(sql)
  await seedIfEmpty(sql)

  const page = <T>(rows: Row[], map: (r: Row) => T, pageNo: number, perPage: number) => {
    const total = Number(rows[0]?.total_count ?? 0)
    const pages = Math.max(1, Math.ceil(total / perPage))
    return { items: rows.map(map), total, page: Math.min(pageNo, pages), perPage, pages }
  }

  return {
    kind: 'postgres',

    users: {
      async findByEmail(email) {
        const [row] = await sql`SELECT * FROM users WHERE lower(email) = lower(${email}) LIMIT 1`
        if (!row) return null
        return {
          id: row.id,
          email: row.email,
          name: row.name,
          role: row.role,
          createdAt: iso(row.created_at),
          passwordHash: row.password_hash,
        } satisfies StoredUser
      },
      async get(id) {
        const [row] = await sql`SELECT id, email, name, role, created_at FROM users WHERE id = ${id}`
        return row ? { id: row.id, email: row.email, name: row.name, role: row.role, createdAt: iso(row.created_at) } : null
      },
    },

    clients: {
      async list(query) {
        const column = CLIENT_SORT[query.sort] ?? 'name'
        const direction = query.dir === 'desc' ? sql`DESC` : sql`ASC`
        const like = query.q ? `%${query.q}%` : null
        const rows = await sql`
          SELECT *, count(*) OVER () AS total_count
          FROM clients
          WHERE (${query.status === 'all'} OR status = ${query.status})
            AND (${like}::text IS NULL OR name ILIKE ${like} OR company ILIKE ${like}
                 OR email ILIKE ${like} OR notes ILIKE ${like})
          ORDER BY ${sql(column)} ${direction}
          LIMIT ${query.perPage} OFFSET ${(query.page - 1) * query.perPage}
        `
        return page(rows, toClient, query.page, query.perPage)
      },
      async get(id) {
        const [row] = await sql`SELECT * FROM clients WHERE id = ${id}`
        return row ? toClient(row) : null
      },
      async create(input) {
        const [row] = await sql`
          INSERT INTO clients (id, name, email, company, status, notes, hourly_rate_minor, currency)
          VALUES (${newId('c')}, ${input.name}, ${input.email}, ${input.company}, ${input.status},
                  ${input.notes}, ${input.hourlyRateMinor}, ${input.currency})
          RETURNING *
        `
        return toClient(row)
      },
      async update(id, patch) {
        const set: Row = { updated_at: new Date() }
        if (patch.name !== undefined) set.name = patch.name
        if (patch.email !== undefined) set.email = patch.email
        if (patch.company !== undefined) set.company = patch.company
        if (patch.status !== undefined) set.status = patch.status
        if (patch.notes !== undefined) set.notes = patch.notes
        if (patch.hourlyRateMinor !== undefined) set.hourly_rate_minor = patch.hourlyRateMinor
        if (patch.currency !== undefined) set.currency = patch.currency
        const [row] = await sql`UPDATE clients SET ${sql(set)} WHERE id = ${id} RETURNING *`
        return row ? toClient(row) : null
      },
      async remove(id) {
        const rows = await sql`DELETE FROM clients WHERE id = ${id} RETURNING id`
        return rows.length > 0
      },
    },

    tasks: {
      async list(query) {
        const column = TASK_SORT[query.sort] ?? 'due_date'
        const direction = query.dir === 'desc' ? sql`DESC` : sql`ASC`
        const like = query.q ? `%${query.q}%` : null
        const rows = await sql`
          SELECT *,
                 CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END AS priority_rank,
                 count(*) OVER () AS total_count
          FROM tasks
          WHERE (${query.clientId ?? null}::text IS NULL OR client_id = ${query.clientId ?? null})
            AND (${query.status === 'all'} OR status = ${query.status})
            AND (${query.priority === 'all'} OR priority = ${query.priority})
            AND (${!query.overdue} OR (status <> 'done' AND due_date < ${todayISO()}::date))
            AND (${like}::text IS NULL OR title ILIKE ${like} OR description ILIKE ${like})
          ORDER BY ${sql(column)} ${direction} NULLS LAST
          LIMIT ${query.perPage} OFFSET ${(query.page - 1) * query.perPage}
        `
        return page(rows, toTask, query.page, query.perPage)
      },
      async get(id) {
        const [row] = await sql`SELECT * FROM tasks WHERE id = ${id}`
        return row ? toTask(row) : null
      },
      async create(input) {
        const [row] = await sql`
          INSERT INTO tasks (id, client_id, title, description, status, priority, due_date, estimate_minutes)
          VALUES (${newId('t')}, ${input.clientId}, ${input.title}, ${input.description}, ${input.status},
                  ${input.priority}, ${input.dueDate}, ${input.estimateMinutes})
          RETURNING *
        `
        return toTask(row)
      },
      async update(id, patch) {
        const set: Row = { updated_at: new Date() }
        if (patch.title !== undefined) set.title = patch.title
        if (patch.description !== undefined) set.description = patch.description
        if (patch.status !== undefined) set.status = patch.status
        if (patch.priority !== undefined) set.priority = patch.priority
        if (patch.dueDate !== undefined) set.due_date = patch.dueDate
        if (patch.estimateMinutes !== undefined) set.estimate_minutes = patch.estimateMinutes
        const [row] = await sql`UPDATE tasks SET ${sql(set)} WHERE id = ${id} RETURNING *`
        return row ? toTask(row) : null
      },
      async remove(id) {
        const rows = await sql`DELETE FROM tasks WHERE id = ${id} RETURNING id`
        return rows.length > 0
      },
    },

    time: {
      async list(query) {
        const rows = await sql`
          SELECT *, count(*) OVER () AS total_count
          FROM time_entries
          WHERE (${query.clientId ?? null}::text IS NULL OR client_id = ${query.clientId ?? null})
            AND (${query.taskId ?? null}::text IS NULL OR task_id = ${query.taskId ?? null})
            AND (${query.from ?? null}::date IS NULL OR worked_on >= ${query.from ?? null}::date)
            AND (${query.to ?? null}::date IS NULL OR worked_on <= ${query.to ?? null}::date)
            AND (${!query.unbilledOnly} OR (billable AND invoice_id IS NULL))
          ORDER BY worked_on DESC, created_at DESC
          LIMIT ${query.perPage} OFFSET ${(query.page - 1) * query.perPage}
        `
        return page(rows, toTimeEntry, query.page, query.perPage)
      },
      async create(input) {
        const [task] = await sql`SELECT client_id FROM tasks WHERE id = ${input.taskId}`
        if (!task) throw new Error(`unknown task ${input.taskId}`)
        const [row] = await sql`
          INSERT INTO time_entries (id, task_id, client_id, minutes, note, worked_on, billable)
          VALUES (${newId('te')}, ${input.taskId}, ${task.client_id}, ${input.minutes}, ${input.note},
                  ${input.workedOn}, ${input.billable})
          RETURNING *
        `
        return toTimeEntry(row)
      },
      async remove(id) {
        const rows = await sql`DELETE FROM time_entries WHERE id = ${id} AND invoice_id IS NULL RETURNING id`
        return rows.length > 0
      },
    },

    invoices: {
      async list(clientId) {
        const rows = clientId
          ? await sql`SELECT * FROM invoices WHERE client_id = ${clientId} ORDER BY issued_on DESC`
          : await sql`SELECT * FROM invoices ORDER BY issued_on DESC`
        return rows.map(toInvoice)
      },
      async get(id) {
        const [row] = await sql`SELECT * FROM invoices WHERE id = ${id}`
        return row ? toInvoice(row) : null
      },
      async createFromUnbilled(input) {
        // One transaction: building the invoice and marking its time billed
        // must not half-apply, or the same hours get billed twice.
        return sql.begin(async (tx) => {
          const [client] = await tx`SELECT * FROM clients WHERE id = ${input.clientId} FOR UPDATE`
          if (!client) throw new Error(`unknown client ${input.clientId}`)

          const pool = await tx`
            SELECT * FROM time_entries
            WHERE client_id = ${input.clientId} AND billable AND invoice_id IS NULL
            FOR UPDATE
          `
          if (pool.length === 0) throw new Error('no unbilled billable time for this client')

          const taskRows = await tx`
            SELECT id, title FROM tasks WHERE id IN ${tx(pool.map((e: Row) => e.task_id))}
          `
          const lines = buildInvoiceLines(
            pool.map(toTimeEntry),
            taskRows.map((t: Row) => ({ id: t.id, title: t.title })),
            Number(client.hourly_rate_minor),
          )
          const totals = totalsFor(lines, input.taxRateBp)
          const existing = await tx`SELECT number FROM invoices`
          const id = newId('inv')

          const [row] = await tx`
            INSERT INTO invoices (id, client_id, number, status, issued_on, due_on, currency, lines,
                                  subtotal_minor, tax_rate_bp, tax_minor, total_minor)
            VALUES (${id}, ${input.clientId},
                    ${nextInvoiceNumber(existing as any, Number(input.issuedOn.slice(0, 4)))},
                    'draft', ${input.issuedOn}, ${input.dueOn}, ${client.currency},
                    ${JSON.stringify(lines)}::jsonb,
                    ${totals.subtotalMinor}, ${input.taxRateBp}, ${totals.taxMinor}, ${totals.totalMinor})
            RETURNING *
          `
          await tx`UPDATE time_entries SET invoice_id = ${id} WHERE id IN ${tx(pool.map((e: Row) => e.id))}`
          return toInvoice(row)
        })
      },
      async setStatus(id, status) {
        const [row] = await sql`UPDATE invoices SET status = ${status} WHERE id = ${id} RETURNING *`
        return row ? toInvoice(row) : null
      },
      async remove(id) {
        const rows = await sql`DELETE FROM invoices WHERE id = ${id} RETURNING id`
        return rows.length > 0
      },
    },

    activity: {
      async list(limit = 25) {
        const rows = await sql`SELECT * FROM activity ORDER BY created_at DESC LIMIT ${limit}`
        return rows.map(toActivity)
      },
      async log({ actor, action, subject, summary }) {
        const [row] = await sql`
          INSERT INTO activity (id, actor_id, actor_name, action, subject, summary)
          VALUES (${newId('a')}, ${actor.id}, ${actor.name}, ${action}, ${subject}, ${summary})
          RETURNING *
        `
        return toActivity(row)
      },
    },

    async stats() {
      // Five small parallel reads beat one clever join here: the dataset is
      // tiny and computeStats is already shared with the memory driver, so the
      // dashboard numbers cannot disagree between the two backends.
      const [clients, tasks, entries, invoices] = await Promise.all([
        sql`SELECT * FROM clients`,
        sql`SELECT * FROM tasks`,
        sql`SELECT * FROM time_entries WHERE worked_on >= current_date - INTERVAL '90 days'`,
        sql`SELECT * FROM invoices`,
      ])
      return computeStats(
        clients.map(toClient),
        tasks.map(toTask),
        entries.map(toTimeEntry),
        invoices.map(toInvoice),
        todayISO(),
      )
    },

    async reset() {
      await sql`TRUNCATE activity, time_entries, invoices, tasks, clients, users CASCADE`
      await seedIfEmpty(sql)
    },
  }
}

async function applySchema(sql: postgres.Sql) {
  const ddl = (await useStorage('assets:db').getItem('schema.sql')) as string | null
  if (!ddl) throw new Error('server/db/schema.sql not found in server assets')
  await sql.unsafe(ddl)
}

async function seedIfEmpty(sql: postgres.Sql) {
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM clients`
  if (count > 0) return

  const passwordHash = await hashPassword(process.env.DEMO_PASSWORD || 'forge-desk-demo')
  const s = seed as any

  await sql.begin(async (tx) => {
    for (const u of s.users) {
      await tx`INSERT INTO users (id, email, name, role, password_hash, created_at)
               VALUES (${u.id}, ${u.email}, ${u.name}, ${u.role}, ${passwordHash}, ${u.createdAt})`
    }
    for (const c of s.clients) {
      await tx`INSERT INTO clients (id, name, email, company, status, notes, hourly_rate_minor, currency, created_at, updated_at)
               VALUES (${c.id}, ${c.name}, ${c.email}, ${c.company}, ${c.status}, ${c.notes},
                       ${c.hourlyRateMinor}, ${c.currency}, ${c.createdAt}, ${c.updatedAt})`
    }
    for (const t of s.tasks) {
      await tx`INSERT INTO tasks (id, client_id, title, description, status, priority, due_date, estimate_minutes, created_at, updated_at)
               VALUES (${t.id}, ${t.clientId}, ${t.title}, ${t.description}, ${t.status}, ${t.priority},
                       ${t.dueDate}, ${t.estimateMinutes}, ${t.createdAt}, ${t.updatedAt})`
    }
    // Invoices before time entries — the FK on invoice_id needs the target row.
    for (const i of s.invoices) {
      await tx`INSERT INTO invoices (id, client_id, number, status, issued_on, due_on, currency, lines,
                                     subtotal_minor, tax_rate_bp, tax_minor, total_minor, created_at)
               VALUES (${i.id}, ${i.clientId}, ${i.number}, ${i.status}, ${i.issuedOn}, ${i.dueOn}, ${i.currency},
                       ${JSON.stringify(i.lines)}::jsonb, ${i.subtotalMinor}, ${i.taxRateBp}, ${i.taxMinor},
                       ${i.totalMinor}, ${i.createdAt})`
    }
    for (const e of s.timeEntries) {
      await tx`INSERT INTO time_entries (id, task_id, client_id, minutes, note, worked_on, billable, invoice_id, created_at)
               VALUES (${e.id}, ${e.taskId}, ${e.clientId}, ${e.minutes}, ${e.note}, ${e.workedOn},
                       ${e.billable}, ${e.invoiceId}, ${e.createdAt})`
    }
    for (const a of s.activity) {
      await tx`INSERT INTO activity (id, actor_id, actor_name, action, subject, summary, created_at)
               VALUES (${a.id}, ${a.actorId}, ${a.actorName}, ${a.action}, ${a.subject}, ${a.summary}, ${a.createdAt})`
    }
  })
}
