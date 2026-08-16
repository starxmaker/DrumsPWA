import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type Theme = 'light' | 'dark'
export type SettingsState = { theme: Theme; volume: number }

export const THEME_STORAGE_KEY = 'drums-theme'
export const VOLUME_STORAGE_KEY = 'drums-volume'
export const DEFAULT_VOLUME = 80

function systemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function initialTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    if (value === 'light' || value === 'dark') return value
  } catch { /* Storage is optional. */ }
  return systemTheme()
}

export function clampVolume(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function initialVolume(): number {
  try {
    const stored = localStorage.getItem(VOLUME_STORAGE_KEY)
    if (stored !== null) {
      const value = Number(stored)
      if (Number.isFinite(value)) return clampVolume(value)
    }
  } catch { /* Storage is optional. */ }
  return DEFAULT_VOLUME
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState: { theme: initialTheme(), volume: initialVolume() } as SettingsState,
  reducers: {
    setTheme(state, action: PayloadAction<Theme>) { state.theme = action.payload },
    setVolume(state, action: PayloadAction<number>) { state.volume = clampVolume(action.payload) },
  },
})

export const { setTheme, setVolume } = settingsSlice.actions
export default settingsSlice.reducer
