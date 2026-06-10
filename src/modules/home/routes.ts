import type { RouteRecordRaw } from 'vue-router'

export const homeRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    alias: ['/workbench', '/calendar'],
    name: 'Home',
    component: () => import('./DashboardPage.vue'),
    meta: {
      title: '首页',
      requiresAuth: true,
    },
  },
]
