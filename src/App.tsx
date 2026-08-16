import { useEffect, useState } from 'react'
import { FaArrowsRotate, FaDrum, FaGear, FaMobileScreenButton } from 'react-icons/fa6'
import { useDrumAudio } from './audio/useDrumAudio'
import DrumKit from './components/DrumKit'
import FullscreenToggle from './components/FullscreenToggle'
import InstallApp from './components/InstallApp'
import Settings from './components/Settings'
import { useAppSelector } from './store/hooks'
import { useI18n } from './utils/i18n'

export default function App() {
  const { t } = useI18n()
  const theme = useAppSelector((state) => state.settings.theme)
  const volume = useAppSelector((state) => state.settings.volume)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { status, loadedCount, totalCount, usingFallback, play, retry } = useDrumAudio(volume)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#131009' : '#a34a26')
  }, [theme])

  return (
    <div className="app-shell">
      <main>
        <section className="stage-card" aria-label={t('kit.stageLabel')}>
          <DrumKit onHit={play} />
        </section>

        <p className={`status-line status-line--${status}`} role="status" aria-live="polite">
          {status === 'loading' && <><FaDrum aria-hidden="true" className="status-spinner" /> {t('status.loading', { loaded: loadedCount, total: totalCount })}</>}
          {status === 'ready' && usingFallback && <span className="status-warning">{t('status.fallback')}</span>}
          {status === 'error' && <>
            {t('status.error')}
            <button type="button" className="retry-button" onClick={retry}>
              <FaArrowsRotate aria-hidden="true" /> {t('status.retry')}
            </button>
          </>}
        </p>

        <InstallApp />
      </main>

      <div className="fab-stack">
        <FullscreenToggle />
        <button type="button" className="action-fab" aria-label={t('settings.open')} onClick={() => setSettingsOpen(true)}>
          <FaGear />
        </button>
      </div>
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <div className="rotate-overlay" role="status">
        <FaMobileScreenButton aria-hidden="true" />
        <p>{t('rotate.message')}</p>
      </div>
    </div>
  )
}
