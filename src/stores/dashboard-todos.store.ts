import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { compareEvents, dateRange } from '@/modules/home/dashboard/todoDisplay'
import type {
  CalendarEvent,
  CalendarEventStatus,
  CalendarUser,
} from '@/modules/home/dashboard/types'
import {
  listTodos,
  loadAssignableUsers,
  loadCurrentUser,
  loadTodos,
  type TodoDateRange,
  updateTodoStatus as serviceUpdateTodoStatus,
} from '@/modules/home/dashboard/todo.service'
import { useUserStore } from '@/stores/user.store'

type LoadRangeOptions = {
  force?: boolean
  onUnauthorized?: () => void
}

function isUnauthorizedError(message: string) {
  return message.includes('登录状态') || message.includes('401')
}

function mergeTodoDateRange(current: TodoDateRange | null, next: TodoDateRange): TodoDateRange {
  if (!current) return next

  return {
    startDate: current.startDate < next.startDate ? current.startDate : next.startDate,
    endDate: current.endDate > next.endDate ? current.endDate : next.endDate,
  }
}

function rangeContains(outer: TodoDateRange, inner: TodoDateRange) {
  return outer.startDate <= inner.startDate && outer.endDate >= inner.endDate
}

export const useDashboardTodosStore = defineStore('dashboard-todos', () => {
  const userStore = useUserStore()

  const allEvents = ref<CalendarEvent[]>([])
  const backendAssignableUsers = ref<CalendarUser[]>([])
  const isLoading = ref(false)
  const isInitialized = ref(false)
  const loadError = ref('')
  const loadedRange = ref<TodoDateRange | null>(null)
  const statusUpdatingIds = ref<Set<string>>(new Set())
  const statusUpdateOperations = new Map<string, symbol>()

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

  function reset() {
    allEvents.value = []
    backendAssignableUsers.value = []
    isLoading.value = false
    isInitialized.value = false
    loadError.value = ''
    loadedRange.value = null
    statusUpdatingIds.value = new Set()
    statusUpdateOperations.clear()
  }

  function setStatusUpdating(id: string, updating: boolean) {
    const next = new Set(statusUpdatingIds.value)

    if (updating) {
      next.add(id)
    } else {
      next.delete(id)
    }

    statusUpdatingIds.value = next
  }

  function buildOptimisticStatusPatch(
    event: CalendarEvent,
    status: CalendarEventStatus,
  ): CalendarEvent {
    if (status === 'done') {
      return {
        ...event,
        status,
        backendStatus: 6,
        handleDesc: event.handleDesc || '已完成',
      }
    }

    return {
      ...event,
      status,
      backendStatus: event.receiveStatus === 1 ? 3 : 0,
      handleDesc: undefined,
    }
  }

  function replaceEvent(id: string, resolveNextEvent: (event: CalendarEvent) => CalendarEvent) {
    allEvents.value = allEvents.value.map((event) =>
      event.id === id ? resolveNextEvent(event) : event,
    )
  }

  async function refreshAssignableUsers() {
    backendAssignableUsers.value = await loadAssignableUsers()
  }

  async function fetchTodosForRange(range: TodoDateRange) {
    if (!currentUser.value.id) return

    allEvents.value = await loadTodos(currentUser.value, assignableUsers.value, range)
    loadedRange.value = range
    isInitialized.value = true
  }

  async function loadForRange(range: TodoDateRange | undefined, options: LoadRangeOptions = {}) {
    if (!range) return false

    if (
      !options.force &&
      isInitialized.value &&
      loadedRange.value &&
      rangeContains(loadedRange.value, range)
    ) {
      return true
    }

    const nextRange = options.force ? range : mergeTodoDateRange(loadedRange.value, range)
    const showBlockingLoading = !isInitialized.value

    if (showBlockingLoading) {
      isLoading.value = true
    }
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

      if (!backendAssignableUsers.value.length) {
        await refreshAssignableUsers()
      }

      await fetchTodosForRange(nextRange)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载待办数据失败'
      loadError.value = message

      if (isUnauthorizedError(message)) {
        reset()
        userStore.logout()
        options.onUnauthorized?.()
      }

      return false
    } finally {
      if (showBlockingLoading) {
        isLoading.value = false
      }
    }
  }

  async function initialize(
    range: TodoDateRange | undefined,
    options: LoadRangeOptions & { loadErrorFallback?: string } = {},
  ) {
    return loadForRange(range, options)
  }

  async function reloadCurrentRange(options: LoadRangeOptions = {}) {
    if (!loadedRange.value) return false
    return loadForRange(loadedRange.value, { ...options, force: true })
  }

  async function updateTodoStatusOptimistically(
    id: string,
    status: CalendarEventStatus,
    options: LoadRangeOptions = {},
  ) {
    if (!id || statusUpdatingIds.value.has(id)) return false

    const operation = Symbol(id)
    const previousEvent = allEvents.value.find((event) => event.id === id)

    statusUpdateOperations.set(id, operation)
    setStatusUpdating(id, true)

    if (previousEvent) {
      replaceEvent(id, (event) => buildOptimisticStatusPatch(event, status))
    }

    try {
      await serviceUpdateTodoStatus(id, currentUser.value, status, assignableUsers.value)
      return true
    } catch (error) {
      if (statusUpdateOperations.get(id) === operation) {
        if (previousEvent) {
          replaceEvent(id, (event) => (event.id === id ? { ...previousEvent } : event))
        }

        await reloadCurrentRange(options)
      }

      throw error
    } finally {
      if (statusUpdateOperations.get(id) === operation) {
        statusUpdateOperations.delete(id)
        setStatusUpdating(id, false)
      }
    }
  }

  return {
    allEvents,
    assignableUsers,
    backendAssignableUsers,
    currentUser,
    eventMap,
    events,
    isInitialized,
    isLoading,
    loadError,
    loadedRange,
    statusUpdatingIds,
    initialize,
    loadForRange,
    reloadCurrentRange,
    reset,
    updateTodoStatusOptimistically,
  }
})
