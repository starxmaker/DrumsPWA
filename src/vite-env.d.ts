/// <reference types="vite/client" />

declare const __APP_VERSION__: string

declare namespace JSX {
  interface IntrinsicElements {
    'pwa-install': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      'manifest-url'?: string
    }
  }
}
