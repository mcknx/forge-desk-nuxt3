export default defineEventHandler((event) => {
  // Deliberately 200-with-null rather than 401: the client calls this on every
  // load to decide what to render, and a 401 there is noise, not an error.
  return { user: event.context.user };
});
