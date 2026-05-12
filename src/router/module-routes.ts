import type { RouteRecordRaw } from 'vue-router'
import { homeRoutes } from '@/modules/home/routes'

export const moduleRoutes: RouteRecordRaw[] = [...homeRoutes]
