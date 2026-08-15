import { skipHydrate } from "pinia";

/**
 * Fixes: every error page returns 500, whatever the real status was.
 *
 * @pinia/nuxt registers a global SSR payload reducer named "skipHydrate" that
 * runs `shouldHydrate(value)` — internally `value.hasOwnProperty(...)` — over
 * *every* value in the payload, not just Pinia state. Nuxt renders errors by
 * dispatching to `/__nuxt_error?...` and putting h3's `getQuery(event)` result
 * into `payload.error`, and that object has a null prototype. Calling
 * `.hasOwnProperty` on it throws mid-serialisation, Nuxt catches the throw and
 * answers 500 — so a 404 rendered as 500, and a 403 rendered as 500.
 *
 * Reproduced on nuxt 3.17.7 with @pinia/nuxt 0.9 / pinia 2.3; it needs nothing
 * unusual, only Pinia plus any error page, so it is not specific to this app.
 *
 * The fix re-registers the same reducer key with a prototype-safe equivalent.
 * Registering later wins, and the semantics are unchanged: match only plain
 * objects explicitly marked by `skipHydrate()`.
 */

// The marker symbol is not exported, so recover it by marking a probe object.
const SKIP_SYMBOL = Object.getOwnPropertySymbols(skipHydrate({}))[0];

export default defineNuxtPlugin({
  name: "forge:pinia-payload-fix",
  // After @pinia/nuxt's payload plugin, or this would be the one overwritten.
  enforce: "post",
  setup() {
    definePayloadReducer("skipHydrate", (data: unknown) => {
      if (!data || typeof data !== "object" || !SKIP_SYMBOL) return 0;
      // .call, not data.hasOwnProperty — the whole point is that the receiver
      // may not inherit from Object.prototype.
      return Object.prototype.hasOwnProperty.call(data, SKIP_SYMBOL) ? 1 : 0;
    });
  }
});
