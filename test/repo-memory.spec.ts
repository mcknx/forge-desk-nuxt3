import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMemoryRepo } from "../server/utils/repo-memory";
import type { Repo } from "../server/utils/repo";
import {
  clientQuerySchema,
  taskQuerySchema,
  timeQuerySchema
} from "../server/utils/schema";
import { minutesToMinor } from "../server/utils/logic";
import type { User } from "~~/types/domain";

const clientQuery = (patch: Record<string, unknown> = {}) =>
  clientQuerySchema.parse(patch);
const taskQuery = (patch: Record<string, unknown> = {}) => taskQuerySchema.parse(patch);
const timeQuery = (patch: Record<string, unknown> = {}) => timeQuerySchema.parse(patch);

const OWNER: User = {
  id: "u1",
  email: "demo@forgedesk.dev",
  name: "McKeen Asma",
  role: "owner",
  createdAt: "2026-01-01T00:00:00.000Z"
};

// c6 carries unbilled billable time in the seed; c1 has none left.
const BILLABLE_CLIENT = "c6";
const SETTLED_CLIENT = "c1";
const BILLED_ENTRY = "te4";
const UNBILLED_ENTRY = "te1";

let repo: Repo;

beforeAll(async () => {
  repo = await createMemoryRepo();
});

// Every test gets the seed back — a driver that leaks state between tests hides
// exactly the bugs this suite exists to catch.
beforeEach(async () => {
  await repo.reset();
});

describe("users", () => {
  it("finds by email case-insensitively", async () => {
    const found = await repo.users.findByEmail("DEMO@ForgeDesk.dev");
    expect(found?.id).toBe("u1");
    expect(found?.passwordHash).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
  });

  it("never hands the password hash out of get()", async () => {
    const user = await repo.users.get("u1");
    expect(user).not.toBeNull();
    expect(user).not.toHaveProperty("passwordHash");
    expect(await repo.users.get("nobody")).toBeNull();
  });
});

describe("clients.list", () => {
  it("returns the whole seed by default", async () => {
    const page = await repo.clients.list(clientQuery());
    expect(page.total).toBe(12);
    expect(page.items).toHaveLength(12);
    expect(page.pages).toBe(1);
  });

  it("filters by status", async () => {
    const paused = await repo.clients.list(clientQuery({ status: "paused" }));
    expect(paused.total).toBe(2);
    expect(paused.items.every((c) => c.status === "paused")).toBe(true);

    const archived = await repo.clients.list(clientQuery({ status: "archived" }));
    expect(archived.total).toBe(2);
    expect(archived.items.every((c) => c.status === "archived")).toBe(true);
  });

  it("filters by search text across name, company, email and notes", async () => {
    const byName = await repo.clients.list(clientQuery({ q: "northline" }));
    expect(byName.total).toBe(1);
    expect(byName.items[0]!.id).toBe("c1");

    const byEmail = await repo.clients.list(clientQuery({ q: "kapekoy.example" }));
    expect(byEmail.items[0]!.id).toBe("c2");

    expect((await repo.clients.list(clientQuery({ q: "no-such-client" }))).total).toBe(0);
  });

  it("combines a status filter with a search", async () => {
    const page = await repo.clients.list(
      clientQuery({ status: "active", q: "northline" })
    );
    expect(page.total).toBe(1);
    expect(
      (await repo.clients.list(clientQuery({ status: "archived", q: "northline" }))).total
    ).toBe(0);
  });

  it("reports totals against the filtered set, not the page", async () => {
    const first = await repo.clients.list(clientQuery({ perPage: "5" }));
    expect(first.total).toBe(12);
    expect(first.pages).toBe(3);
    expect(first.items).toHaveLength(5);

    const last = await repo.clients.list(clientQuery({ perPage: "5", page: "3" }));
    expect(last.items).toHaveLength(2);
    expect(last.page).toBe(3);

    const ids = new Set([...first.items, ...last.items].map((c) => c.id));
    expect(ids.size).toBe(7);
  });

  it("sorts by name in both directions", async () => {
    const asc = await repo.clients.list(clientQuery({ sort: "name", dir: "asc" }));
    const desc = await repo.clients.list(clientQuery({ sort: "name", dir: "desc" }));
    expect(asc.items[0]!.name).toBe("Basalt Fitness");
    expect(desc.items[0]!.name).toBe(asc.items.at(-1)!.name);
  });
});

describe("clients write path", () => {
  it("round-trips create, get and update", async () => {
    const created = await repo.clients.create({
      name: "Test Client",
      email: "test@example.com",
      company: "Test Co",
      status: "active",
      notes: "",
      hourlyRateMinor: 5000,
      currency: "USD"
    });
    expect(created.id).toMatch(/^c_/);
    expect(created.createdAt).toBe(created.updatedAt);

    expect(await repo.clients.get(created.id)).toEqual(created);
    expect((await repo.clients.list(clientQuery())).total).toBe(13);

    const updated = await repo.clients.update(created.id, {
      status: "paused",
      hourlyRateMinor: 6000
    });
    expect(updated?.status).toBe("paused");
    expect(updated?.hourlyRateMinor).toBe(6000);
    expect(updated?.name).toBe("Test Client");
    expect((await repo.clients.get(created.id))?.status).toBe("paused");
  });

  it("reports a miss instead of inventing a row", async () => {
    expect(await repo.clients.get("nope")).toBeNull();
    expect(await repo.clients.update("nope", { status: "paused" })).toBeNull();
    expect(await repo.clients.remove("nope")).toBe(false);
  });

  it("does not leak the new client into the next test", async () => {
    expect((await repo.clients.list(clientQuery())).total).toBe(12);
  });
});

describe("deleting a client cascades", () => {
  it("takes its tasks, time entries and invoices with it", async () => {
    const tasksBefore = await repo.tasks.list(taskQuery({ clientId: BILLABLE_CLIENT }));
    const timeBefore = await repo.time.list(
      timeQuery({ clientId: BILLABLE_CLIENT, perPage: "100" })
    );
    expect(tasksBefore.total).toBeGreaterThan(0);
    expect(timeBefore.total).toBeGreaterThan(0);

    expect(await repo.clients.remove(BILLABLE_CLIENT)).toBe(true);

    expect(await repo.clients.get(BILLABLE_CLIENT)).toBeNull();
    expect((await repo.tasks.list(taskQuery({ clientId: BILLABLE_CLIENT }))).total).toBe(
      0
    );
    expect((await repo.time.list(timeQuery({ clientId: BILLABLE_CLIENT }))).total).toBe(
      0
    );
    expect(await repo.invoices.list(BILLABLE_CLIENT)).toEqual([]);
  });

  it("leaves the other clients alone", async () => {
    const otherBefore = await repo.tasks.list(taskQuery({ clientId: SETTLED_CLIENT }));
    await repo.clients.remove(BILLABLE_CLIENT);
    const otherAfter = await repo.tasks.list(taskQuery({ clientId: SETTLED_CLIENT }));
    expect(otherAfter.total).toBe(otherBefore.total);
    expect((await repo.clients.list(clientQuery())).total).toBe(11);
  });
});

describe("tasks", () => {
  it("filters by client, status and priority", async () => {
    const byClient = await repo.tasks.list(taskQuery({ clientId: BILLABLE_CLIENT }));
    expect(byClient.items.every((t) => t.clientId === BILLABLE_CLIENT)).toBe(true);

    const done = await repo.tasks.list(taskQuery({ status: "done", perPage: "100" }));
    expect(done.total).toBe(18);
    expect(done.items.every((t) => t.status === "done")).toBe(true);

    const urgent = await repo.tasks.list(
      taskQuery({ priority: "urgent", perPage: "100" })
    );
    expect(urgent.total).toBe(7);
    expect(urgent.items.every((t) => t.priority === "urgent")).toBe(true);
  });

  it("searches title and description", async () => {
    const page = await repo.tasks.list(taskQuery({ q: "keyword map", perPage: "100" }));
    expect(page.total).toBeGreaterThan(0);
    expect(
      page.items.every((t) => /keyword map/i.test(`${t.title} ${t.description}`))
    ).toBe(true);
  });

  it("only returns open, past-due tasks under the overdue filter", async () => {
    const page = await repo.tasks.list(taskQuery({ overdue: "true", perPage: "100" }));
    const today = new Date().toISOString().slice(0, 10);
    expect(
      page.items.every(
        (t) => t.status !== "done" && t.dueDate !== null && t.dueDate! < today
      )
    ).toBe(true);
  });

  it("sorts undated tasks to the bottom rather than treating null as 1970", async () => {
    const page = await repo.tasks.list(
      taskQuery({ sort: "dueDate", dir: "asc", perPage: "100" })
    );
    const firstUndated = page.items.findIndex((t) => !t.dueDate);
    if (firstUndated !== -1) {
      expect(page.items.slice(firstUndated).every((t) => !t.dueDate)).toBe(true);
    }
    expect(page.items[0]!.dueDate).not.toBeNull();
  });

  it("round-trips create, update and delete", async () => {
    const task = await repo.tasks.create({
      clientId: SETTLED_CLIENT,
      title: "Write the tests",
      description: "",
      status: "todo",
      priority: "high",
      dueDate: "2026-09-01",
      estimateMinutes: 120
    });
    expect((await repo.tasks.get(task.id))?.title).toBe("Write the tests");

    const updated = await repo.tasks.update(task.id, { status: "done" });
    expect(updated?.status).toBe("done");
    expect(updated?.priority).toBe("high");

    expect(await repo.tasks.remove(task.id)).toBe(true);
    expect(await repo.tasks.get(task.id)).toBeNull();
    expect(await repo.tasks.remove(task.id)).toBe(false);
  });
});

describe("time", () => {
  it("derives the client from the task and starts unbilled", async () => {
    const entry = await repo.time.create({
      taskId: "t1",
      minutes: 45,
      note: "wrote tests",
      workedOn: "2026-08-15",
      billable: true
    });
    expect(entry.clientId).toBe(BILLABLE_CLIENT);
    expect(entry.invoiceId).toBeNull();
  });

  it("refuses time against a task that does not exist", async () => {
    await expect(
      repo.time.create({
        taskId: "ghost",
        minutes: 30,
        note: "",
        workedOn: "2026-08-15",
        billable: true
      })
    ).rejects.toThrow(/unknown task/);
  });

  it("filters by date window and by unbilled", async () => {
    const windowed = await repo.time.list(
      timeQuery({ from: "2026-08-01", to: "2026-08-15", perPage: "100" })
    );
    expect(
      windowed.items.every(
        (e) => e.workedOn >= "2026-08-01" && e.workedOn <= "2026-08-15"
      )
    ).toBe(true);

    const unbilled = await repo.time.list(
      timeQuery({ unbilledOnly: "true", perPage: "100" })
    );
    expect(unbilled.items.every((e) => e.billable && e.invoiceId === null)).toBe(true);
    expect(unbilled.total).toBeGreaterThan(0);
  });

  it("deletes an unbilled entry but not a billed one", async () => {
    expect(await repo.time.remove(UNBILLED_ENTRY)).toBe(true);

    expect(await repo.time.remove(BILLED_ENTRY)).toBe(false);
    const still = await repo.time.list(timeQuery({ taskId: "t1", perPage: "100" }));
    expect(still.items.map((e) => e.id)).toContain(BILLED_ENTRY);
  });
});

describe("invoicing from unbilled time", () => {
  const draft = {
    clientId: BILLABLE_CLIENT,
    issuedOn: "2026-08-15",
    dueOn: "2026-09-14",
    taxRateBp: 0
  };

  it("bills exactly the unbilled billable entries and nothing else", async () => {
    const before = await repo.time.list(
      timeQuery({ clientId: BILLABLE_CLIENT, unbilledOnly: "true", perPage: "100" })
    );
    const billedElsewhere = (
      await repo.time.list(timeQuery({ clientId: BILLABLE_CLIENT, perPage: "100" }))
    ).items.filter((e) => e.invoiceId !== null);
    expect(before.total).toBeGreaterThan(0);
    expect(billedElsewhere.length).toBeGreaterThan(0);

    const invoice = await repo.invoices.createFromUnbilled(draft);
    expect(invoice.status).toBe("draft");
    expect(invoice.number).toBe("FD-2026-0007");
    expect(invoice.currency).toBe((await repo.clients.get(BILLABLE_CLIENT))!.currency);

    const after = await repo.time.list(
      timeQuery({ clientId: BILLABLE_CLIENT, perPage: "100" })
    );
    const nowOnInvoice = after.items
      .filter((e) => e.invoiceId === invoice.id)
      .map((e) => e.id)
      .sort();
    expect(nowOnInvoice).toEqual(before.items.map((e) => e.id).sort());
    // Entries already on an older invoice keep their original invoice id.
    expect(
      after.items.filter((e) => e.invoiceId === billedElsewhere[0]!.invoiceId).length
    ).toBe(billedElsewhere.length);
    expect(
      (
        await repo.time.list(
          timeQuery({ clientId: BILLABLE_CLIENT, unbilledOnly: "true" })
        )
      ).total
    ).toBe(0);
  });

  it("totals the invoice from the billed minutes at the client rate", async () => {
    const pool = await repo.time.list(
      timeQuery({ clientId: BILLABLE_CLIENT, unbilledOnly: "true", perPage: "100" })
    );
    const minutes = pool.items.reduce((sum, e) => sum + e.minutes, 0);
    const rate = (await repo.clients.get(BILLABLE_CLIENT))!.hourlyRateMinor;

    const invoice = await repo.invoices.createFromUnbilled({ ...draft, taxRateBp: 1200 });
    expect(invoice.lines.reduce((sum, l) => sum + l.minutes, 0)).toBe(minutes);
    expect(invoice.subtotalMinor).toBe(
      invoice.lines.reduce((sum, l) => sum + l.amountMinor, 0)
    );
    expect(invoice.lines[0]!.amountMinor).toBe(
      minutesToMinor(invoice.lines[0]!.minutes, rate)
    );
    expect(invoice.taxMinor).toBe(Math.round((invoice.subtotalMinor * 1200) / 10_000));
    expect(invoice.totalMinor).toBe(invoice.subtotalMinor + invoice.taxMinor);
    // One line per task, not one per entry.
    expect(new Set(invoice.lines.map((l) => l.taskId)).size).toBe(invoice.lines.length);
  });

  it("throws on a second invoice for the same client — the pool is empty now", async () => {
    await repo.invoices.createFromUnbilled(draft);
    await expect(repo.invoices.createFromUnbilled(draft)).rejects.toThrow(/no unbilled/);
  });

  it("throws for a client with no unbilled time and for an unknown client", async () => {
    await expect(
      repo.invoices.createFromUnbilled({ ...draft, clientId: SETTLED_CLIENT })
    ).rejects.toThrow(/no unbilled/);
    await expect(
      repo.invoices.createFromUnbilled({ ...draft, clientId: "ghost" })
    ).rejects.toThrow(/unknown client/);
  });

  it("returns the time to the unbilled pool when the invoice is deleted", async () => {
    const invoice = await repo.invoices.createFromUnbilled(draft);
    const billedIds = (
      await repo.time.list(timeQuery({ clientId: BILLABLE_CLIENT, perPage: "100" }))
    ).items
      .filter((e) => e.invoiceId === invoice.id)
      .map((e) => e.id)
      .sort();

    expect(await repo.invoices.remove(invoice.id)).toBe(true);
    expect(await repo.invoices.get(invoice.id)).toBeNull();

    const unbilled = await repo.time.list(
      timeQuery({ clientId: BILLABLE_CLIENT, unbilledOnly: "true", perPage: "100" })
    );
    expect(unbilled.items.map((e) => e.id).sort()).toEqual(billedIds);
    // Deleting one invoice must not unbill another invoice's time.
    expect(
      (await repo.time.list(timeQuery({ taskId: "t1", perPage: "100" }))).items.find(
        (e) => e.id === BILLED_ENTRY
      )!.invoiceId
    ).toBe("inv5");
  });

  it("changes status and lists newest issued first", async () => {
    const invoices = await repo.invoices.list();
    expect(invoices.length).toBe(6);
    expect([...invoices].sort((a, b) => b.issuedOn.localeCompare(a.issuedOn))).toEqual(
      invoices
    );

    const paid = await repo.invoices.setStatus("inv1", "paid");
    expect(paid?.status).toBe("paid");
    expect((await repo.invoices.get("inv1"))?.status).toBe("paid");
    expect(await repo.invoices.setStatus("ghost", "paid")).toBeNull();
    expect(await repo.invoices.remove("ghost")).toBe(false);
  });
});

describe("activity", () => {
  it("puts the newest entry first and honours the limit", async () => {
    const logged = await repo.activity.log({
      actor: OWNER,
      action: "client.created",
      subject: "client:c1",
      summary: "McKeen added Northline"
    });
    const feed = await repo.activity.list(5);
    expect(feed).toHaveLength(5);
    expect(feed[0]!.id).toBe(logged.id);
    expect(feed[0]!.actorName).toBe(OWNER.name);
  });
});

describe("stats", () => {
  it("summarises the seed the dashboard renders", async () => {
    const stats = await repo.stats();
    expect(stats.clients.total).toBe(12);
    expect(stats.clients.active).toBe(8);
    expect(stats.tasks.total).toBe(48);
    expect(stats.time.daily).toHaveLength(14);
    expect(stats.revenue.unbilledMinor).toBeGreaterThan(0);
  });

  it("drops the unbilled figure to zero once everything is invoiced", async () => {
    const before = await repo.stats();
    await repo.invoices.createFromUnbilled({
      clientId: BILLABLE_CLIENT,
      issuedOn: "2026-08-15",
      dueOn: "2026-09-14",
      taxRateBp: 0
    });
    const after = await repo.stats();
    expect(after.revenue.unbilledMinor).toBeLessThan(before.revenue.unbilledMinor);
  });
});
