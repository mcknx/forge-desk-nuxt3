import { orNotFound, readValid, requireWriter } from "../../utils/guard";
import { useRepo } from "../../utils/repo";
import { taskUpdateSchema } from "../../utils/schema";

export default defineEventHandler(async (event) => {
  const actor = requireWriter(event);
  const id = getRouterParam(event, "id") ?? "";
  const patch = await readValid(event, taskUpdateSchema);

  const repo = await useRepo();
  const task = orNotFound(await repo.tasks.update(id, patch), "Task");

  const completed = patch.status === "done";
  await repo.activity.log({
    actor,
    action: completed ? "task.completed" : "task.updated",
    subject: `task:${task.id}`,
    summary: completed ? `Completed "${task.title}"` : `Updated "${task.title}"`
  });

  return task;
});
