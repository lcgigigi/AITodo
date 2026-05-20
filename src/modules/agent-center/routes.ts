import type { RouteRecordRaw } from 'vue-router'
import { PERMISSIONS } from '@/shared/constants/permission'

export const agentCenterRoutes: RouteRecordRaw[] = [
  {
    path: '/agents',
    name: 'AgentList',
    component: () => import('./AgentListPage.vue'),
    meta: {
      title: '智能体列表',
      requiresAuth: false,
      permission: PERMISSIONS.AGENT_LIST_VIEW,
    },
  },
]
