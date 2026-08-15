import { queryValid } from "../../utils/guard";
import { useRepo } from "../../utils/repo";
import { timeQuerySchema } from "../../utils/schema";

export default defineEventHandler(async (event) => {
  const query = queryValid(event, timeQuerySchema);
  const repo = await useRepo();
  return repo.time.list(query);
});
