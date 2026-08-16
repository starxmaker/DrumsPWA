import { configureStore, type Middleware } from '@reduxjs/toolkit'
import settingsReducer, { THEME_STORAGE_KEY, VOLUME_STORAGE_KEY, type SettingsState } from './settingsSlice'

export type RootState = { settings: SettingsState }

const persistSettings: Middleware<object, RootState> = (store) => (next) => (action) => {
  const result = next(action)
  const actionType = (action as { type?: unknown }).type
  if (typeof actionType === 'string' && actionType.startsWith('settings/')) {
    const { settings } = store.getState()
    try {
      if (actionType === 'settings/setTheme') localStorage.setItem(THEME_STORAGE_KEY, settings.theme)
      if (actionType === 'settings/setVolume') localStorage.setItem(VOLUME_STORAGE_KEY, String(settings.volume))
    } catch { /* Storage is optional. */ }
  }
  return result
}

export const store = configureStore({
  reducer: { settings: settingsReducer },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(persistSettings),
})

export type AppDispatch = typeof store.dispatch
