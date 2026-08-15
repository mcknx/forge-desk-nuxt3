/**
 * Pure domain logic — no I/O, no framework. Both storage drivers call these so
 * "what an invoice total is" has exactly one definition, and the unit tests can
 * exercise the rules without a database.
 */
import type {
  Client,
  DashboardStats,
  Invoice,
  InvoiceLine,
  Task,
  TaskPriority,
  TimeEntry
} from "~~/types/domain";

export const PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3
};

/** Sortable ids: time-ordered prefix keeps list ordering stable without a sequence. */
export function newId(prefix: string, now = Date.now()): string {
  return `${prefix}_${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function todayISO(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isOverdue(
  task: Pick<Task, "status" | "dueDate">,
  today = todayISO()
): boolean {
  // A closed task is never overdue, however late it was finished.
  return task.status !== "done" && !!task.dueDate && task.dueDate < today;
}

export function isDueThisWeek(
  task: Pick<Task, "status" | "dueDate">,
  today = todayISO()
): boolean {
  if (task.status === "done" || !task.dueDate) return false;
  return task.dueDate >= today && task.dueDate <= addDaysISO(today, 7);
}

/**
 * Minutes → money in minor units. Rounds once, at the end, on integers —
 * rounding per-entry is how invoices drift a few cents from the timesheet.
 */
export function minutesToMinor(minutes: number, hourlyRateMinor: number): number {
  return Math.round((minutes * hourlyRateMinor) / 60);
}

/** Groups billable time by task into invoice lines. Empty in → empty out. */
export function buildInvoiceLines(
  entries: TimeEntry[],
  tasks: Pick<Task, "id" | "title">[],
  hourlyRateMinor: number
): InvoiceLine[] {
  const titles = new Map(tasks.map((t) => [t.id, t.title]));
  const byTask = new Map<string, number>();
  for (const entry of entries) {
    byTask.set(entry.taskId, (byTask.get(entry.taskId) ?? 0) + entry.minutes);
  }
  return [...byTask.entries()]
    .map(([taskId, minutes]) => ({
      taskId,
      title: titles.get(taskId) ?? "Unlabelled work",
      minutes,
      rateMinor: hourlyRateMinor,
      amountMinor: minutesToMinor(minutes, hourlyRateMinor)
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor);
}

export function totalsFor(lines: InvoiceLine[], taxRateBp: number) {
  const subtotalMinor = lines.reduce((sum, l) => sum + l.amountMinor, 0);
  const taxMinor = Math.round((subtotalMinor * taxRateBp) / 10_000);
  return { subtotalMinor, taxMinor, totalMinor: subtotalMinor + taxMinor };
}

export function nextInvoiceNumber(
  existing: Pick<Invoice, "number">[],
  year: number
): string {
  const prefix = `FD-${year}-`;
  const highest = existing
    .filter((i) => i.number.startsWith(prefix))
    .map((i) => Number.parseInt(i.number.slice(prefix.length), 10))
    .filter((n) => Number.isFinite(n))
    .reduce((max, n) => Math.max(max, n), 0);
  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}

/** Last `days` days of logged minutes, oldest first, gaps filled with zero. */
export function dailyMinutes(
  entries: TimeEntry[],
  days = 14,
  today = todayISO()
): { date: string; minutes: number }[] {
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) buckets.set(addDaysISO(today, -i), 0);
  for (const entry of entries) {
    if (buckets.has(entry.workedOn)) {
      buckets.set(entry.workedOn, buckets.get(entry.workedOn)! + entry.minutes);
    }
  }
  return [...buckets.entries()].map(([date, minutes]) => ({ date, minutes }));
}

export function computeStats(
  clients: Client[],
  tasks: Task[],
  entries: TimeEntry[],
  invoices: Invoice[],
  today = todayISO()
): DashboardStats {
  const rateOf = new Map(clients.map((c) => [c.id, c.hourlyRateMinor]));
  const unbilledMinor = entries
    .filter((e) => e.billable && !e.invoiceId)
    .reduce((sum, e) => sum + minutesToMinor(e.minutes, rateOf.get(e.clientId) ?? 0), 0);

  return {
    clients: {
      total: clients.length,
      active: clients.filter((c) => c.status === "active").length,
      paused: clients.filter((c) => c.status === "paused").length,
      archived: clients.filter((c) => c.status === "archived").length
    },
    tasks: {
      total: tasks.length,
      todo: tasks.filter((t) => t.status === "todo").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      blocked: tasks.filter((t) => t.status === "blocked").length,
      done: tasks.filter((t) => t.status === "done").length,
      overdue: tasks.filter((t) => isOverdue(t, today)).length,
      dueThisWeek: tasks.filter((t) => isDueThisWeek(t, today)).length
    },
    time: {
      daily: dailyMinutes(entries, 14, today),
      totalMinutes: entries.reduce((sum, e) => sum + e.minutes, 0),
      billableMinutes: entries
        .filter((e) => e.billable)
        .reduce((sum, e) => sum + e.minutes, 0)
    },
    revenue: {
      // Mixed-currency desks need per-currency totals; this demo reports the
      // majority currency and is honest about it in the UI.
      currency: clients[0]?.currency ?? "USD",
      outstandingMinor: invoices
        .filter((i) => i.status === "sent")
        .reduce((s, i) => s + i.totalMinor, 0),
      paidMinor: invoices
        .filter((i) => i.status === "paid")
        .reduce((s, i) => s + i.totalMinor, 0),
      unbilledMinor
    }
  };
}

/** Shared list pipeline so both drivers page and sort identically. */
export function paginate<T>(items: T[], page: number, perPage: number) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, pages);
  return {
    items: items.slice((safePage - 1) * perPage, safePage * perPage),
    total,
    page: safePage,
    perPage,
    pages
  };
}

export function matches(
  haystacks: (string | null | undefined)[],
  needle?: string
): boolean {
  if (!needle) return true;
  const q = needle.toLowerCase();
  return haystacks.some((h) => (h ?? "").toLowerCase().includes(q));
}
