/* eslint-disable react-refresh/only-export-components */
import React from 'react'
import enStrings from '../locales/en.json'
import esStrings from '../locales/es.json'

export const LANGUAGE_STORAGE_KEY = 'drums-language'
export const SUPPORTED_LANGUAGES = ['en', 'es'] as const
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]
export type AppLanguageSetting = AppLanguage | 'system'
export type TranslationKey = keyof typeof enStrings

const STRINGS: Record<AppLanguage, Record<TranslationKey, string>> = { en: enStrings, es: esStrings }

function normalizeLanguage(input: string | null | undefined): AppLanguage | null {
  if (!input) return null
  const normalized = input.toLowerCase()
  if (normalized.startsWith('es')) return 'es'
  if (normalized.startsWith('en')) return 'en'
  return null
}

export function getSystemLanguage(): AppLanguage {
  if (typeof navigator === 'undefined') return 'en'
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const candidate of candidates) {
    const language = normalizeLanguage(candidate)
    if (language) return language
  }
  return 'en'
}

export function getInitialLanguageSetting(): AppLanguageSetting {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (stored === 'system') return stored
    return normalizeLanguage(stored) ?? 'system'
  } catch { return 'system' }
}

type I18nContextValue = {
  language: AppLanguage
  languageSetting: AppLanguageSetting
  setLanguageSetting: (setting: AppLanguageSetting) => void
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
}

const I18nContext = React.createContext<I18nContextValue>({
  language: 'en',
  languageSetting: 'system',
  setLanguageSetting: () => undefined,
  t: (key) => enStrings[key],
})

export function LocalizationProvider({ children }: { children: React.ReactNode }) {
  const [languageSetting, setLanguageSettingState] = React.useState<AppLanguageSetting>(getInitialLanguageSetting)
  const language = languageSetting === 'system' ? getSystemLanguage() : languageSetting

  const setLanguageSetting = React.useCallback((setting: AppLanguageSetting) => {
    setLanguageSettingState(setting)
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, setting) } catch { /* Storage is optional. */ }
  }, [])

  const value = React.useMemo<I18nContextValue>(() => ({
    language,
    languageSetting,
    setLanguageSetting,
    t: (key, params) => {
      const template = STRINGS[language][key] ?? enStrings[key]
      return params
        ? template.replace(/\{(\w+)\}/g, (_, token: string) => String(params[token] ?? `{${token}}`))
        : template
    },
  }), [language, languageSetting, setLanguageSetting])

  React.useEffect(() => { document.documentElement.lang = language }, [language])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() { return React.useContext(I18nContext) }
