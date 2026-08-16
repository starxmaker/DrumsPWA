import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import FullscreenToggle from './FullscreenToggle'
import { LocalizationProvider } from '../utils/i18n'

function mockFullscreen({ enabled, element = null }: { enabled: boolean; element?: Element | null }) {
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, get: () => enabled })
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => element })
}

function mockStandalone(standalone: boolean) {
  Object.defineProperty(navigator, 'standalone', { configurable: true, get: () => standalone })
}

describe('FullscreenToggle', () => {
  beforeEach(() => {
    document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined)
    document.exitFullscreen = vi.fn().mockResolvedValue(undefined)
    mockStandalone(false)
  })

  afterEach(() => {
    mockFullscreen({ enabled: false, element: null })
    mockStandalone(false)
    vi.restoreAllMocks()
  })

  it('renders nothing when already running as an installed app', () => {
    mockFullscreen({ enabled: true })
    mockStandalone(true)
    const { container } = render(<LocalizationProvider><FullscreenToggle /></LocalizationProvider>)
    expect(container.querySelector('button')).toBeNull()
  })

  it('requests full screen on the document when pressed', () => {
    mockFullscreen({ enabled: true })
    render(<LocalizationProvider><FullscreenToggle /></LocalizationProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Enter full screen' }))
    expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(1)
  })

  it('exits full screen and updates its label with the fullscreen state', () => {
    mockFullscreen({ enabled: true })
    render(<LocalizationProvider><FullscreenToggle /></LocalizationProvider>)
    const button = screen.getByRole('button', { name: 'Enter full screen' })

    mockFullscreen({ enabled: true, element: document.documentElement })
    fireEvent(document, new Event('fullscreenchange'))
    expect(screen.getByRole('button', { name: 'Exit full screen' })).toBe(button)

    fireEvent.click(button)
    expect(document.exitFullscreen).toHaveBeenCalledTimes(1)
  })

  it('offers Add to Home Screen instead when fullscreen is unavailable (iPhone Safari)', () => {
    mockFullscreen({ enabled: false })
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { configurable: true, get: () => share })

    render(<LocalizationProvider><FullscreenToggle /></LocalizationProvider>)
    const button = screen.getByRole('button', { name: 'Enter full screen' })
    expect(document.documentElement.requestFullscreen).not.toHaveBeenCalled()

    fireEvent.click(button)
    expect(share).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('Add to Home Screen')

    fireEvent.click(screen.getByRole('button', { name: 'Close message' }))
    expect(screen.queryByRole('status')).toBeNull()
  })
})
