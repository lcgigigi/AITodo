export const env = {
  title: import.meta.env.VITE_APP_TITLE,
  baseApi: import.meta.env.VITE_APP_BASE_API,
  mock: import.meta.env.VITE_APP_MOCK === 'true',
  publicPath: import.meta.env.VITE_APP_PUBLIC_PATH,
  aiStream: import.meta.env.VITE_APP_AI_STREAM === 'true',
}
