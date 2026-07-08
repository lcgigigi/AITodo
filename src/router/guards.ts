import type { Router } from 'vue-router'
import { routeConfig } from '@/config/route.config'
import { getDesktopAuthRequest } from '@/modules/auth/desktop-auth'
import { APP_TITLE } from '@/shared/constants/app'
import { useUserStore } from '@/stores/user.store'

export function setupRouterGuards(router: Router) {
  router.beforeEach((to, from) => {
    const userStore = useUserStore()
    const isLoginRoute = to.path === routeConfig.loginRoute

    if (isLoginRoute && userStore.isLoggedIn) {
      const desktopAuthRequest = getDesktopAuthRequest(to.query)
      if (desktopAuthRequest) {
        const targetPath =
          from.matched.length > 0 && from.path !== routeConfig.loginRoute
            ? from.path
            : routeConfig.defaultRoute
        const desktopClient = Array.isArray(to.query.desktopClient)
          ? to.query.desktopClient[0]
          : to.query.desktopClient
        const desktopUserId = Array.isArray(to.query.desktopUserId)
          ? to.query.desktopUserId[0]
          : to.query.desktopUserId

        return {
          path: targetPath,
          query: {
            ...(targetPath === from.path ? from.query : {}),
            from: 'desktop',
            desktopCallback: desktopAuthRequest.callback,
            state: desktopAuthRequest.state,
            ...(desktopClient ? { desktopClient } : {}),
            ...(desktopUserId ? { desktopUserId } : {}),
          },
          hash: targetPath === from.path ? from.hash : '',
        }
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
