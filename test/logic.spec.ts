import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  buildInvoiceLines,
  computeStats,
  dailyMinutes,
  isDueThisWeek,
  isOverdue,
  matches,
  minutesToMinor,
  nextInvoiceNumber,
  paginate,
  totalsFor
} from "../server/utils/logic";
import type { Client, Invoice, Task, TimeEntry } from "~~/types/domain";

const TODAY = "2026-08-15";

function task(patch: Partial<Task> = {}): Task {
  return {
    id: "t1",
    clientId: "c1",
    title: "Ship the thing",
    description: "",
    status: "todo",
    priority: "medium",
    dueDate: null,
    estimateMinutes: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...patch
  };
}

function entry(patch: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: "te1",
    taskId: "t1",
    clientId: "c1",
    minutes: 60,
    note: "",
    workedOn: TODAY,
    billable: true,
    invoiceId: null,
    createdAt: "2026-08-15T00:00:00.000Z",
    ...patch
  };
}

describe("isOverdue", () => {
  it("flags an open task past its due date", () => {
    expect(isOverdue(task({ dueDate: "2026-08-14" }), TODAY)).toBe(true);
    expect(isOverdue(task({ status: "blocked", dueDate: "2025-01-01" }), TODAY)).toBe(
      true
    );
  });

  it("never flags a done task, however late it landed", () => {
    expect(isOverdue(task({ status: "done", dueDate: "2020-01-01" }), TODAY)).toBe(false);
    expect(isOverdue(task({ status: "done", dueDate: "2026-08-14" }), TODAY)).toBe(false);
  });

  it("treats a task due today as on time", () => {
    expect(isOverdue(task({ dueDate: TODAY }), TODAY)).toBe(false);
  });

  it("never flags a task with no due date", () => {
    expect(isOverdue(task({ dueDate: null }), TODAY)).toBe(false);
  });

  it("does not flag a future due date", () => {
    expect(isOverdue(task({ dueDate: "2026-08-16" }), TODAY)).toBe(false);
  });
});

describe("isDueThisWeek", () => {
  it("includes both boundaries: today and today+7", () => {
    expect(isDueThisWeek(task({ dueDate: TODAY }), TODAY)).toBe(true);
    expect(isDueThisWeek(task({ dueDate: "2026-08-22" }), TODAY)).toBe(true);
  });

  it("excludes the day after the window and anything overdue", () => {
    expect(isDueThisWeek(task({ dueDate: "2026-08-23" }), TODAY)).toBe(false);
    expect(isDueThisWeek(task({ dueDate: "2026-08-14" }), TODAY)).toBe(false);
  });

  it("excludes done and undated tasks", () => {
    expect(isDueThisWeek(task({ status: "done", dueDate: TODAY }), TODAY)).toBe(false);
    expect(isDueThisWeek(task({ dueDate: null }), TODAY)).toBe(false);
  });
});

describe("minutesToMinor", () => {
  it("converts 90 minutes at 4500/hr to 6750", () => {
    expect(minutesToMinor(90, 4500)).toBe(6750);
  });

  it("rounds to whole minor units instead of leaking fractions", () => {
    expect(minutesToMinor(7, 100)).toBe(12);
    expect(minutesToMinor(1, 4500)).toBe(75);
    expect(minutesToMinor(1, 100)).toBe(2);
    expect(Number.isInteger(minutesToMinor(37, 3333))).toBe(true);
  });

  it("is zero for zero minutes or a zero rate", () => {
    expect(minutesToMinor(0, 4500)).toBe(0);
    expect(minutesToMinor(600, 0)).toBe(0);
  });
});

describe("buildInvoiceLines", () => {
  it("returns nothing for no entries", () => {
    expect(buildInvoiceLines([], [{ id: "t1", title: "Ship" }], 4500)).toEqual([]);
  });

  it("groups several entries per task into one line", () => {
    const lines = buildInvoiceLines(
      [
        entry({ id: "te1", taskId: "t1", minutes: 30 }),
        entry({ id: "te2", taskId: "t1", minutes: 120 }),
        entry({ id: "te3", taskId: "t2", minutes: 60 })
      ],
      [
        { id: "t1", title: "Keyword map" },
        { id: "t2", title: "Lighthouse pass" }
      ],
      4500
    );

    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({
      taskId: "t1",
      title: "Keyword map",
      minutes: 150,
      rateMinor: 4500,
      amountMinor: 11250
    });
    // Biggest line first — the sort is what an invoice reader scans.
    expect(lines[1]!.amountMinor).toBe(4500);
    expect(lines[1]!.minutes).toBe(60);
  });

  it("labels time logged against an unknown task rather than dropping it", () => {
    const lines = buildInvoiceLines([entry({ taskId: "ghost", minutes: 60 })], [], 4500);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.title).toBe("Unlabelled work");
    expect(lines[0]!.amountMinor).toBe(4500);
  });
});

describe("totalsFor", () => {
  const lines = [
    { taskId: "t1", title: "A", minutes: 150, rateMinor: 4500, amountMinor: 11250 },
    { taskId: "t2", title: "B", minutes: 60, rateMinor: 4500, amountMinor: 4500 }
  ];

  it("adds no tax at 0bp", () => {
    expect(totalsFor(lines, 0)).toEqual({
      subtotalMinor: 15750,
      taxMinor: 0,
      totalMinor: 15750
    });
  });

  it("adds 20% at 2000bp", () => {
    expect(totalsFor(lines, 2000)).toEqual({
      subtotalMinor: 15750,
      taxMinor: 3150,
      totalMinor: 18900
    });
  });

  it("is all zeroes for an empty invoice", () => {
    expect(totalsFor([], 2000)).toEqual({ subtotalMinor: 0, taxMinor: 0, totalMinor: 0 });
  });
});

describe("nextInvoiceNumber", () => {
  it("starts at 0001 on an empty list", () => {
    expect(nextInvoiceNumber([], 2026)).toBe("FD-2026-0001");
  });

  it("increments the highest number of that year", () => {
    expect(
      nextInvoiceNumber([{ number: "FD-2026-0001" }, { number: "FD-2026-0009" }], 2026)
    ).toBe("FD-2026-0010");
  });

  it("ignores other years entirely", () => {
    expect(
      nextInvoiceNumber([{ number: "FD-2025-0044" }, { number: "FD-2027-0100" }], 2026)
    ).toBe("FD-2026-0001");
  });

  it("pads to four digits and keeps going past 9999 without truncating", () => {
    expect(nextInvoiceNumber([{ number: "FD-2026-0099" }], 2026)).toBe("FD-2026-0100");
    expect(nextInvoiceNumber([{ number: "FD-2026-9999" }], 2026)).toBe("FD-2026-10000");
  });

  it("survives a junk number in the list", () => {
    expect(
      nextInvoiceNumber([{ number: "FD-2026-oops" }, { number: "FD-2026-0003" }], 2026)
    ).toBe("FD-2026-0004");
  });
});

describe("dailyMinutes", () => {
  it("returns exactly 14 buckets, oldest first, ending today", () => {
    const days = dailyMinutes([], 14, TODAY);
    expect(days).toHaveLength(14);
    expect(days[0]!.date).toBe("2026-08-02");
    expect(days.at(-1)!.date).toBe(TODAY);
    expect(days.map((d) => d.date)).toEqual([...days.map((d) => d.date)].sort());
  });

  it("fills gaps with zero and sums same-day entries", () => {
    const days = dailyMinutes(
      [
        entry({ id: "te1", workedOn: "2026-08-10", minutes: 30 }),
        entry({ id: "te2", workedOn: "2026-08-10", minutes: 45 }),
        entry({ id: "te3", workedOn: TODAY, minutes: 60 })
      ],
      14,
      TODAY
    );
    expect(days.find((d) => d.date === "2026-08-10")!.minutes).toBe(75);
    expect(days.find((d) => d.date === "2026-08-11")!.minutes).toBe(0);
    expect(days.at(-1)!.minutes).toBe(60);
  });

  it("drops entries outside the window instead of bending the buckets", () => {
    const days = dailyMinutes(
      [entry({ workedOn: "2020-01-01", minutes: 999 })],
      14,
      TODAY
    );
    expect(days).toHaveLength(14);
    expect(days.reduce((sum, d) => sum + d.minutes, 0)).toBe(0);
  });
});

describe("paginate", () => {
  const items = [1, 2, 3, 4, 5];

  it("slices the requested page", () => {
    expect(paginate(items, 2, 2)).toEqual({
      items: [3, 4],
      total: 5,
      page: 2,
      perPage: 2,
      pages: 3
    });
  });

  it("clamps a page past the end to the last real page", () => {
    const page = paginate(items, 99, 2);
    expect(page.page).toBe(3);
    expect(page.items).toEqual([5]);
    expect(page.total).toBe(5);
  });

  it("reports one page for an empty list rather than zero", () => {
    expect(paginate([], 1, 20)).toEqual({
      items: [],
      total: 0,
      page: 1,
      perPage: 20,
      pages: 1
    });
  });
});

describe("addDaysISO", () => {
  it("crosses a month boundary", () => {
    expect(addDaysISO("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("crosses a year boundary in both directions", () => {
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("handles a leap day and a zero offset", () => {
    expect(addDaysISO("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysISO("2026-08-15", 0)).toBe("2026-08-15");
  });
});

describe("matches", () => {
  it("is true with no needle, and case-insensitive with one", () => {
    expect(matches(["Northline"], undefined)).toBe(true);
    expect(matches(["Northline Research"], "northline")).toBe(true);
    expect(matches([null, undefined, "Kape Koy"], "koy")).toBe(true);
    expect(matches(["Northline"], "zzz")).toBe(false);
  });
});

describe("computeStats", () => {
  const clients: Client[] = [
    {
      id: "c1",
      name: "Northline",
      email: "a@b.example",
      company: "",
      status: "active",
      notes: "",
      hourlyRateMinor: 6000,
      currency: "USD",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "c2",
      name: "Paused Co",
      email: "c@d.example",
      company: "",
      status: "paused",
      notes: "",
      hourlyRateMinor: 3000,
      currency: "USD",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }
  ];
  const tasks = [
    task({ id: "t1", status: "done", dueDate: "2020-01-01" }),
    task({ id: "t2", status: "todo", dueDate: "2026-08-01" }),
    task({ id: "t3", status: "in_progress", dueDate: "2026-08-16" })
  ];
  const entries = [
    entry({ id: "te1", clientId: "c1", minutes: 60, billable: true }),
    entry({ id: "te2", clientId: "c1", minutes: 30, billable: false }),
    entry({ id: "te3", clientId: "c1", minutes: 60, billable: true, invoiceId: "inv1" })
  ];
  const invoices = [
    { status: "sent", totalMinor: 5000 },
    { status: "paid", totalMinor: 2500 },
    { status: "void", totalMinor: 9999 }
  ] as Invoice[];

  const stats = computeStats(clients, tasks, entries, invoices, TODAY);

  it("counts clients and tasks by status", () => {
    expect(stats.clients).toEqual({ total: 2, active: 1, paused: 1, archived: 0 });
    expect(stats.tasks.total).toBe(3);
    expect(stats.tasks.overdue).toBe(1);
    expect(stats.tasks.dueThisWeek).toBe(1);
    expect(stats.tasks.done).toBe(1);
  });

  it("separates billable from total minutes and keeps 14 sparkline buckets", () => {
    expect(stats.time.totalMinutes).toBe(150);
    expect(stats.time.billableMinutes).toBe(120);
    expect(stats.time.daily).toHaveLength(14);
  });

  it("counts only unbilled billable time as unbilled revenue, and ignores void invoices", () => {
    expect(stats.revenue.unbilledMinor).toBe(6000);
    expect(stats.revenue.outstandingMinor).toBe(5000);
    expect(stats.revenue.paidMinor).toBe(2500);
    expect(stats.revenue.currency).toBe("USD");
  });
});
