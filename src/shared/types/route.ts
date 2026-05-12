import type { RouteMeta } from 'vue-router'

export interface AppRouteMeta extends RouteMeta {
  title: string
  icon?: string
  requiresAuth?: boolean
  keepAlive?: boolean
  permission?: string
  layout?: 'base' | 'workbench' | 'blank'
}
