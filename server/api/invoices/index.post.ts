import { readValid, requireWriter } from "../../utils/guard";
import { useRepo } from "../../utils/repo";
import { invoiceCreateSchema } from "../../utils/schema";

export default defineEventHandler(async (event) => {
  const user = requireWriter(event);
  const input = await readValid(event, invoiceCreateSchema);
  const repo = await useRepo();

  const invoice = await repo.invoices
    .createFromUnbilled(input)
    .catch((error: unknown) => {
      const message = String((error as Error)?.message ?? "");
      // Nothing left to bill is a legitimate state of the desk, not a fault — a
      // 409 lets the UI say "log some time first" instead of "something broke".
      if (message.includes("no unbilled billable time")) {
        throw createError({
          statusCode: 409,
          statusMessage: "no unbilled billable time for this client"
        });
      }
      if (message.startsWith("unknown client")) {
        throw createError({ statusCode: 404, statusMessage: "Client not found" });
      }
      throw error;
    });

  await repo.activity.log({
    actor: user,
    action: "invoice.created",
    subject: `invoice:${invoice.id}`,
    summary: `${user.name} raised ${invoice.number}`
  });

  setResponseStatus(event, 201);
  return invoice;
});
