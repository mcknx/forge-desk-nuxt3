import { orNotFound } from "../../utils/guard";
import { useRepo } from "../../utils/repo";

export default defineEventHandler(async (event) => {
  const repo = await useRepo();
  return orNotFound(await repo.invoices.get(getRouterParam(event, "id")!), "Invoice");
});
