import { describe, expect, it } from "vitest";
import {
  clientCreateSchema,
  clientQuerySchema,
  clientUpdateSchema,
  invoiceCreateSchema,
  loginSchema,
  taskCreateSchema,
  taskQuerySchema,
  timeCreateSchema,
  timeQuerySchema
} from "../server/utils/schema";

/** The failing field paths, so a broken message doesn't read as a passing test. */
function badFields(result: {
  success: boolean;
  error?: { issues: { path: (string | number)[] }[] };
}) {
  return (result.error?.issues ?? []).map((i) => i.path.join("."));
}

describe("clientCreateSchema", () => {
  it("rejects a name under two characters", () => {
    const result = clientCreateSchema.safeParse({
      name: "A",
      email: "ops@northline.example"
    });
    expect(result.success).toBe(false);
    expect(badFields(result)).toContain("name");
  });

  it("rejects an address that is not an email", () => {
    const result = clientCreateSchema.safeParse({
      name: "Northline",
      email: "ops-at-northline"
    });
    expect(result.success).toBe(false);
    expect(badFields(result)).toContain("email");
  });

  it("rejects a negative or fractional rate — money is integer minor units", () => {
    expect(
      clientCreateSchema.safeParse({
        name: "Northline",
        email: "a@b.example",
        hourlyRateMinor: -1
      }).success
    ).toBe(false);
    expect(
      clientCreateSchema.safeParse({
        name: "Northline",
        email: "a@b.example",
        hourlyRateMinor: 45.5
      }).success
    ).toBe(false);
    expect(
      clientCreateSchema.safeParse({
        name: "Northline",
        email: "a@b.example",
        hourlyRateMinor: 0
      }).success
    ).toBe(true);
  });

  it("applies its defaults so a minimal body is a complete client", () => {
    const parsed = clientCreateSchema.parse({
      name: "Northline",
      email: "ops@northline.example"
    });
    expect(parsed).toEqual({
      name: "Northline",
      email: "ops@northline.example",
      company: "",
      status: "active",
      notes: "",
      hourlyRateMinor: 0,
      currency: "USD"
    });
  });

  it("trims strings and upper-cases the currency", () => {
    const parsed = clientCreateSchema.parse({
      name: "  Northline  ",
      email: " ops@northline.example ",
      currency: "php"
    });
    expect(parsed.name).toBe("Northline");
    expect(parsed.email).toBe("ops@northline.example");
    expect(parsed.currency).toBe("PHP");
  });

  it("rejects a currency that is not three characters and an unknown status", () => {
    expect(
      clientCreateSchema.safeParse({
        name: "Northline",
        email: "a@b.example",
        currency: "PESO"
      }).success
    ).toBe(false);
    expect(
      clientCreateSchema.safeParse({
        name: "Northline",
        email: "a@b.example",
        status: "deleted"
      }).success
    ).toBe(false);
  });
});

describe("clientUpdateSchema", () => {
  it("accepts a single field and still validates it", () => {
    expect(clientUpdateSchema.parse({ status: "paused" })).toEqual({ status: "paused" });
    expect(clientUpdateSchema.safeParse({}).success).toBe(true);
    expect(clientUpdateSchema.safeParse({ name: "A" }).success).toBe(false);
  });
});

describe("taskCreateSchema", () => {
  it("defaults an unscheduled task to a null due date", () => {
    const parsed = taskCreateSchema.parse({ clientId: "c1", title: "Ship the map" });
    expect(parsed.dueDate).toBeNull();
    expect(parsed.status).toBe("todo");
    expect(parsed.priority).toBe("medium");
    expect(parsed.estimateMinutes).toBe(0);
  });

  it("accepts an explicit null and a real ISO date", () => {
    expect(
      taskCreateSchema.parse({ clientId: "c1", title: "Ship it", dueDate: null }).dueDate
    ).toBeNull();
    expect(
      taskCreateSchema.parse({ clientId: "c1", title: "Ship it", dueDate: "2026-08-15" })
        .dueDate
    ).toBe("2026-08-15");
  });

  it("rejects an unpadded date", () => {
    const result = taskCreateSchema.safeParse({
      clientId: "c1",
      title: "Ship it",
      dueDate: "2026-8-1"
    });
    expect(result.success).toBe(false);
    expect(badFields(result)).toContain("dueDate");
  });

  it("rejects a date that matches the shape but is not a real day", () => {
    expect(
      taskCreateSchema.safeParse({
        clientId: "c1",
        title: "Ship it",
        dueDate: "2026-13-45"
      }).success
    ).toBe(false);
    expect(
      taskCreateSchema.safeParse({
        clientId: "c1",
        title: "Ship it",
        dueDate: "15/08/2026"
      }).success
    ).toBe(false);
    expect(
      taskCreateSchema.safeParse({ clientId: "c1", title: "Ship it", dueDate: "" })
        .success
    ).toBe(false);
  });

  it("requires a client and a title of at least three characters", () => {
    expect(taskCreateSchema.safeParse({ clientId: "", title: "Ship it" }).success).toBe(
      false
    );
    expect(taskCreateSchema.safeParse({ clientId: "c1", title: "Go" }).success).toBe(
      false
    );
  });
});

describe("timeCreateSchema", () => {
  it("rejects a zero-minute entry", () => {
    const result = timeCreateSchema.safeParse({
      taskId: "t1",
      minutes: 0,
      workedOn: "2026-08-15"
    });
    expect(result.success).toBe(false);
    expect(badFields(result)).toContain("minutes");
  });

  it("rejects 17 hours in one entry as a typo", () => {
    expect(
      timeCreateSchema.safeParse({
        taskId: "t1",
        minutes: 17 * 60,
        workedOn: "2026-08-15"
      }).success
    ).toBe(false);
    expect(
      timeCreateSchema.safeParse({
        taskId: "t1",
        minutes: 16 * 60,
        workedOn: "2026-08-15"
      }).success
    ).toBe(true);
  });

  it("requires a worked-on date and defaults to billable", () => {
    expect(timeCreateSchema.safeParse({ taskId: "t1", minutes: 30 }).success).toBe(false);
    const parsed = timeCreateSchema.parse({
      taskId: "t1",
      minutes: 30,
      workedOn: "2026-08-15"
    });
    expect(parsed.billable).toBe(true);
    expect(parsed.note).toBe("");
  });
});

describe("invoiceCreateSchema", () => {
  it("defaults tax to zero and caps it at 100%", () => {
    expect(
      invoiceCreateSchema.parse({
        clientId: "c1",
        issuedOn: "2026-08-15",
        dueOn: "2026-09-14"
      }).taxRateBp
    ).toBe(0);
    expect(
      invoiceCreateSchema.safeParse({
        clientId: "c1",
        issuedOn: "2026-08-15",
        dueOn: "2026-09-14",
        taxRateBp: 10_001
      }).success
    ).toBe(false);
    expect(
      invoiceCreateSchema.safeParse({
        clientId: "c1",
        issuedOn: "2026-08-15",
        dueOn: "2026-09-14",
        taxRateBp: 1200
      }).success
    ).toBe(true);
  });
});

describe("loginSchema", () => {
  it("needs a valid email and a non-empty password", () => {
    expect(
      loginSchema.safeParse({ email: "demo@forgedesk.dev", password: "x" }).success
    ).toBe(true);
    expect(loginSchema.safeParse({ email: "demo", password: "x" }).success).toBe(false);
    expect(
      loginSchema.safeParse({ email: "demo@forgedesk.dev", password: "" }).success
    ).toBe(false);
  });
});

describe("query schemas", () => {
  it("coerces string query values to numbers", () => {
    const parsed = clientQuerySchema.parse({ page: "2", perPage: "50" });
    expect(parsed.page).toBe(2);
    expect(parsed.perPage).toBe(50);
  });

  it("defaults an empty query to page one, twenty per page", () => {
    expect(clientQuerySchema.parse({})).toEqual({
      status: "all",
      sort: "name",
      dir: "asc",
      page: 1,
      perPage: 20
    });
  });

  it("rejects a perPage over 100, so nobody can ask for the whole table", () => {
    expect(clientQuerySchema.safeParse({ perPage: "101" }).success).toBe(false);
    expect(clientQuerySchema.safeParse({ perPage: "100" }).success).toBe(true);
    expect(timeQuerySchema.safeParse({ perPage: "1000" }).success).toBe(false);
  });

  it("rejects a page below one or a non-numeric page", () => {
    expect(clientQuerySchema.safeParse({ page: "0" }).success).toBe(false);
    expect(clientQuerySchema.safeParse({ page: "abc" }).success).toBe(false);
  });

  it("turns the overdue flag from a string into a boolean", () => {
    expect(taskQuerySchema.parse({ overdue: "true" }).overdue).toBe(true);
    expect(taskQuerySchema.parse({ overdue: "false" }).overdue).toBe(false);
    expect(taskQuerySchema.parse({}).overdue).toBeUndefined();
    expect(taskQuerySchema.safeParse({ overdue: "yes" }).success).toBe(false);
  });

  it("defaults task sorting to due date and rejects an unknown sort key", () => {
    expect(taskQuerySchema.parse({}).sort).toBe("dueDate");
    expect(taskQuerySchema.safeParse({ sort: "whatever" }).success).toBe(false);
    expect(taskQuerySchema.safeParse({ dir: "sideways" }).success).toBe(false);
  });

  it("validates the time window as ISO dates", () => {
    expect(timeQuerySchema.parse({ from: "2026-08-01", to: "2026-08-15" }).from).toBe(
      "2026-08-01"
    );
    expect(timeQuerySchema.safeParse({ from: "last week" }).success).toBe(false);
  });
});
