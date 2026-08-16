import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import App from './App'
import './index.css'
import { store } from './store'
import { LocalizationProvider } from './utils/i18n'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <LocalizationProvider><App /></LocalizationProvider>
    </Provider>
  </React.StrictMode>,
)
