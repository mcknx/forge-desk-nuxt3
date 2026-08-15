import { createI18n } from "vue-i18n";
import en from "~~/i18n/en.json";
import fil from "~~/i18n/fil.json";
import { LOCALE_COOKIE, LOCALES } from "~~/composables/useLocale";

export default defineNuxtPlugin((nuxtApp) => {
  // Read on the server too, so the first HTML is already translated instead of
  // rendering English and swapping after hydration.
  const stored = useCookie<string>(LOCALE_COOKIE).value;
  const locale = LOCALES.some((l) => l.code === stored) ? stored : "en";

  const i18n = createI18n({
    legacy: false,
    // Templates use $t directly; without this only setup-scope useI18n() works.
    globalInjection: true,
    locale,
    fallbackLocale: "en",
    messages: { en, fil }
  });

  nuxtApp.vueApp.use(i18n);
});
