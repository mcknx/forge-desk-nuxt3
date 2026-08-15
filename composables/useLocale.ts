import { useI18n } from 'vue-i18n'

export const LOCALE_COOKIE = 'forge-locale'

export const LOCALES: { code: string, label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fil', label: 'Filipino' },
]

export function useLocale() {
  const { locale } = useI18n()

  // A cookie rather than localStorage: plugins/i18n.ts reads it while rendering
  // on the server, so the very first HTML is already in the chosen language
  // instead of flipping from English after hydration.
  const stored = useCookie<string>(LOCALE_COOKIE, {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
  })

  useHead({ htmlAttrs: { lang: locale } })

  function setLocale(code: string) {
    if (!LOCALES.some((l) => l.code === code)) return
    locale.value = code
    stored.value = code
  }

  return { locale, locales: LOCALES, setLocale }
}
