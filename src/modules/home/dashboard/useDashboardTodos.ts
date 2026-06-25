import { computed, ref } from 'vue'
import { useUserStore } from '@/stores/user.store'
import type { CalendarEvent, CalendarUser } from './types'
import { compareEvents, dateRange } from './todoDisplay'
import {
  listTodos,
  loadAssignableUsers,
  loadCurrentUser,
  loadTodos,
  type TodoDateRange,
} from './todo.service'

type UseDashboardTodosOptions = {
  getLoadRange: () => TodoDateRange | undefined
  loadErrorFallback?: string
  onUnauthorized?: () => void
}

function isUnauthorizedError(message: string) {
  return message.includes('登录状态') || message.includes('401')
}

export function useDashboardTodos(options: UseDashboardTodosOptions) {
  const userStore = useUserStore()
  const allEvents = ref<CalendarEvent[]>([])
  const backendAssignableUsers = ref<CalendarUser[]>([])
  const isLoading = ref(false)
  const loadError = ref('')

  const currentUser = computed<CalendarUser>(() => ({
    id: userStore.profile?.id ?? '',
    name: userStore.profile?.name ?? '未登录',
    role: userStore.profile?.role ?? 'employee',
    department: userStore.profile?.department,
    avatar: userStore.profile?.avatar,
    leaderId: userStore.profile?.leaderId,
    teamMemberIds: userStore.profile?.teamMemberIds,
  }))

  const assignableUsers = computed(() => {
    if (backendAssignableUsers.value.length) return backendAssignableUsers.value
    return currentUser.value.id ? [currentUser.value] : []
  })

  const events = computed(() => listTodos(allEvents.value, currentUser.value))

  const eventMap = computed(() => {
    const map = new Map<string, CalendarEvent[]>()

    for (const event of events.value) {
      for (const date of dateRange(event.date, event.endDate)) {
        const list = map.get(date) ?? []
        list.push(event)
        map.set(date, list)
      }
    }

    for (const list of map.values()) {
      list.sort(compareEvents)
    }

    return map
  })

  async function refreshAssignableUsers() {
    backendAssignableUsers.value = await loadAssignableUsers()
  }

  async function refreshTodos() {
    if (!currentUser.value.id) return

    allEvents.value = await loadTodos(
      currentUser.value,
      assignableUsers.value,
      options.getLoadRange(),
    )
  }

  async function initializeDashboardTodos() {
    isLoading.value = true
    loadError.value = ''

    try {
      if (!userStore.token) {
        options.onUnauthorized?.()
        return false
      }

      if (!userStore.profile) {
        const profile = await loadCurrentUser()
        userStore.setProfile(profile)
      }

      await refreshAssignableUsers()
      await refreshTodos()
      return true
    } catch (error) {
      const message =
        error instanceof Error ? error.message : options.loadErrorFallback || '加载待办数据失败'
      loadError.value = message

      if (isUnauthorizedError(message)) {
        userStore.logout()
        options.onUnauthorized?.()
      }

      return false
    } finally {
      isLoading.value = false
    }
  }

  return {
    allEvents,
    assignableUsers,
    currentUser,
    eventMap,
    events,
    isLoading,
    loadError,
    refreshAssignableUsers,
    refreshTodos,
    initializeDashboardTodos,
  }
}
