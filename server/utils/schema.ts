/**
 * Every request body and query string crosses a trust boundary, so nothing
 * reaches the repository without passing through here first.
 */
import { z } from "zod";

export const CLIENT_STATUSES = ["active", "paused", "archived"] as const;
export const TASK_STATUSES = ["todo", "in_progress", "blocked", "done"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const INVOICE_STATUSES = ["draft", "sent", "paid", "void"] as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(v)), "not a real date");

/* ---------- clients ---------- */

export const clientCreateSchema = z.object({
  name: z.string().trim().min(2, "name must be at least 2 characters").max(120),
  email: z.string().trim().email("must be a valid email").max(200),
  company: z.string().trim().max(160).default(""),
  status: z.enum(CLIENT_STATUSES).default("active"),
  notes: z.string().trim().max(2000).default(""),
  // Money stays in minor units end to end. Floats and money do not mix.
  hourlyRateMinor: z.number().int().min(0).max(100_000_00).default(0),
  currency: z.string().trim().length(3).toUpperCase().default("USD")
});

export const clientUpdateSchema = clientCreateSchema.partial();

/* ---------- tasks ---------- */

export const taskCreateSchema = z.object({
  clientId: z.string().trim().min(1, "clientId is required"),
  title: z.string().trim().min(3, "title must be at least 3 characters").max(200),
  description: z.string().trim().max(4000).default(""),
  status: z.enum(TASK_STATUSES).default("todo"),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  dueDate: isoDate.nullable().default(null),
  estimateMinutes: z
    .number()
    .int()
    .min(0)
    .max(60 * 24 * 90)
    .default(0)
});

export const taskUpdateSchema = taskCreateSchema.partial().omit({ clientId: true });

/* ---------- time ---------- */

export const timeCreateSchema = z.object({
  taskId: z.string().trim().min(1),
  minutes: z
    .number()
    .int()
    .min(1, "log at least a minute")
    .max(60 * 16, "over 16h in one entry is a typo"),
  note: z.string().trim().max(500).default(""),
  workedOn: isoDate,
  billable: z.boolean().default(true)
});

/* ---------- invoices ---------- */

export const invoiceCreateSchema = z.object({
  clientId: z.string().trim().min(1),
  issuedOn: isoDate,
  dueOn: isoDate,
  // Basis points: 1200 = 12%. Integer maths, no float tax drift.
  taxRateBp: z.number().int().min(0).max(10_000).default(0)
});

export const invoiceStatusSchema = z.object({
  status: z.enum(INVOICE_STATUSES)
});

/* ---------- auth ---------- */

export const loginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1, "password is required").max(200)
});

/* ---------- query strings ---------- */

// Query values arrive as strings; coerce before validating so `?page=2` works.
const pageFields = {
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20)
};

export const clientQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum([...CLIENT_STATUSES, "all"]).default("all"),
  sort: z.enum(["name", "createdAt", "updatedAt"]).default("name"),
  dir: z.enum(["asc", "desc"]).default("asc"),
  ...pageFields
});

export const taskQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  clientId: z.string().trim().optional(),
  status: z.enum([...TASK_STATUSES, "all"]).default("all"),
  priority: z.enum([...TASK_PRIORITIES, "all"]).default("all"),
  overdue: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  sort: z.enum(["dueDate", "priority", "createdAt", "title"]).default("dueDate"),
  dir: z.enum(["asc", "desc"]).default("asc"),
  ...pageFields
});

export const timeQuerySchema = z.object({
  clientId: z.string().trim().optional(),
  taskId: z.string().trim().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  unbilledOnly: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  ...pageFields
});

export const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(25)
});

export const invoiceQuerySchema = z.object({
  // `?clientId=` is how a cleared filter arrives; treated as "no filter" rather
  // than as a 422, the same as leaving the key off entirely.
  clientId: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined)
});

export type ClientCreate = z.infer<typeof clientCreateSchema>;
export type ClientUpdate = z.infer<typeof clientUpdateSchema>;
export type TaskCreate = z.infer<typeof taskCreateSchema>;
export type TaskUpdate = z.infer<typeof taskUpdateSchema>;
export type TimeCreate = z.infer<typeof timeCreateSchema>;
export type InvoiceCreate = z.infer<typeof invoiceCreateSchema>;
export type ClientQueryInput = z.infer<typeof clientQuerySchema>;
export type TaskQueryInput = z.infer<typeof taskQuerySchema>;
export type TimeQueryInput = z.infer<typeof timeQuerySchema>;
