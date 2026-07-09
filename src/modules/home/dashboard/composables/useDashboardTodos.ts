import { storeToRefs } from 'pinia'
import { useDashboardTodosStore } from '@/stores/dashboard-todos.store'
import type { CalendarEventStatus } from '../config/types'
import type { TodoDateRange } from '../services/todo.service'

type UseDashboardTodosOptions = {
  getLoadRange: () => TodoDateRange | undefined
  loadErrorFallback?: string
  onUnauthorized?: () => void
}

export function useDashboardTodos(options: UseDashboardTodosOptions) {
  const store = useDashboardTodosStore()
  const {
    assignableUsers,
    currentUser,
    eventMap,
    events,
    isLoading,
    loadError,
    statusUpdatingIds,
  } = storeToRefs(store)

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

  function isTodoStatusUpdating(id: string) {
    return statusUpdatingIds.value.has(id)
  }

  async function updateTodoStatusOptimistically(id: string, status: CalendarEventStatus) {
    return store.updateTodoStatusOptimistically(id, status, {
      onUnauthorized: options.onUnauthorized,
    })
  }

  return {
    assignableUsers,
    currentUser,
    eventMap,
    events,
    isLoading,
    loadError,
    statusUpdatingIds,
    refreshTodos,
    initializeDashboardTodos,
    isTodoStatusUpdating,
    updateTodoStatusOptimistically,
  }
}
