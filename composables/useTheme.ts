import { useUiStore } from "~~/stores/ui";

const STORAGE_KEY = "forge-theme";

/**
 * The theme lives on <html class="dark">, outside Vue's control, so toggling it
 * never causes a hydration mismatch — the store copy only drives the toggle's
 * own icon.
 */
export function useTheme() {
  const ui = useUiStore();

  useHead({
    script: [
      {
        key: "forge-theme-init",
        tagPosition: "head",
        // Inline and synchronous on purpose. The stored choice only exists in
        // localStorage, which the server cannot read, so the class has to be
        // applied by the browser itself before the first paint. An external
        // script file would need a round trip and the page would already have
        // painted light — the flash this exists to prevent.
        innerHTML: `try{var t=localStorage.getItem('${STORAGE_KEY}');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`
      }
    ]
  });

  onMounted(() => {
    ui.theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
  });

  function toggle() {
    const next = ui.theme === "dark" ? "light" : "dark";
    ui.theme = next;
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Safari private mode throws on setItem. Losing the preference is fine;
      // losing the click is not.
    }
  }

  return { theme: toRef(ui, "theme"), toggle };
}
