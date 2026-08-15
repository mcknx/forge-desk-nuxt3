import { orNotFound } from "../../utils/guard";
import { useRepo } from "../../utils/repo";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id") ?? "";
  const repo = await useRepo();
  return orNotFound(await repo.clients.get(id), "Client");
});
