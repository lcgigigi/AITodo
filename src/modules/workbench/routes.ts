import type { RouteRecordRaw } from 'vue-router'

export const workbenchRoutes: RouteRecordRaw[] = [
  {
    path: 'workbench',
    name: 'WorkbenchHome',
    component: () => import('./pages/WorkbenchHome.vue'),
    meta: {
      title: '工作台',
      icon: 'workspace',
      requiresAuth: true,
      keepAlive: true,
      permission: 'workbench:view',
      layout: 'workbench',
    },
  },
]
