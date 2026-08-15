export default defineNuxtRouteMiddleware(async (to) => {
  const { user, refresh } = useAuth();

  // Resolve during SSR, not after hydration. Without the await the server
  // renders the signed-out shell, ships it, and the page visibly rebuilds — or
  // bounces to /login — the moment the client learns who is actually signed in.
  if (!user.value) await refresh().catch(() => {});

  if (!user.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
  }
});
