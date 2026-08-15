/**
 * Storage contract.
 *
 * Two drivers implement it: Postgres when DATABASE_URL is set, and an
 * in-process store when it isn't. That is not indirection for its own sake —
 * it is what lets the demo stay live before Neon is wired, lets CI run the
 * whole suite with no database service, and lets a reviewer clone the repo and
 * see real data on `npm run dev` with zero setup.
 *
 * /api/health reports which driver answered, so nothing about it is hidden.
 */
import type {
  Activity,
  ActivityAction,
  Client,
  DashboardStats,
  DriverKind,
  Invoice,
  InvoiceStatus,
  Page,
  Task,
  TimeEntry,
  User,
} from '~~/types/domain'
import type {
  ClientCreate,
  ClientQueryInput,
  ClientUpdate,
  InvoiceCreate,
  TaskCreate,
  TaskQueryInput,
  TaskUpdate,
  TimeCreate,
  TimeQueryInput,
} from './schema'

export interface StoredUser extends User {
  passwordHash: string
}

export interface Repo {
  readonly kind: DriverKind
  users: {
    findByEmail(email: string): Promise<StoredUser | null>
    get(id: string): Promise<User | null>
  }
  clients: {
    list(query: ClientQueryInput): Promise<Page<Client>>
    get(id: string): Promise<Client | null>
    create(input: ClientCreate): Promise<Client>
    update(id: string, patch: ClientUpdate): Promise<Client | null>
    remove(id: string): Promise<boolean>
  }
  tasks: {
    list(query: TaskQueryInput): Promise<Page<Task>>
    get(id: string): Promise<Task | null>
    create(input: TaskCreate): Promise<Task>
    update(id: string, patch: TaskUpdate): Promise<Task | null>
    remove(id: string): Promise<boolean>
  }
  time: {
    list(query: TimeQueryInput): Promise<Page<TimeEntry>>
    create(input: TimeCreate): Promise<TimeEntry>
    remove(id: string): Promise<boolean>
  }
  invoices: {
    list(clientId?: string): Promise<Invoice[]>
    get(id: string): Promise<Invoice | null>
    /** Bills every unbilled billable entry for the client. Throws if there is none. */
    createFromUnbilled(input: InvoiceCreate): Promise<Invoice>
    setStatus(id: string, status: InvoiceStatus): Promise<Invoice | null>
    remove(id: string): Promise<boolean>
  }
  activity: {
    list(limit?: number): Promise<Activity[]>
    log(entry: { actor: User; action: ActivityAction; subject: string; summary: string }): Promise<Activity>
  }
  stats(): Promise<DashboardStats>
  /** Restores seed data. Powers the demo's "reset" button and test isolation. */
  reset(): Promise<void>
}

let cached: Repo | null = null

/**
 * Nitro reuses the module scope across requests in one lambda instance, so the
 * driver — and with it the Postgres pool — is built once per instance, not per
 * request. Opening a connection per request is the classic way to exhaust a
 * serverless database's connection limit.
 */
export async function useRepo(): Promise<Repo> {
  if (cached) return cached

  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (url) {
    try {
      const { createPostgresRepo } = await import('./repo-postgres')
      cached = await createPostgresRepo(url)
      return cached
    } catch (error) {
      // A bad connection string must not take the whole site down — degrade to
      // the in-process store and say so loudly in the log and on /api/health.
      console.error('[forge-desk] Postgres unavailable, falling back to memory driver:', error)
    }
  }

  const { createMemoryRepo } = await import('./repo-memory')
  cached = await createMemoryRepo()
  return cached
}

/** Test hook — drops the cached driver so the next useRepo() rebuilds it. */
export function __resetRepoCache() {
  cached = null
}
