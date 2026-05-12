import type { RouteRecordRaw } from 'vue-router'

export const aiAgentRoutes: RouteRecordRaw[] = [
  {
    path: 'ai-agent',
    name: 'AgentCenter',
    component: () => import('./pages/AgentCenter.vue'),
    meta: {
      title: '智能体中心',
      icon: 'chat-bot',
      requiresAuth: true,
      keepAlive: true,
      permission: 'ai-agent:view',
      layout: 'workbench',
    },
  },
]
