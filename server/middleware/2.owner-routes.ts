/**
 * Server-side guard for the pages only an owner may open.
 *
 * The matching route middleware cannot do this job alone: an error thrown from
 * async route middleware loses its status by the time Nuxt renders, so the
 * response came back 500 for what is plainly a 403. Rejecting here — before a
 * single byte is rendered — makes the wire status match the refusal, and means
 * authorization does not depend on client-side routing running at all.
 *
 * The route middleware still earns its place: it blocks client-side navigation,
 * which never reaches the server.
 *
 * The numeric filename prefix is load-bearing: Nitro runs server middleware in
 * alphabetical order, so without it this file ran before 1.session.ts and saw
 * event.context.user unset on every request — bouncing the owner to /login.
 */
const OWNER_ONLY = [
  /^\/clients\/new\/?$/,
  /^\/clients\/[^/]+\/edit\/?$/,
  /^\/tasks\/new\/?$/
];

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname;
  if (!OWNER_ONLY.some((pattern) => pattern.test(path))) return;

  const user = event.context.user;
  if (!user) {
    return sendRedirect(event, `/login?redirect=${encodeURIComponent(path)}`, 302);
  }
  if (user.role !== "owner") {
    throw createError({
      statusCode: 403,
      statusMessage: "Read-only account — ask the owner to make this change"
    });
  }
});
