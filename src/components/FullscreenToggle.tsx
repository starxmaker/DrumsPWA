import { useEffect, useRef, useState } from 'react'
import { FaCompress, FaExpand, FaXmark } from 'react-icons/fa6'
import { useI18n } from '../utils/i18n'

type FullscreenMode = 'native' | 'hint' | 'hidden'

interface PrefixedDocument extends Document {
  webkitFullscreenEnabled?: boolean
  webkitCurrentFullScreenElement?: Element | null
  webkitCancelFullScreen?: () => Promise<void>
}

interface PrefixedElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>
}

function inStandaloneMode(): boolean {
  return window.matchMedia?.('(display-mode: standalone)')?.matches === true
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function nativeFullscreenAvailable(): boolean {
  const doc = document as PrefixedDocument
  return document.fullscreenEnabled === true || doc.webkitFullscreenEnabled === true
}

function currentlyFullscreen(): boolean {
  const doc = document as PrefixedDocument
  return document.fullscreenElement != null || doc.webkitCurrentFullScreenElement != null
}

export default function FullscreenToggle() {
  const { t } = useI18n()
  const [mode] = useState<FullscreenMode>(() => {
    if (inStandaloneMode()) return 'hidden'
    return nativeFullscreenAvailable() ? 'native' : 'hint'
  })
  const [active, setActive] = useState(() => currentlyFullscreen())
  const [hint, setHint] = useState(false)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (mode !== 'native') return
    const sync = () => setActive(currentlyFullscreen())
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync)
    }
  }, [mode])

  useEffect(() => () => {
    if (hintTimer.current) clearTimeout(hintTimer.current)
  }, [])

  if (mode === 'hidden') return null

  const dismissHint = () => {
    setHint(false)
    if (hintTimer.current) {
      clearTimeout(hintTimer.current)
      hintTimer.current = null
    }
  }

  const toggle = () => {
    if (mode === 'native') {
      const doc = document as PrefixedDocument
      const root = document.documentElement as PrefixedElement
      if (currentlyFullscreen()) {
        if (document.exitFullscreen) void document.exitFullscreen().catch(() => undefined)
        else void doc.webkitCancelFullScreen?.().catch(() => undefined)
      } else if (root.requestFullscreen) {
        void root.requestFullscreen().catch(() => undefined)
      } else {
        void root.webkitRequestFullscreen?.().catch(() => undefined)
      }
      return
    }
    // Browsers without element fullscreen (notably iPhone Safari) cannot be
    // forced full screen; point at the share sheet's "Add to Home Screen",
    // since the installed app runs without browser chrome.
    setHint(true)
    if (hintTimer.current) clearTimeout(hintTimer.current)
    hintTimer.current = setTimeout(() => {
      hintTimer.current = null
      setHint(false)
    }, 6000)
    if (navigator.share) {
      void navigator.share({ title: document.title, url: window.location.href }).catch(() => undefined)
    }
  }

  return (
    <>
      {hint && (
        <div className="fab-toast" role="status" onClick={dismissHint}>
          <span>{t('fullscreen.addHomeScreen')}</span>
          <button type="button" className="fab-toast__close" aria-label={t('fullscreen.dismiss')} onClick={(event) => { event.stopPropagation(); dismissHint() }}>
            <FaXmark aria-hidden="true" />
          </button>
        </div>
      )}
      <button
        type="button"
        className="action-fab"
        aria-label={active ? t('fullscreen.exit') : t('fullscreen.enter')}
        onClick={toggle}
      >
        {active ? <FaCompress /> : <FaExpand />}
      </button>
    </>
  )
}
