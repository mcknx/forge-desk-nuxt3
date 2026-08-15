import { queryValid } from "../../utils/guard";
import { useRepo } from "../../utils/repo";
import { invoiceQuerySchema } from "../../utils/schema";

export default defineEventHandler(async (event) => {
  const { clientId } = queryValid(event, invoiceQuerySchema);
  const repo = await useRepo();
  const items = await repo.invoices.list(clientId);

  // A desk raises tens of invoices, not thousands, so the repo returns them all
  // — the Page envelope only keeps the shape identical to every other list.
  return {
    items,
    total: items.length,
    page: 1,
    perPage: Math.max(items.length, 1),
    pages: 1
  };
});
