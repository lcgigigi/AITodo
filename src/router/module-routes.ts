import type { RouteRecordRaw } from 'vue-router'
import { agentCenterRoutes } from '@/modules/agent-center'
import { homeRoutes } from '@/modules/home/routes'

export const moduleRoutes: RouteRecordRaw[] = [...homeRoutes, ...agentCenterRoutes]
