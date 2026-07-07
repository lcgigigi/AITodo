import type { Router } from 'vue-router'
import { routeConfig } from '@/config/route.config'
import { getDesktopAuthRequest, redirectDesktopAuthCallback } from '@/modules/auth/desktop-auth'
import { APP_TITLE } from '@/shared/constants/app'
import { useUserStore } from '@/stores/user.store'

export function setupRouterGuards(router: Router) {
  router.beforeEach((to) => {
    const userStore = useUserStore()
    const isLoginRoute = to.path === routeConfig.loginRoute

    if (isLoginRoute && userStore.isLoggedIn) {
      const desktopAuthRequest = getDesktopAuthRequest(to.query)
      if (desktopAuthRequest) {
        if (userStore.token && userStore.profile?.id) {
          redirectDesktopAuthCallback({
            callback: desktopAuthRequest.callback,
            state: desktopAuthRequest.state,
            token: userStore.token,
            profile: userStore.profile,
          })
          return false
        }

        return true
      }

      const redirect = Array.isArray(to.query.redirect) ? to.query.redirect[0] : to.query.redirect
      return redirect?.startsWith('/') && !redirect.startsWith('//')
        ? redirect
        : routeConfig.defaultRoute
    }

    if (to.meta.requiresAuth && !userStore.isLoggedIn) {
      return {
        path: routeConfig.loginRoute,
        query: {
          redirect: to.fullPath,
        },
      }
    }

    return true
  })

  router.afterEach((to) => {
    const title = typeof to.meta.title === 'string' ? to.meta.title : APP_TITLE
    document.title = title === APP_TITLE ? APP_TITLE : `${title} - ${APP_TITLE}`
  })
}
