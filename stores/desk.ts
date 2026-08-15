import { defineStore } from "pinia";
import type {
  Activity,
  Client,
  DashboardStats,
  Page,
  Task,
  TaskStatus
} from "~~/types/domain";

/** Unwraps h3's error envelope so the UI shows the server's own wording. */
function serverMessage(error: unknown, fallback: string): string {
  const e = error as { data?: { statusMessage?: string }; statusMessage?: string };
  return e?.data?.statusMessage || e?.statusMessage || fallback;
}

export const useDeskStore = defineStore("desk", () => {
  const clients = ref<Client[]>([]);
  const tasks = ref<Task[]>([]);
  const stats = ref<DashboardStats | null>(null);
  const activity = ref<Activity[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // One wrapper instead of the same try/catch/finally in five actions. Returns
  // null on failure so callers can bail without re-reading `error`.
  async function load<T>(fn: () => Promise<T>, fallback: string): Promise<T | null> {
    loading.value = true;
    error.value = null;
    try {
      return await fn();
    } catch (e) {
      error.value = serverMessage(e, fallback);
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function fetchClients(query = "") {
    const page = await load(
      () => $fetch<Page<Client>>(`/api/clients${query ? `?${query}` : ""}`),
      "Could not load clients"
    );
    if (page) clients.value = page.items;
    return page;
  }

  async function fetchTasks(query = "") {
    const page = await load(
      () => $fetch<Page<Task>>(`/api/tasks${query ? `?${query}` : ""}`),
      "Could not load tasks"
    );
    if (page) tasks.value = page.items;
    return page;
  }

  async function fetchStats() {
    const result = await load(
      () => $fetch<DashboardStats>("/api/stats"),
      "Could not load the dashboard"
    );
    if (result) stats.value = result;
    return result;
  }

  async function fetchActivity(limit = 12) {
    const result = await load(
      () => $fetch<Activity[]>("/api/activity", { query: { limit } }),
      "Could not load activity"
    );
    if (result) activity.value = result;
    return result;
  }

  const clientName = computed(() => {
    const byId = new Map(clients.value.map((c) => [c.id, c.name]));
    return (id: string) => byId.get(id);
  });

  /**
   * Optimistic. Ticking a task has to feel instant, and a status flip is
   * trivially reversible.
   *
   * The store's own list is only one of the places a task row lives — pages
   * fetch their own copy — so the request must never depend on finding it here,
   * and the failure is rethrown rather than swallowed into a toast: whoever owns
   * the row on screen is the one that has to roll it back and say so.
   */
  async function setTaskStatus(id: string, status: TaskStatus): Promise<Task> {
    const local = tasks.value.find((t) => t.id === id);
    const previous = local?.status;
    if (local) local.status = status;

    try {
      const updated = await $fetch<Task>(`/api/tasks/${id}`, {
        method: "PUT",
        body: { status }
      });
      if (local) Object.assign(local, updated);
      return updated;
    } catch (e) {
      if (local && previous) local.status = previous;
      // Rethrown untouched so the caller can still read the server's own wording
      // out of the h3 envelope (a viewer account hits a 403 here every time).
      throw e;
    }
  }

  return {
    clients,
    tasks,
    stats,
    activity,
    loading,
    error,
    clientName,
    fetchClients,
    fetchTasks,
    fetchStats,
    fetchActivity,
    setTaskStatus
  };
});
