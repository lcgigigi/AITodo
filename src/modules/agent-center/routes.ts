import type { RouteRecordRaw } from 'vue-router'
import { PERMISSIONS } from '@/shared/constants/permission'

export const agentCenterRoutes: RouteRecordRaw[] = [
  {
    path: '/agents',
    name: 'AgentList',
    component: () => import('./index.vue'),
    meta: {
      title: '智能体中心',
      requiresAuth: false,
      permission: PERMISSIONS.AGENT_LIST_VIEW,
    },
  },
]
