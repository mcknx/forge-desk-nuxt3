import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
  verifyPassword
} from "../../utils/auth";
import { rateLimit, readValid } from "../../utils/guard";
import { useRepo } from "../../utils/repo";
import { loginSchema } from "../../utils/schema";

export default defineEventHandler(async (event) => {
  rateLimit(event, "login", 8, 60_000);

  const { email, password } = await readValid(event, loginSchema);
  const repo = await useRepo();
  const user = await repo.users.findByEmail(email);

  // Same message and roughly the same work either way: a faster "no such user"
  // response is a free account-enumeration oracle.
  const ok = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, "x:y");
  if (!user || !ok) {
    throw createError({ statusCode: 401, statusMessage: "Wrong email or password" });
  }

  setCookie(event, SESSION_COOKIE, createSessionToken(user.id), SESSION_COOKIE_OPTIONS);

  const { passwordHash: _drop, ...safe } = user;
  await repo.activity.log({
    actor: safe,
    action: "auth.login",
    subject: `user:${user.id}`,
    summary: `${user.name} signed in`
  });
  return { user: safe };
});
