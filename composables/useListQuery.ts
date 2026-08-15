import type { LocationQuery } from "vue-router";

/**
 * Keeps list filters and the URL query string as one thing, so a filtered list
 * is a link you can paste to someone and the back button walks filter history
 * instead of doing nothing.
 *
 * Only keys present in `defaults` are tracked; anything else in the URL is left
 * alone. The type of each default decides how the string from the URL is
 * coerced back, which is why `page: 1` matters and `page: '1'` would not.
 */
export function useListQuery<T extends Record<string, any>>(defaults: T) {
  const route = useRoute();
  const router = useRouter();

  function fromUrl(query: LocationQuery): Partial<T> {
    const out: Record<string, any> = {};
    for (const key of Object.keys(defaults)) {
      const raw = query[key];
      const value = Array.isArray(raw) ? raw[0] : raw;
      if (value === undefined || value === null) continue;
      const fallback = defaults[key];
      if (typeof fallback === "number") {
        const n = Number(value);
        out[key] = Number.isFinite(n) ? n : fallback;
      } else if (typeof fallback === "boolean") {
        out[key] = value === "true";
      } else {
        out[key] = value;
      }
    }
    return out as Partial<T>;
  }

  /** Defaults are omitted from the URL — `?status=all&page=1` is just noise. */
  function toUrl(source: Record<string, any>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const key of Object.keys(defaults)) {
      const value = source[key];
      if (value === undefined || value === null || value === "") continue;
      if (value === defaults[key]) continue;
      out[key] = String(value);
    }
    return out;
  }

  const filters = reactive({ ...defaults, ...fromUrl(route.query) }) as T;

  let timer: ReturnType<typeof setTimeout> | undefined;

  function commit() {
    // replace, not push: one history entry per keystroke would make the back
    // button useless for actually leaving the page.
    router.replace({ query: toUrl(filters) });
  }

  /**
   * Takes whatever a form control hands over — a select emits `string |
   * undefined`, a number input `string | number` — and normalises it to the
   * filter's own type. Typing this as strictly `T[K]` would push the same cast
   * into every call site in every page, which is the wrong place for it: the
   * boundary between DOM values and filter state is right here.
   */
  function setFilter<K extends keyof T & string>(
    key: K,
    value: T[K] | string | number | null | undefined
  ) {
    const fallback = defaults[key];
    filters[key] =
      value === undefined || value === null || value === ""
        ? fallback
        : typeof fallback === "number"
          ? (Number(value) as T[K])
          : (value as T[K]);

    // Any filter but the page itself invalidates the current page — page 4 of
    // an unfiltered list is almost always empty once a filter narrows it.
    if (key !== "page" && "page" in defaults) (filters as any).page = defaults.page;

    clearTimeout(timer);
    // The search box fires on every keystroke; without this each letter is a
    // navigation and a refetch.
    if (key === "q") timer = setTimeout(commit, 300);
    else commit();
  }

  function reset() {
    clearTimeout(timer);
    Object.assign(filters, defaults);
    router.replace({ query: {} });
  }

  // Back/forward navigation changes the URL without going through setFilter.
  watch(
    () => route.query,
    (query) => Object.assign(filters, defaults, fromUrl(query))
  );

  onScopeDispose(() => clearTimeout(timer));

  // Derived from the route rather than from `filters` so it inherits the
  // debounce: a consumer keying useFetch off this refetches once per pause,
  // not once per character.
  const queryString = computed(() =>
    new URLSearchParams(toUrl({ ...defaults, ...fromUrl(route.query) })).toString()
  );

  return { filters, setFilter, reset, queryString };
}
