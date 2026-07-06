import { storeToRefs } from 'pinia'
import { useDashboardTodosStore } from '@/stores/dashboard-todos.store'
import type { TodoDateRange } from './todo.service'

type UseDashboardTodosOptions = {
  getLoadRange: () => TodoDateRange | undefined
  loadErrorFallback?: string
  onUnauthorized?: () => void
}

export function useDashboardTodos(options: UseDashboardTodosOptions) {
  const store = useDashboardTodosStore()
  const { assignableUsers, currentUser, eventMap, events, isLoading, loadError } =
    storeToRefs(store)

  async function refreshTodos() {
    const range = options.getLoadRange()
    if (!range) return

    await store.loadForRange(range, {
      force: true,
      onUnauthorized: options.onUnauthorized,
    })
  }

  async function initializeDashboardTodos() {
    const range = options.getLoadRange()
    return store.initialize(range, {
      onUnauthorized: options.onUnauthorized,
      loadErrorFallback: options.loadErrorFallback,
    })
  }

  return {
    assignableUsers,
    currentUser,
    eventMap,
    events,
    isLoading,
    loadError,
    refreshTodos,
    initializeDashboardTodos,
  }
}
