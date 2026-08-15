export default defineNuxtRouteMiddleware(async (to) => {
  const { user, isOwner, refresh } = useAuth()

  // Resolves the session itself rather than assuming auth middleware ran first:
  // middleware order is per-page config, and a page that lists only this one
  // must still fail closed.
  if (!user.value) await refresh().catch(() => {})
  if (!user.value) return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)

  if (!isOwner.value) {
    // Client-side only. A full page load is already refused by
    // server/middleware/owner-routes.ts with a real 403 — doing it here too
    // would mean throwing from async route middleware, which Nuxt flattens
    // into a 500 and would make the status *worse*. This half covers the case
    // the server never sees: an in-app link click.
    return abortNavigation(
      createError({
        statusCode: 403,
        statusMessage: 'Read-only account — ask the owner to make this change',
      }),
    )
  }
})
