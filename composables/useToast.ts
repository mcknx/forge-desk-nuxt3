import { storeToRefs } from "pinia";
import { useUiStore, type ToastTone } from "~~/stores/ui";

export function useToast() {
  const ui = useUiStore();
  const { toasts } = storeToRefs(ui);

  function push(message: string, tone: ToastTone = "info") {
    const id = ui.push(message, tone);
    // Client only: a timer started during SSR holds the request alive and then
    // fires against a store that was serialised and thrown away.
    if (import.meta.client) setTimeout(() => ui.dismiss(id), 4000);
    return id;
  }

  return { toasts, push, dismiss: ui.dismiss };
}
