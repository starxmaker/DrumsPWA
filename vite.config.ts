import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = env.VITE_BASE_PATH || '/DrumsPWA/'

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        strategies: 'generateSW',
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['icons/*.{svg,png}'],
        manifest: {
          name: 'Drum Kit',
          short_name: 'Drums',
          description: 'An offline drum kit you can play with your fingers',
          start_url: base,
          scope: base,
          display: 'standalone',
          background_color: '#131009',
          theme_color: '#a34a26',
          icons: [
            { src: 'icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
            { src: 'icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,json,flac,md,txt}'],
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    server: { port: 5174 },
  }
})
