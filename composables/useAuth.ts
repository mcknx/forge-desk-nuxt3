import type { User } from "~~/types/domain";

export function useAuth() {
  // useState, not a plain ref: the value resolved during SSR is serialised into
  // the payload, so the client boots already knowing who is signed in.
  const user = useState<User | null>("auth:user", () => null);

  async function refresh() {
    // The session cookie is httpOnly, so an SSR $fetch has to be handed the
    // incoming cookie header explicitly or it calls /api/auth/me anonymously.
    // Copied into an object literal rather than passed straight through:
    // useRequestHeaders(include) returns Object.create(null), and @pinia/nuxt
    // registers a global devalue reducer that calls shouldHydrate() — which
    // calls hasOwnProperty — on every value in the SSR payload. A
    // null-prototype object anywhere in that payload throws
    // "obj.hasOwnProperty is not a function" mid-serialisation, and Nuxt turns
    // that into a blanket 500. It surfaced as every error page rendering 500
    // instead of its real status, because the failed request's options ride
    // along in the serialised fetch error.
    const cookie = import.meta.server ? useRequestHeaders(["cookie"]).cookie : undefined;
    const headers = cookie ? { cookie } : undefined;
    const res = await $fetch<{ user: User | null }>("/api/auth/me", { headers });
    user.value = res.user;
    return user.value;
  }

  async function login(email: string, password: string) {
    // Deliberately no try/catch: the caller needs the *structured* error, not a
    // flattened message. Wrapping it in `new Error(text)` threw away the status
    // code and the 422 field map, so the login form could only ever show one
    // generic string and could not highlight the offending inputs.
    const res = await $fetch<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: { email, password }
    });
    user.value = res.user;
    return res.user;
  }

  async function logout() {
    // Clearing local state matters more than the request succeeding — a failed
    // logout that leaves the UI signed in is the worse outcome.
    await $fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    user.value = null;
    await navigateTo("/login");
  }

  return {
    user,
    isOwner: computed(() => user.value?.role === "owner"),
    login,
    logout,
    refresh
  };
}
