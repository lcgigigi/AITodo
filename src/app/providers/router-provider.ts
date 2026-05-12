import type { App } from 'vue'
import { router } from '@/router'

export async function setupRouter(app: App) {
  app.use(router)
  await router.isReady()
}
