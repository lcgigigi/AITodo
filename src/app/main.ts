import 'virtual:uno.css'
import '@/styles/index.css'

import { createApp } from 'vue'
import naive from 'naive-ui'
import App from './App.vue'
import { setupPinia } from './providers/pinia-provider'
import { setupRouter } from './providers/router-provider'

async function bootstrap() {
  const app = createApp(App)

  app.use(naive)
  setupPinia(app)
  await setupRouter(app)

  app.mount('#app')
}

void bootstrap()
