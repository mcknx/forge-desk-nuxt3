-- Forge Desk schema. Applied by server/utils/repo-postgres.ts on first request.
-- Idempotent: safe to run on every cold start, which is what makes a
-- migration-less serverless deploy workable at this size.

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'viewer',
  -- scrypt output, stored as "salt:derivedkey" hex. Never a plaintext password.
  password_hash TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  email             TEXT NOT NULL,
  company           TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'active',
  notes             TEXT NOT NULL DEFAULT '',
  hourly_rate_minor INTEGER NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'USD',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clients_status_valid CHECK (status IN ('active', 'paused', 'archived')),
  CONSTRAINT clients_rate_positive CHECK (hourly_rate_minor >= 0)
);

CREATE TABLE IF NOT EXISTS tasks (
  id               TEXT PRIMARY KEY,
  client_id        TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'todo',
  priority         TEXT NOT NULL DEFAULT 'medium',
  due_date         DATE,
  estimate_minutes INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tasks_status_valid CHECK (status IN ('todo', 'in_progress', 'blocked', 'done')),
  CONSTRAINT tasks_priority_valid CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id             TEXT PRIMARY KEY,
  client_id      TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  number         TEXT NOT NULL UNIQUE,
  status         TEXT NOT NULL DEFAULT 'draft',
  issued_on      DATE NOT NULL,
  due_on         DATE NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'USD',
  lines          JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal_minor INTEGER NOT NULL DEFAULT 0,
  tax_rate_bp    INTEGER NOT NULL DEFAULT 0,
  tax_minor      INTEGER NOT NULL DEFAULT 0,
  total_minor    INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invoices_status_valid CHECK (status IN ('draft', 'sent', 'paid', 'void'))
);

CREATE TABLE IF NOT EXISTS time_entries (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  client_id  TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  minutes    INTEGER NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  worked_on  DATE NOT NULL,
  billable   BOOLEAN NOT NULL DEFAULT true,
  -- SET NULL, not CASCADE: deleting an invoice must return the time to the
  -- unbilled pool, never delete the timesheet it was built from.
  invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT time_minutes_positive CHECK (minutes > 0)
);

CREATE TABLE IF NOT EXISTS activity (
  id         TEXT PRIMARY KEY,
  actor_id   TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  action     TEXT NOT NULL,
  subject    TEXT NOT NULL,
  summary    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes match the four queries the UI actually issues. Adding more would be
-- write cost with no read win at this size.
CREATE INDEX IF NOT EXISTS tasks_client_idx      ON tasks (client_id);
CREATE INDEX IF NOT EXISTS tasks_due_idx         ON tasks (due_date) WHERE status <> 'done';
CREATE INDEX IF NOT EXISTS time_client_date_idx  ON time_entries (client_id, worked_on DESC);
CREATE INDEX IF NOT EXISTS time_unbilled_idx     ON time_entries (client_id) WHERE invoice_id IS NULL AND billable;
CREATE INDEX IF NOT EXISTS activity_created_idx  ON activity (created_at DESC);
