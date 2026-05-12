import type { RouteRecordRaw } from 'vue-router'

export const agendaRoutes: RouteRecordRaw[] = [
  {
    path: 'agenda/calendar',
    name: 'AgendaCalendar',
    component: () => import('./pages/AgendaCalendar.vue'),
    meta: {
      title: '日程日历',
      icon: 'calendar',
      requiresAuth: true,
      keepAlive: true,
      permission: 'agenda:view',
      layout: 'workbench',
    },
  },
]
