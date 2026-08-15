import { orNotFound, requireWriter } from "../../utils/guard";
import { useRepo } from "../../utils/repo";

export default defineEventHandler(async (event) => {
  const actor = requireWriter(event);
  const id = getRouterParam(event, "id") ?? "";

  const repo = await useRepo();
  // Read first: it 404s the unknown id, and after the cascade there is no name
  // left to write into the activity feed.
  const client = orNotFound(await repo.clients.get(id), "Client");
  await repo.clients.remove(id);

  await repo.activity.log({
    actor,
    // No 'client.deleted' action exists; a delete cascades the client out of the
    // desk the same way archiving retires it, so it reads under the same label.
    action: "client.archived",
    subject: `client:${id}`,
    summary: `Deleted ${client.name} and its tasks`
  });

  return { ok: true };
});
