import { render } from '@testing-library/react'
import { Provider } from 'react-redux'
import App from './App'
import { store } from './store'
import { LocalizationProvider } from './utils/i18n'

describe('App smoke test', () => {
  it('renders the shell without crashing', () => {
    const { container } = render(
      <Provider store={store}>
        <LocalizationProvider><App /></LocalizationProvider>
      </Provider>,
    )
    expect(container.querySelector('.app-shell')).not.toBeNull()
    expect(container.querySelectorAll('.drum-part').length).toBe(8)
  })
})
