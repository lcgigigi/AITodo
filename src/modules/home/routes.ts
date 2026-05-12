import type { RouteRecordRaw } from 'vue-router'

export const homeRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('./DashboardPage.vue'),
    meta: {
      title: '首页',
      requiresAuth: false,
    },
  },
]
