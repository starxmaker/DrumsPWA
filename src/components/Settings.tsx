import { useEffect } from 'react'
import { FaGithub, FaXmark } from 'react-icons/fa6'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { setTheme, setVolume, type Theme } from '../store/settingsSlice'
import { useI18n, type AppLanguageSetting } from '../utils/i18n'

export default function Settings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, languageSetting, setLanguageSetting } = useI18n()
  const theme = useAppSelector((state) => state.settings.theme)
  const volume = useAppSelector((state) => state.settings.volume)
  const dispatch = useAppDispatch()

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose, open])

  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="settings-header">
          <h2 id="settings-title">{t('settings.title')}</h2>
          <button className="icon-button" onClick={onClose} aria-label={t('settings.close')}><FaXmark /></button>
        </div>
        <label>
          <span>{t('settings.theme')}</span>
          <select value={theme} onChange={(event) => dispatch(setTheme(event.target.value as Theme))}>
            <option value="light">{t('settings.light')}</option>
            <option value="dark">{t('settings.dark')}</option>
          </select>
        </label>
        <label>
          <span>{t('language.label')}</span>
          <select value={languageSetting} onChange={(event) => setLanguageSetting(event.target.value as AppLanguageSetting)}>
            <option value="system">{t('language.auto')}</option>
            <option value="en">{t('language.english')}</option>
            <option value="es">{t('language.spanish')}</option>
          </select>
        </label>
        <label>
          <span>{t('settings.volume')} — {volume}%</span>
          <input
            className="volume-slider"
            type="range"
            min={0}
            max={100}
            step={1}
            value={volume}
            onChange={(event) => dispatch(setVolume(Number(event.target.value)))}
          />
        </label>
        <div className="settings-credits">
          <span>{t('settings.creditsLabel')}</span>
          <a href="https://freepats.zenvoid.org/Percussion/acoustic-drum-kit.html" target="_blank" rel="noreferrer">{t('settings.soundsCredit')}</a>
          <a className="settings-github-link" href="https://github.com/starxmaker/DrumsPWA" target="_blank" rel="noreferrer" aria-label={t('settings.github')} title={t('settings.github')}><FaGithub aria-hidden="true" /></a>
          <span>{t('settings.version', { version: __APP_VERSION__ })}</span>
        </div>
      </section>
    </div>
  )
}
