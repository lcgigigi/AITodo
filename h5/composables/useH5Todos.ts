import { computed, ref, watch } from 'vue'
import type { CalendarEvent, CalendarUser } from '@/modules/home/dashboard/config/types'
import {
  compareEvents,
  dateRange,
  ymd,
} from '@/modules/home/dashboard/helpers/todoDisplay'
import {
  getTodoWeekRange,
  listTodos,
  loadAssignableUsers,
  loadTodoDetail,
  loadTodos,
} from '@/modules/home/dashboard/services/todo.service'
import { isUnauthorizedRequestError } from '@/shared/request/request-error'

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

export function useH5Todos(options: {
  currentUser: () => CalendarUser
  onUnauthorized?: () => void
}) {
  const selectedDate = ref(ymd(new Date()))
  const weekAnchorDate = ref(selectedDate.value)
  const allEvents = ref<CalendarEvent[]>([])
  const assignableUsers = ref<CalendarUser[]>([])
  const isLoading = ref(false)
  const loadError = ref('')
  const detailEvent = ref<CalendarEvent | null>(null)
  const isDetailLoading = ref(false)
  const detailError = ref('')
  const isDetailOpen = ref(false)

  const todayDate = computed(() => ymd(new Date()))

  const weekRange = computed(() => getTodoWeekRange(weekAnchorDate.value))

  const weekDates = computed(() => dateRange(weekRange.value.startDate, weekRange.value.endDate))

  const weekDays = computed(() =>
    weekDates.value.map((date, index) => {
      const value = new Date(`${date}T12:00:00`)
      const events = eventMap.value.get(date) ?? []
      const hasTask = events.some((event) => event.type !== 'meeting')
      const hasMeeting = events.some((event) => event.type === 'meeting')

      return {
        date,
        weekday: WEEKDAY_LABELS[index] ?? '',
        day: value.getDate(),
        isSelected: date === selectedDate.value,
        isToday: date === todayDate.value,
        hasTask,
        hasMeeting,
        eventCount: events.length,
      }
    }),
  )

  const weekLabel = computed(() => {
    const start = new Date(`${weekRange.value.startDate}T12:00:00`)
    const end = new Date(`${weekRange.value.endDate}T12:00:00`)
    const startMonth = start.getMonth() + 1
    const endMonth = end.getMonth() + 1

    if (startMonth === endMonth) {
      return `${startMonth}月 ${start.getDate()}日 - ${end.getDate()}日`
    }

    return `${startMonth}/${start.getDate()} - ${endMonth}/${end.getDate()}`
  })

  const scopedEvents = computed(() => listTodos(allEvents.value, options.currentUser()))

  const eventMap = computed(() => {
    const map = new Map<string, CalendarEvent[]>()

    for (const event of scopedEvents.value) {
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

  const selectedDayEvents = computed(() => eventMap.value.get(selectedDate.value) ?? [])

  async function refreshTodos() {
    isLoading.value = true
    loadError.value = ''

    try {
      const user = options.currentUser()
      const range = weekRange.value
      const [events, users] = await Promise.all([
        loadTodos(user, assignableUsers.value, range),
        assignableUsers.value.length ? Promise.resolve(assignableUsers.value) : loadAssignableUsers(),
      ])

      allEvents.value = events
      assignableUsers.value = users
    } catch (error) {
      if (isUnauthorizedRequestError(error)) {
        options.onUnauthorized?.()
        return
      }
      loadError.value = error instanceof Error ? error.message : '加载待办失败'
    } finally {
      isLoading.value = false
    }
  }

  function selectDate(date: string) {
    selectedDate.value = date
    weekAnchorDate.value = date
  }

  function shiftWeek(days: number) {
    const anchor = new Date(`${weekAnchorDate.value}T12:00:00`)
    anchor.setDate(anchor.getDate() + days)
    const nextDate = ymd(anchor)
    weekAnchorDate.value = nextDate
    selectedDate.value = nextDate
  }

  function goToday() {
    const today = ymd(new Date())
    selectedDate.value = today
    weekAnchorDate.value = today
  }

  async function openDetail(id: string) {
    isDetailOpen.value = true
    isDetailLoading.value = true
    detailError.value = ''
    detailEvent.value = null

    try {
      detailEvent.value = await loadTodoDetail(id, options.currentUser(), assignableUsers.value)
    } catch (error) {
      if (isUnauthorizedRequestError(error)) {
        options.onUnauthorized?.()
        closeDetail()
        return
      }
      detailError.value = error instanceof Error ? error.message : '加载详情失败'
    } finally {
      isDetailLoading.value = false
    }
  }

  function closeDetail() {
    isDetailOpen.value = false
    detailEvent.value = null
    detailError.value = ''
  }

  watch(
    weekRange,
    () => {
      void refreshTodos()
    },
    { immediate: true },
  )

  return {
    selectedDate,
    weekLabel,
    weekDays,
    selectedDayEvents,
    isLoading,
    loadError,
    detailEvent,
    isDetailLoading,
    detailError,
    isDetailOpen,
    refreshTodos,
    selectDate,
    shiftWeek,
    goToday,
    openDetail,
    closeDetail,
  }
}
