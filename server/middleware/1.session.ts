/**
 * Resolves the session cookie into event.context.user on every request, so no
 * route handler ever parses the cookie itself. A route that forgets to call
 * the guard fails closed at the guard, not here — this middleware only reads.
 */
import { SESSION_COOKIE, readSessionToken } from '../utils/auth'
import { useRepo } from '../utils/repo'
import type { User } from '~~/types/domain'

declare module 'h3' {
  interface H3EventContext {
    user: User | null
  }
}

export default defineEventHandler(async (event) => {
  event.context.user = null

  const userId = readSessionToken(getCookie(event, SESSION_COOKIE))
  if (!userId) return

  const repo = await useRepo()
  const user = await repo.users.get(userId)
  if (!user) {
    // Valid signature, missing user — the account went away under a live
    // session. Clear the cookie so the browser stops sending a dead token.
    deleteCookie(event, SESSION_COOKIE, { path: '/' })
    return
  }
  event.context.user = user
})
