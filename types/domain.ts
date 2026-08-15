/**
 * Forge Desk domain model — shared by the Nitro server, the Vue app, and the
 * Flutter companion (which mirrors these shapes in lib/models/models.dart).
 *
 * Single source of truth: if a field changes here it changes in schema.sql,
 * server/utils/schema.ts and the Dart models. Keep the four in step.
 */

export type ClientStatus = "active" | "paused" | "archived";
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type InvoiceStatus = "draft" | "sent" | "paid" | "void";
export type UserRole = "owner" | "viewer";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  company: string;
  status: ClientStatus;
  notes: string;
  /** Billing rate in minor units (centavos/cents) to avoid float money bugs. */
  hourlyRateMinor: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  clientId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** ISO date (YYYY-MM-DD) or null when unscheduled. */
  dueDate: string | null;
  estimateMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  id: string;
  taskId: string;
  clientId: string;
  minutes: number;
  note: string;
  /** ISO date (YYYY-MM-DD) the work happened on. */
  workedOn: string;
  billable: boolean;
  /** Set once the entry lands on an invoice — blocks double billing. */
  invoiceId: string | null;
  createdAt: string;
}

export interface InvoiceLine {
  taskId: string;
  title: string;
  minutes: number;
  rateMinor: number;
  amountMinor: number;
}

export interface Invoice {
  id: string;
  clientId: string;
  /** Human-facing sequential number, e.g. FD-2026-0007. */
  number: string;
  status: InvoiceStatus;
  issuedOn: string;
  dueOn: string;
  currency: string;
  lines: InvoiceLine[];
  subtotalMinor: number;
  taxRateBp: number;
  taxMinor: number;
  totalMinor: number;
  createdAt: string;
}

export type ActivityAction =
  | "client.created"
  | "client.updated"
  | "client.archived"
  | "task.created"
  | "task.updated"
  | "task.completed"
  | "task.deleted"
  | "time.logged"
  | "invoice.created"
  | "invoice.sent"
  | "invoice.paid"
  | "auth.login"
  | "auth.logout";

export interface Activity {
  id: string;
  actorId: string;
  actorName: string;
  action: ActivityAction;
  /** Entity the action touched, e.g. "client:c1". */
  subject: string;
  summary: string;
  createdAt: string;
}

/* ---------- API envelopes ---------- */

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
}

export interface ClientQuery {
  q?: string;
  status?: ClientStatus | "all";
  sort?: "name" | "createdAt" | "updatedAt";
  dir?: "asc" | "desc";
  page?: number;
  perPage?: number;
}

export interface TaskQuery {
  q?: string;
  clientId?: string;
  status?: TaskStatus | "all";
  priority?: TaskPriority | "all";
  overdue?: boolean;
  sort?: "dueDate" | "priority" | "createdAt" | "title";
  dir?: "asc" | "desc";
  page?: number;
  perPage?: number;
}

export interface DashboardStats {
  clients: { total: number; active: number; paused: number; archived: number };
  tasks: {
    total: number;
    todo: number;
    inProgress: number;
    blocked: number;
    done: number;
    overdue: number;
    dueThisWeek: number;
  };
  time: {
    /** Last 14 days, oldest first — feeds the dashboard sparkline. */
    daily: { date: string; minutes: number }[];
    totalMinutes: number;
    billableMinutes: number;
  };
  revenue: {
    currency: string;
    outstandingMinor: number;
    paidMinor: number;
    unbilledMinor: number;
  };
}

/** Storage backend actually serving this request — surfaced in /api/health. */
export type DriverKind = "postgres" | "memory";
