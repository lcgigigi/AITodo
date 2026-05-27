import type { RouteRecordRaw } from 'vue-router'
import { agentCenterRoutes } from '@/modules/agent-center/routes'
import { homeRoutes } from '@/modules/home/routes'

export const moduleRoutes: RouteRecordRaw[] = [...homeRoutes, ...agentCenterRoutes]
