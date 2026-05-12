import type { RouteRecordRaw } from 'vue-router'
import WorkbenchLayout from '@/layouts/WorkbenchLayout.vue'
import BlankLayout from '@/layouts/BlankLayout.vue'
import { moduleRoutes } from './module-routes'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/workbench',
  },
  {
    path: '/',
    component: WorkbenchLayout,
    children: moduleRoutes,
  },
  {
    path: '/:pathMatch(.*)*',
    component: BlankLayout,
    children: [
      {
        path: '',
        name: 'NotFound',
        component: () => import('@/shared/components/app-empty/AppEmpty.vue'),
        meta: {
          title: '页面不存在',
          layout: 'blank',
          requiresAuth: false,
        },
      },
    ],
  },
]
