import { queryValid } from "../../utils/guard";
import { useRepo } from "../../utils/repo";
import { clientQuerySchema } from "../../utils/schema";

// Public: the demo is meant to be browsable without signing in.
export default defineEventHandler(async (event) => {
  const query = queryValid(event, clientQuerySchema);
  const repo = await useRepo();
  return repo.clients.list(query);
});
