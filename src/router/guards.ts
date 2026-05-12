import type { Router } from 'vue-router'
import { useUserStore } from '@/stores/user.store'
import { APP_TITLE } from '@/shared/constants/app'

export function setupRouterGuards(router: Router) {
  router.beforeEach((to) => {
    const userStore = useUserStore()

    if (to.meta.requiresAuth && !userStore.isLoggedIn) {
      userStore.setGuestSession()
    }

    return true
  })

  router.afterEach((to) => {
    const title = typeof to.meta.title === 'string' ? to.meta.title : APP_TITLE
    document.title = title === APP_TITLE ? APP_TITLE : `${title} - ${APP_TITLE}`
  })
}
