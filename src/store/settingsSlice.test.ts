import { vi } from 'vitest'
import reducer, { clampVolume, DEFAULT_VOLUME, setVolume, setTheme } from './settingsSlice'

describe('settings slice', () => {
  it('clamps volume to whole numbers between 0 and 100', () => {
    expect(clampVolume(150)).toBe(100)
    expect(clampVolume(-5)).toBe(0)
    expect(clampVolume(47.6)).toBe(48)
    expect(clampVolume(80)).toBe(80)
  })

  it('initializes volume from storage and falls back to the default', async () => {
    // The statically imported module was evaluated with nothing stored.
    expect(reducer(undefined, { type: 'init' }).volume).toBe(DEFAULT_VOLUME)

    localStorage.setItem('drums-volume', 'not-a-number')
    vi.resetModules()
    const invalidFresh = (await import('./settingsSlice')).default
    expect(invalidFresh(undefined, { type: 'init' }).volume).toBe(DEFAULT_VOLUME)

    localStorage.setItem('drums-volume', '37')
    localStorage.setItem('drums-theme', 'dark')
    vi.resetModules()
    const validFresh = (await import('./settingsSlice')).default
    const state = validFresh(undefined, { type: 'init' })
    expect(state.volume).toBe(37)
    expect(state.theme).toBe('dark')
    localStorage.clear()
  })

  it('stores themed and clamped volume changes', () => {
    let state = reducer(undefined, { type: 'init' })
    state = reducer(state, setTheme('dark'))
    state = reducer(state, setVolume(999))
    expect(state.theme).toBe('dark')
    expect(state.volume).toBe(100)
    state = reducer(state, setVolume(-1))
    expect(state.volume).toBe(0)
  })
})
