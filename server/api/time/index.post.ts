import { readValid, requireWriter } from "../../utils/guard";
import { useRepo } from "../../utils/repo";
import { timeCreateSchema } from "../../utils/schema";

export default defineEventHandler(async (event) => {
  const user = requireWriter(event);
  const input = await readValid(event, timeCreateSchema);
  const repo = await useRepo();

  const entry = await repo.time.create(input).catch((error: unknown) => {
    // taskId is user input, so pointing at a task that does not exist is a bad
    // request the form can render, not a 500.
    if (String((error as Error)?.message).startsWith("unknown task")) {
      throw createError({
        statusCode: 422,
        statusMessage: "Validation failed",
        data: { fields: { taskId: "no such task" } }
      });
    }
    throw error;
  });

  await repo.activity.log({
    actor: user,
    action: "time.logged",
    subject: `task:${entry.taskId}`,
    summary: `${user.name} logged ${entry.minutes} minutes on ${entry.workedOn}`
  });

  setResponseStatus(event, 201);
  return entry;
});
