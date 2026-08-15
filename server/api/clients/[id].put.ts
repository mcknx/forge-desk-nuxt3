import { orNotFound, readValid, requireWriter } from "../../utils/guard";
import { useRepo } from "../../utils/repo";
import { clientUpdateSchema } from "../../utils/schema";

export default defineEventHandler(async (event) => {
  const actor = requireWriter(event);
  const id = getRouterParam(event, "id") ?? "";
  const patch = await readValid(event, clientUpdateSchema);

  const repo = await useRepo();
  const client = orNotFound(await repo.clients.update(id, patch), "Client");

  // Archiving is the one client edit people go looking for in the feed, so it
  // gets its own action rather than hiding inside a generic "updated".
  const archived = patch.status === "archived";
  await repo.activity.log({
    actor,
    action: archived ? "client.archived" : "client.updated",
    subject: `client:${client.id}`,
    summary: archived ? `Archived ${client.name}` : `Updated ${client.name}`
  });

  return client;
});
