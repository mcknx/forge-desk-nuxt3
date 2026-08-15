import { SESSION_COOKIE } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  // Deleting the cookie is the whole logout: sessions are stateless, so there
  // is no server-side record to revoke.
  deleteCookie(event, SESSION_COOKIE, { path: "/" });
  return { ok: true };
});
