import type { RouteRecordRaw } from 'vue-router'
import { agentCenterRoutes } from '@/modules/agent-center/routes'
import { authRoutes } from '@/modules/auth/routes'
import { homeRoutes } from '@/modules/home/routes'
import { leaderBoardRoutes } from '@/modules/leader-board/routes'

export const moduleRoutes: RouteRecordRaw[] = [
  ...authRoutes,
  ...homeRoutes,
  ...agentCenterRoutes,
  ...leaderBoardRoutes,
]
