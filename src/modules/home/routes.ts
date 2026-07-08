import type { RouteRecordRaw } from 'vue-router'

export const homeRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    alias: ['/workbench', '/calendar'],
    name: 'Home',
    component: () => import('./DashboardPage.vue'),
    meta: {
      title: 'AI办公平台',
      requiresAuth: true,
    },
  },
]
