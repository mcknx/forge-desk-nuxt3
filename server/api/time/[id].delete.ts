import { requireWriter } from "../../utils/guard";
import { useRepo } from "../../utils/repo";

export default defineEventHandler(async (event) => {
  requireWriter(event);
  const id = getRouterParam(event, "id")!;
  const repo = await useRepo();

  // Both drivers refuse to delete invoiced time, so a false here means either
  // "gone" or "already billed" — one message covers both without a second query.
  if (!(await repo.time.remove(id))) {
    throw createError({
      statusCode: 409,
      statusMessage:
        "Time entry not found, or already on an invoice — delete the invoice to unbill it"
    });
  }

  return { ok: true };
});
