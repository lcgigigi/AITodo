import type { RouteRecordRaw } from 'vue-router'
import { moduleRoutes } from './module-routes'

export const routes: RouteRecordRaw[] = [
  ...moduleRoutes,
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]
