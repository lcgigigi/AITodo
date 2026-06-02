import '@/styles/index.css'

import { createApp } from 'vue'
import App from './App.vue'
import { setupPinia } from './providers/pinia-provider'
import { setupRouter } from './providers/router-provider'

async function bootstrap() {
  const app = createApp(App)

  setupPinia(app)
  await setupRouter(app)

  app.mount('#app')
}

void bootstrap()
