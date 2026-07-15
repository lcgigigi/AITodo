import type { RouteRecordRaw } from 'vue-router'
import { PERMISSIONS } from '@/shared/constants/permission'

export const leaderBoardRoutes: RouteRecordRaw[] = [
  {
    path: '/leader-board',
    name: 'LeaderBoard',
    component: () => import('./index.vue'),
    meta: {
      title: 'Token看板',
      requiresAuth: true,
      requiresTokensPower: true,
      permission: PERMISSIONS.AGENT_LIST_VIEW,
    },
  },
]
