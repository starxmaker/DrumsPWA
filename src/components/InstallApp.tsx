import { PWAInstallElement } from '@khmyznikov/pwa-install'
import { useEffect, useRef, useState } from 'react'
import { FaDownload } from 'react-icons/fa6'
import { useI18n } from '../utils/i18n'

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export default function InstallApp() {
  const { t } = useI18n()
  const installRef = useRef<PWAInstallElement | null>(null)
  const [ready, setReady] = useState(false)
  const [installed, setInstalled] = useState(() => isStandalone())

  useEffect(() => {
    let active = true
    void customElements.whenDefined('pwa-install').then(() => {
      if (active) {
        setReady(true)
        setInstalled(installRef.current?.isUnderStandaloneMode ?? isStandalone())
      }
    })
    const markInstalled = () => setInstalled(true)
    window.addEventListener('appinstalled', markInstalled)
    return () => {
      active = false
      window.removeEventListener('appinstalled', markInstalled)
    }
  }, [])

  return (
    <>
      {!installed && ready && (
        <button className="install-button" type="button" onClick={() => installRef.current?.showDialog?.(true)}>
          <FaDownload aria-hidden="true" />
          <span><strong>{t('install.title')}</strong><small>{t('install.description')}</small></span>
        </button>
      )}
      <pwa-install ref={installRef} manifest-url={`${import.meta.env.BASE_URL}manifest.webmanifest`} />
    </>
  )
}
