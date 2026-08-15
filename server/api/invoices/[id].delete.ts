import { requireWriter } from "../../utils/guard";
import { useRepo } from "../../utils/repo";

export default defineEventHandler(async (event) => {
  requireWriter(event);
  const id = getRouterParam(event, "id")!;
  const repo = await useRepo();

  // Deleting returns the invoice's time entries to the unbilled pool, which is
  // the only way to undo a mis-raised invoice.
  if (!(await repo.invoices.remove(id))) {
    throw createError({ statusCode: 404, statusMessage: "Invoice not found" });
  }

  return { ok: true };
});
