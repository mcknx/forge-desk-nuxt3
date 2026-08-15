import { defineStore } from "pinia";

export type ToastTone = "ok" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
}

/**
 * Chrome state that outlives a single component: toasts, the mobile nav drawer
 * and the resolved theme. Toasts live here rather than in the ToastHost so a
 * message pushed during SSR or by a store action survives to the next render.
 */
export const useUiStore = defineStore("ui", () => {
  const toasts = ref<Toast[]>([]);
  const sidebarOpen = ref(false);
  const theme = ref<"light" | "dark">("light");

  let seq = 0;

  function push(message: string, tone: ToastTone = "info"): string {
    // Random suffix, not a bare counter: the client store restarts its counter
    // at zero after hydration and would reuse the id of a toast the server
    // already rendered, so dismissing one would dismiss both.
    const id = `toast_${++seq}_${Math.random().toString(36).slice(2, 7)}`;
    toasts.value.push({ id, message, tone });
    return id;
  }

  function dismiss(id: string) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return { toasts, sidebarOpen, theme, push, dismiss };
});
