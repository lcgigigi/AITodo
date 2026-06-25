/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  readonly VITE_APP_BASE_API: string
  readonly VITE_APP_TODO_USERNAME: string
  readonly VITE_APP_TODO_PASSWORD: string
  readonly VITE_APP_MOCK: string
  readonly VITE_APP_PUBLIC_PATH: string
  readonly VITE_APP_AI_STREAM: string
  readonly VITE_APP_SYS_MESSAGE_WS_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
