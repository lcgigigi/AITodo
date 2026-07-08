import type { RouteRecordRaw } from 'vue-router'

export const suggestionInboxRoutes: RouteRecordRaw[] = [
  {
    path: '/suggestion-inbox',
    name: 'SuggestionInbox',
    component: () => import('./SuggestionInboxPage.vue'),
    meta: {
      title: '心声收件箱',
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
]
