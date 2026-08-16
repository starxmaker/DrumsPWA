import { act, fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import DrumKit from './DrumKit'
import { LocalizationProvider } from '../utils/i18n'
import en from '../locales/en.json'
import { ALT_HOLD_DELAY_MS, DRUM_PADS, HIHAT_OPEN_VELOCITY, PAINT_ORDER, type DrumPadId } from '../audio/drumKit'

function padName(id: DrumPadId): string {
  const pad = DRUM_PADS.find((entry) => entry.id === id)
  if (!pad) throw new Error(`Unknown pad: ${id}`)
  return `${en[pad.labelKey]}, key ${pad.keyboardKey.toUpperCase()}`
}

function renderKit(onHit = vi.fn()) {
  render(<LocalizationProvider><DrumKit onHit={onHit} /></LocalizationProvider>)
  return onHit
}

function pad(id: DrumPadId) {
  return screen.getByRole('button', { name: padName(id) })
}

describe('DrumKit', () => {
  it('renders every pad with a localized accessible name', () => {
    renderKit()
    for (const id of DRUM_PADS.map((entry) => entry.id)) {
      expect(pad(id)).toBeInTheDocument()
    }
  })

  it('paints the kick behind the toms and the cymbal discs in front of the drums', () => {
    const { container } = render(<LocalizationProvider><DrumKit onHit={vi.fn()} /></LocalizationProvider>)
    const labels = [...container.querySelectorAll('.drum-part')].map((element) => element.getAttribute('aria-label'))
    expect(labels).toEqual(PAINT_ORDER.map((id) => padName(id)))
  })

  it('plays a pad on pointer down', () => {
    const onHit = renderKit()
    fireEvent.pointerDown(pad('kick'), { pointerId: 3, pointerType: 'touch', button: 0 })
    expect(onHit).toHaveBeenCalledWith('kick', 1, 'primary', 0)
  })

  it('plays a pad with a darker, softer voice when struck on the rim', () => {
    const onHit = renderKit()
    const kick = pad('kick')
    vi.spyOn(kick, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100,
    } as unknown as DOMRect)
    fireEvent.pointerDown(kick, { pointerId: 3, pointerType: 'touch', button: 0, clientX: 95, clientY: 95 })
    expect(onHit).toHaveBeenCalledWith('kick', 0.65, 'primary', 1)
  })

  it('plays two pads struck at the same time (multi-touch)', () => {
    const onHit = renderKit()
    fireEvent.pointerDown(pad('kick'), { pointerId: 1, pointerType: 'touch', button: 0 })
    fireEvent.pointerDown(pad('snare'), { pointerId: 2, pointerType: 'touch', button: 0 })
    expect(onHit).toHaveBeenCalledTimes(2)
    expect(onHit).toHaveBeenCalledWith('kick', 1, 'primary', 0)
    expect(onHit).toHaveBeenCalledWith('snare', 1, 'primary', 0)
  })

  it('plays pads from their mapped keyboard keys', () => {
    const onHit = renderKit()
    fireEvent.keyDown(window, { key: 'l' })
    expect(onHit).toHaveBeenCalledWith('tomFloor', 0.9, 'primary', 0)
    fireEvent.keyDown(window, { key: 'z' })
    expect(onHit).toHaveBeenCalledTimes(1)
  })

  it('plays a focused pad with Enter', () => {
    const onHit = renderKit()
    fireEvent.keyDown(pad('crash'), { key: 'Enter' })
    expect(onHit).toHaveBeenCalledWith('crash', 0.9, 'primary', 0)
  })

  it('switches the hi-hat to its open voice when held', () => {
    vi.useFakeTimers()
    try {
      const onHit = renderKit()
      fireEvent.pointerDown(pad('hihat'), { pointerId: 5, pointerType: 'touch', button: 0 })
      expect(onHit).toHaveBeenCalledWith('hihat', 1, 'primary', 0)
      act(() => { vi.advanceTimersByTime(ALT_HOLD_DELAY_MS + 20) })
      expect(onHit).toHaveBeenCalledWith('hihat', 0.95, 'alt', 0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the hi-hat closed when tapped quickly', () => {
    vi.useFakeTimers()
    try {
      const onHit = renderKit()
      fireEvent.pointerDown(pad('hihat'), { pointerId: 5, pointerType: 'touch', button: 0 })
      act(() => { vi.advanceTimersByTime(100) })
      fireEvent.pointerUp(window, { pointerId: 5 })
      act(() => { vi.advanceTimersByTime(ALT_HOLD_DELAY_MS) })
      expect(onHit).toHaveBeenCalledTimes(1)
      expect(onHit).toHaveBeenCalledWith('hihat', 1, 'primary', 0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('plays the open hi-hat from its dedicated button', () => {
    const onHit = renderKit()
    fireEvent.pointerDown(screen.getByRole('button', { name: en['drum.hihatOpen'] }), { pointerId: 9, pointerType: 'touch', button: 0 })
    expect(onHit).toHaveBeenCalledWith('hihat', HIHAT_OPEN_VELOCITY, 'alt')
  })

  it('plays the open hi-hat from its keyboard key', () => {
    const onHit = renderKit()
    fireEvent.keyDown(window, { key: 'f' })
    expect(onHit).toHaveBeenCalledWith('hihat', HIHAT_OPEN_VELOCITY, 'alt')
    fireEvent.keyDown(window, { key: 'f', repeat: true })
    expect(onHit).toHaveBeenCalledTimes(1)
  })

  it('chokes the ringing closed voice when opening via the button', () => {
    vi.useFakeTimers()
    try {
      const onHit = renderKit()
      fireEvent.pointerDown(pad('hihat'), { pointerId: 5, pointerType: 'touch', button: 0 })
      fireEvent.pointerUp(window, { pointerId: 5 })
      fireEvent.pointerDown(screen.getByRole('button', { name: en['drum.hihatOpen'] }), { pointerId: 9, pointerType: 'touch', button: 0 })
      expect(onHit).toHaveBeenCalledTimes(2)
      expect(onHit).toHaveBeenLastCalledWith('hihat', HIHAT_OPEN_VELOCITY, 'alt')
      act(() => { vi.advanceTimersByTime(ALT_HOLD_DELAY_MS * 2) })
      expect(onHit).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
