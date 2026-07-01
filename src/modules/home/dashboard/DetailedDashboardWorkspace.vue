<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import IconCheck from '~icons/lucide/check'
import IconChevronLeft from '~icons/lucide/chevron-left'
import IconChevronRight from '~icons/lucide/chevron-right'
import IconPlus from '~icons/lucide/plus'
import IconSendHorizontal from '~icons/lucide/send-horizontal'
import IconX from '~icons/lucide/x'
import { routeConfig } from '@/config/route.config'
import AppStateBlock from '@/shared/components/state/AppStateBlock.vue'
import { useFeedbackStore } from '@/stores/feedback.store'
import { useRouter } from 'vue-router'
import { dashboardTools, navigateDashboardTool, type DashboardTool, type DashboardToolTarget } from './dashboardTools'
import CalendarWeekTimeline from './components/CalendarWeekTimeline.vue'
import DashboardNotificationCenter from './components/DashboardNotificationCenter.vue'
import DayPreviewPanel from './DayPreviewPanel.vue'
import type { CalendarDay, CalendarEvent, CalendarTodoDraft } from './types'
import {
  compareEvents,
  formatEventTime,
  getEventScheduleDisplay,
  isAllDayEvent,
  isRangeEvent,
  ymd,
} from './todoDisplay'
import {
  createTodo as serviceCreateTodo,
  getTodoMonthRange,
  getTodoWeekRange,
  loadTodoDetail,
  updateTodoStatus as serviceUpdateTodoStatus,
} from './todo.service'
import { useDashboardTodos } from './useDashboardTodos'

type DayPreviewPanelExpose = {
  openCreateForm: () => void
  showDiscardWarning: (onConfirm?: () => void) => void
}

type DetailMode = 'simple' | 'detail'
type DetailStatusFilter = 'all' | 'done' | 'other'
type DetailTypeFilter = 'all' | 'task' | 'meeting'
type DetailTone = 'blue' | 'green' | 'orange' | 'violet' | 'cyan' | 'slate'

type StatusFilterItem = {
  value: DetailStatusFilter
  label: string
}

type TypeFilterItem = {
  value: Exclude<DetailTypeFilter, 'all'>
  label: string
}

type MonthDay = {
  key: string
  day: number
  inMonth: boolean
  isToday: boolean
  isSelected: boolean
  dots: DetailTone[]
}

const emit = defineEmits<{
  'switch-mode': [mode: DetailMode]
}>()

const router = useRouter()
const feedbackStore = useFeedbackStore()

const now = ref(new Date())
const todayDate = computed(() => ymd(now.value))
const currentMonth = ref(new Date(now.value.getFullYear(), now.value.getMonth(), 1))
const selectedDate = ref(todayDate.value)
const calendarViewMode = ref<'month' | 'week'>('month')
const showCalendarRangeSwitch = false
const taskDetails = ref<Record<string, CalendarEvent>>({})
const statusFilter = ref<DetailStatusFilter>('all')
const typeFilter = ref<DetailTypeFilter>('all')
const activeTaskId = ref('')
const detailLoadingId = ref('')
const quickCreateText = ref('')
const isCreateModalOpen = ref(false)
const isCreateFormDirty = ref(false)
const quickCreatePrompt = ref('')
const quickCreateKey = ref(0)
const dayPreviewPanelRef = ref<DayPreviewPanelExpose | null>(null)
const activeToolName = ref('')

function getActiveTodoLoadRange() {
  return calendarViewMode.value === 'week'
    ? getTodoWeekRange(selectedDate.value)
    : getTodoMonthRange(currentMonth.value)
}

const {
  assignableUsers,
  currentUser,
  eventMap,
  isLoading,
  loadError,
  refreshTodos: refreshDashboardTodos,
  initializeDashboardTodos,
} = useDashboardTodos({
  getLoadRange: getActiveTodoLoadRange,
  loadErrorFallback: '加载待办数据失败',
  onUnauthorized: redirectToLogin,
})

let hasInitializedTodoRange = false

const statusFilters: StatusFilterItem[] = [
  { value: 'all', label: '全部' },
  { value: 'done', label: '已完成' },
  { value: 'other', label: '其他' },
]

const typeFilters: TypeFilterItem[] = [
  { value: 'task', label: '待办' },
  { value: 'meeting', label: '会议' },
]

const selectedDateEvents = computed(() => eventMap.value.get(selectedDate.value) ?? [])
const pendingEvents = computed(() =>
  selectedDateEvents.value.filter((event) => event.status !== 'done' && !isRejectedEvent(event)),
)
const selectedDateLabel = computed(() => formatDateTitle(selectedDate.value))
const mainTitle = computed(() => (selectedDate.value === todayDate.value ? '今日待办' : '当日待办'))

const eventsForStatusCounts = computed(() =>
  selectedDateEvents.value.filter((event) => matchesTypeFilter(event, typeFilter.value)),
)

const statusFilterCounts = computed<Record<DetailStatusFilter, number>>(() => ({
  all: eventsForStatusCounts.value.length,
  done: eventsForStatusCounts.value.filter(isCompletedEvent).length,
  other: eventsForStatusCounts.value.filter(isOtherStatusEvent).length,
}))

const filteredTasks = computed(() =>
  selectedDateEvents.value.filter(
    (event) => matchesStatusFilter(event, statusFilter.value) && matchesTypeFilter(event, typeFilter.value),
  ),
)

const sortedFilteredTasks = computed(() => [...filteredTasks.value].sort(compareEvents))

const taskListSections = computed(() => {
  const allDay = sortedFilteredTasks.value.filter((event) => isAllDayEvent(event))
  const timed = sortedFilteredTasks.value.filter((event) => !isAllDayEvent(event))
  const sections: Array<{ key: string; label: string; timeline: boolean; tasks: CalendarEvent[] }> = []

  if (timed.length) {
    sections.push({ key: 'timed', label: '时间安排', timeline: true, tasks: timed })
  }
  if (allDay.length) {
    sections.push({ key: 'allday', label: '全天事项', timeline: false, tasks: allDay })
  }

  return sections
})

const hasActiveTaskFilters = computed(
  () => statusFilter.value !== 'all' || typeFilter.value !== 'all',
)

const isFilterEmpty = computed(
  () => hasActiveTaskFilters.value && !filteredTasks.value.length && !isLoading.value,
)

const emptyStateCopy = computed(() => {
  if (!selectedDateEvents.value.length) {
    return {
      title: '当前日期暂无待办',
      desc: '在下方输入框用一句话描述，即可快速创建待办。',
    }
  }
  if (statusFilter.value === 'done') {
    return {
      title: '暂无已完成事项',
      desc: '完成待办后会在这里展示记录。',
    }
  }
  if (statusFilter.value === 'other') {
    return {
      title: '暂无其他状态事项',
      desc: '当前筛选下没有待处理、已接受或已拒绝的待办。',
    }
  }
  if (typeFilter.value === 'meeting') {
    return {
      title: '暂无会议事项',
      desc: '当前日期没有会议安排，可切换筛选或创建新待办。',
    }
  }
  return {
    title: '当前筛选下暂无待办',
    desc: '试试切换状态或类型筛选，或清除筛选查看全部安排。',
  }
})
const taskEmptyActionLabel = computed(() => (isFilterEmpty.value ? '查看全部' : ''))

const monthDays = computed(() => buildMonthDays())
const weekCalendarDays = computed(() => buildWeekCalendarDays())
const calendarHeaderLabel = computed(() =>
  calendarViewMode.value === 'week'
    ? weekRangeLabel(selectedDate.value)
    : monthLabel(currentMonth.value),
)
const todoLoadRangeKey = computed(() => {
  const range = getActiveTodoLoadRange()
  return `${range.startDate}:${range.endDate}`
})
const trackEvents = computed(() =>
  selectedDateEvents.value.filter((event) => !isRejectedEvent(event)),
)
const doneCount = computed(
  () => trackEvents.value.filter((event) => event.status === 'done').length,
)
const totalCount = computed(() => trackEvents.value.length)
const pendingCount = computed(() => Math.max(totalCount.value - doneCount.value, 0))
const daySubject = computed(() => (selectedDate.value === todayDate.value ? '今日' : '当日'))

const leftSuggestionTitle = computed(() => {
  if (!totalCount.value) return '暂无待办安排'
  if (!pendingCount.value) return '按计划推进剩余任务'
  return '优先处理待办事项'
})

const leftSuggestionText = computed(() => {
  if (!totalCount.value) {
    return '当前日期暂无待办，可在中间栏快速创建新事项。'
  }

  if (!pendingCount.value) {
    return `${daySubject.value}待办已全部完成，可以复盘成果或安排新的事项。`
  }

  const nextTask = pendingEvents.value[0]
  if (!nextTask) {
    return `还有 ${pendingCount.value} 项待处理，建议按时间顺序继续推进。`
  }

  const remaining = Math.max(pendingCount.value - 1, 0)
  if (remaining) {
    return `当前最需要关注的是“${nextTask.title}”，建议先完成它，再处理其余 ${remaining} 项任务。`
  }

  return `当前最需要关注的是“${nextTask.title}”，完成后即可清空待处理事项。`
})

const activeTask = computed(
  () => selectedDateEvents.value.find((event) => event.id === activeTaskId.value) ?? null,
)
const isTaskDetailOpen = computed(() => Boolean(activeTaskId.value))

watch(todoLoadRangeKey, () => {
  if (!hasInitializedTodoRange) return
  void refreshTodos()
})

onMounted(() => {
  void initializeDetailData()
  window.addEventListener('keydown', onDetailWorkspaceKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onDetailWorkspaceKeydown)
})

function onDetailWorkspaceKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (isCreateModalOpen.value) {
    requestCloseCreateModal()
    return
  }
  if (isTaskDetailOpen.value) {
    closeTaskDetail()
  }
}

async function initializeDetailData() {
  const initialized = await initializeDashboardTodos()
  if (!initialized) return

  hasInitializedTodoRange = true
  taskDetails.value = {}
  ensureSelectedDateInLoadedRange()
}

function redirectToLogin() {
  void router.replace({
    path: routeConfig.loginRoute,
    query: { redirect: router.currentRoute.value.fullPath },
  })
}

function openDetailTool(tool: DashboardToolTarget) {
  void navigateDashboardTool(router, tool)
}

function handleToolClick(tool: DashboardTool) {
  activeToolName.value = tool.name
  openDetailTool(tool)
}

function notifyCustomizeQuick() {
  feedbackStore.info('快捷入口自定义已触发')
}

function notifyCustomizeTools() {
  feedbackStore.info('自定义工具入口已触发')
}

async function refreshTodos() {
  await refreshDashboardTodos()
  taskDetails.value = {}
  ensureSelectedDateInLoadedRange()
}

async function openTodoFromNotification(payload: { id: string; date?: string }) {
  let targetDate = payload.date

  if (!targetDate) {
    try {
      const detailEvent = await loadTodoDetail(payload.id, currentUser.value, assignableUsers.value)
      targetDate = detailEvent.date
    } catch {
      feedbackStore.error('查询消息关联待办失败')
      return
    }
  }

  closeTaskDetail()
  closeCreateModal()
  selectedDate.value = targetDate

  const nextDate = new Date(`${targetDate}T12:00:00`)
  currentMonth.value = new Date(nextDate.getFullYear(), nextDate.getMonth(), 1)
  resetTaskFilters()
  await refreshTodos()
  await nextTick()

  const targetTask = selectedDateEvents.value.find((event) => event.id === payload.id)
  if (targetTask) {
    await openTaskDetail(targetTask)
    return
  }

  feedbackStore.info('关联待办不在当前日期列表中')
}

defineExpose({
  refreshTodos,
  openTodoFromNotification,
})

function ensureSelectedDateInLoadedRange() {
  if (calendarViewMode.value === 'week') return
  const value = new Date(`${selectedDate.value}T12:00:00`)
  if (
    value.getFullYear() === currentMonth.value.getFullYear() &&
    value.getMonth() === currentMonth.value.getMonth()
  ) {
    return
  }

  const today = new Date(`${todayDate.value}T12:00:00`)
  if (
    today.getFullYear() === currentMonth.value.getFullYear() &&
    today.getMonth() === currentMonth.value.getMonth()
  ) {
    selectedDate.value = todayDate.value
    return
  }

  selectedDate.value = ymd(
    new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth(), 1),
  )
}

async function changeCalendarPeriod(delta: number) {
  if (calendarViewMode.value === 'week') {
    const next = new Date(`${selectedDate.value}T12:00:00`)
    next.setDate(next.getDate() + delta * 7)
    selectedDate.value = ymd(next)
    activeTaskId.value = ''
    resetTaskFilters()
    return
  }

  currentMonth.value = new Date(
    currentMonth.value.getFullYear(),
    currentMonth.value.getMonth() + delta,
    1,
  )
}

function setCalendarViewMode(mode: 'month' | 'week') {
  if (calendarViewMode.value === mode) return

  calendarViewMode.value = mode

  if (mode === 'month') {
    const nextDate = new Date(`${selectedDate.value}T12:00:00`)
    currentMonth.value = new Date(nextDate.getFullYear(), nextDate.getMonth(), 1)
  }
}

async function goToday() {
  now.value = new Date()
  selectedDate.value = todayDate.value
  currentMonth.value = new Date(now.value.getFullYear(), now.value.getMonth(), 1)
}

function selectCalendarDate(date: string) {
  selectedDate.value = date
  activeTaskId.value = ''
  resetTaskFilters()
}

function resetTaskFilters() {
  statusFilter.value = 'all'
  typeFilter.value = 'all'
}

function handleStatusFilterClick(nextFilter: DetailStatusFilter) {
  if (statusFilter.value === nextFilter && typeFilter.value !== 'all') {
    typeFilter.value = 'all'
    return
  }

  statusFilter.value = nextFilter
  typeFilter.value = 'all'
}

function handleTypeFilterClick(type: Exclude<DetailTypeFilter, 'all'>) {
  typeFilter.value = typeFilter.value === type ? 'all' : type
}

function getStatusPoolEvents(filter: DetailStatusFilter) {
  return selectedDateEvents.value.filter((event) => matchesStatusFilter(event, filter))
}

function getTypeCountForStatus(status: DetailStatusFilter, type: Exclude<DetailTypeFilter, 'all'>) {
  const pool = getStatusPoolEvents(status)
  if (type === 'meeting') return pool.filter((event) => event.type === 'meeting').length
  return pool.filter((event) => event.type !== 'meeting').length
}

async function openTaskDetail(task: CalendarEvent) {
  activeTaskId.value = task.id
  await loadTaskDetail(task)
}

function closeTaskDetail() {
  activeTaskId.value = ''
}

async function loadTaskDetail(task: CalendarEvent, force = false) {
  if (!currentUser.value.id || (!force && taskDetails.value[task.id])) return

  detailLoadingId.value = task.id
  try {
    const detail = await loadTodoDetail(task.id, currentUser.value, assignableUsers.value)
    taskDetails.value = {
      ...taskDetails.value,
      [task.id]: detail,
    }
  } catch {
    feedbackStore.error('查询待办详情失败')
  } finally {
    detailLoadingId.value = ''
  }
}

async function toggleTaskStatus(task: CalendarEvent) {
  if (task.completable === false) {
    feedbackStore.info('当前待办不可由你完成')
    return
  }

  try {
    const nextStatus = task.status === 'done' ? 'todo' : 'done'
    await serviceUpdateTodoStatus(task.id, currentUser.value, nextStatus, assignableUsers.value)
    await refreshTodos()
    if (activeTaskId.value === task.id) {
      const updatedTask = selectedDateEvents.value.find((event) => event.id === task.id)
      if (updatedTask) {
        await loadTaskDetail(updatedTask, true)
      }
    }
    feedbackStore.success(nextStatus === 'done' ? '已标记完成' : '已撤销完成')
  } catch {
    // 全局拦截器已统一提示错误。
  }
}

function openCreateModal(prefill = quickCreateText.value.trim()) {
  if (!currentUser.value.id) return

  closeTaskDetail()
  quickCreatePrompt.value = prefill
  quickCreateKey.value += 1
  isCreateFormDirty.value = false
  isCreateModalOpen.value = true
}

function closeCreateModal() {
  isCreateModalOpen.value = false
  isCreateFormDirty.value = false
  quickCreatePrompt.value = ''
}

function requestCloseCreateModal(onConfirm?: () => void) {
  const close = () => {
    closeCreateModal()
    onConfirm?.()
  }

  if (!isCreateFormDirty.value) {
    close()
    return
  }

  dayPreviewPanelRef.value?.showDiscardWarning(close)
}

function submitQuickCreate() {
  const prompt = quickCreateText.value.trim()
  if (!prompt) return

  openCreateModal(prompt)
}

async function handleCreateTodo(payload: CalendarTodoDraft) {
  try {
    await serviceCreateTodo(payload)
    if (payload.date) {
      const parsedDate = new Date(`${payload.date}T12:00:00`)
      currentMonth.value = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1)
      selectedDate.value = payload.date
    }
    quickCreateText.value = ''
    closeCreateModal()
    await refreshTodos()
    feedbackStore.success('待办已创建')
  } catch {
    // 全局拦截器已统一提示错误。
  }
}

function notifyFromPreview(message: string, type: 'success' | 'error' | 'info' = 'info') {
  if (type === 'success') {
    feedbackStore.success(message)
    return
  }
  if (type === 'error') {
    feedbackStore.error(message)
    return
  }
  feedbackStore.info(message)
}

async function toggleDetailTaskStatus() {
  const task = activeTask.value
  if (!task) return
  await toggleTaskStatus(task)
  if (activeTaskId.value) {
    await loadTaskDetail(task, true)
  }
}

function formatTaskDetailTime(task: CalendarEvent) {
  const detail = getTaskDetail(task)
  const dateLabel = formatDateTitle(detail.date).split(' ').slice(0, 3).join(' ')
  const timeLabel = formatEventTime(detail)
  return timeLabel === '全天' ? `${dateLabel} 全天` : `${dateLabel} ${timeLabel}`
}

function getTaskStatusLabel(task: CalendarEvent) {
  if (task.backendStatus === 6 || task.status === 'done') return '已完成'
  if (task.backendStatus === 9) return '已拒绝'
  if (task.backendStatus === 3) return '已接受'
  return '待处理'
}

function isCompletedEvent(event: CalendarEvent) {
  return event.backendStatus === 6 || event.status === 'done'
}

function isOtherStatusEvent(event: CalendarEvent) {
  return !isCompletedEvent(event)
}

function matchesStatusFilter(event: CalendarEvent, filter: DetailStatusFilter) {
  if (filter === 'all') return true
  if (filter === 'done') return isCompletedEvent(event)
  return isOtherStatusEvent(event)
}

function matchesTypeFilter(event: CalendarEvent, filter: DetailTypeFilter) {
  if (filter === 'all') return true
  if (filter === 'meeting') return event.type === 'meeting'
  return event.type !== 'meeting'
}

function buildWeekCalendarDays(): CalendarDay[] {
  const start = new Date(`${selectedDate.value}T12:00:00`)
  const offset = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - offset)

  return Array.from({ length: 7 }, () => {
    const date = ymd(start)
    const result: CalendarDay = {
      date,
      day: start.getDate(),
      inMonth:
        start.getFullYear() === currentMonth.value.getFullYear() &&
        start.getMonth() === currentMonth.value.getMonth(),
      inActiveWeek: true,
      isToday: date === todayDate.value,
      specialDays: [],
      events: eventMap.value.get(date) ?? [],
    }
    start.setDate(start.getDate() + 1)
    return result
  })
}

function buildMonthDays(): MonthDay[] {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const cursor = new Date(year, month, 1 - offset)

  return Array.from({ length: 42 }, () => {
    const key = ymd(cursor)
    const dayEvents = eventMap.value.get(key) ?? []
    const result = {
      key,
      day: cursor.getDate(),
      inMonth: cursor.getFullYear() === year && cursor.getMonth() === month,
      isToday: key === todayDate.value,
      isSelected: key === selectedDate.value,
      dots: getDayDots(dayEvents),
    }
    cursor.setDate(cursor.getDate() + 1)
    return result
  })
}

function getDayDots(dayEvents: CalendarEvent[]): DetailTone[] {
  const tones: DetailTone[] = []

  for (const event of dayEvents) {
    const tone = getTaskTone(event)
    if (!tones.includes(tone)) tones.push(tone)
    if (tones.length >= 3) break
  }

  return tones
}

function getTaskDetail(task: CalendarEvent) {
  return taskDetails.value[task.id] ?? task
}

function isRejectedEvent(event: CalendarEvent) {
  return event.backendStatus === 9
}

function getTaskTone(event: CalendarEvent): DetailTone {
  if (event.type === 'meeting') return 'blue'
  if (event.type === 'approval') return 'green'
  if (event.type === 'ai') return 'cyan'
  if (event.status === 'done') return 'green'
  if (isRejectedEvent(event)) return 'slate'
  return 'violet'
}

function getTaskTypeLabel(event: CalendarEvent) {
  if (event.type === 'meeting') return '会议'
  if (event.type === 'approval') return '审批'
  if (event.type === 'ai') return 'AI'
  return '待办'
}

function getProjectText(event: CalendarEvent) {
  const detail = getTaskDetail(event)
  return detail.source || detail.remark || detail.content || '暂无来源说明'
}

function getAssigneeText(event: CalendarEvent) {
  const detail = getTaskDetail(event)
  return detail.assigneeName || detail.owner || '未指定'
}

function getDescriptionText(event: CalendarEvent) {
  const detail = getTaskDetail(event)
  return detail.content || detail.remark || detail.source || '暂无描述'
}

function formatDateTitle(date: string) {
  const value = new Date(`${date}T12:00:00`)
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][value.getDay()]
  return `${value.getFullYear()} 年 ${value.getMonth() + 1} 月 ${value.getDate()} 日 ${weekday}`
}

function formatTaskRangeStart(event: CalendarEvent) {
  const display = getEventScheduleDisplay(event)
  if (display.kind !== 'range') return ''
  return `${display.start.date}${display.start.time ? ` ${display.start.time}` : ''}`
}

function formatTaskRangeEnd(event: CalendarEvent) {
  const display = getEventScheduleDisplay(event)
  if (display.kind !== 'range') return ''
  return `${display.end.date}${display.end.time ? ` ${display.end.time}` : ''}`
}

function monthLabel(date: Date) {
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`
}

function weekRangeLabel(anchorDate: string) {
  const range = getTodoWeekRange(anchorDate)
  const start = new Date(`${range.startDate}T12:00:00`)
  const end = new Date(`${range.endDate}T12:00:00`)
  const startLabel = `${start.getMonth() + 1}月${start.getDate()}日`
  const endLabel = `${end.getMonth() + 1}月${end.getDate()}日`

  return `${start.getFullYear()} 年 ${startLabel} - ${endLabel}`
}
</script>

<template>
  <section class="detail-workspace" aria-label="首页详细模式">
    <section class="detail-board" aria-label="首页详细模式工作区">
      <aside class="detail-left-panel" aria-label="快捷入口">
      <section class="side-card">
        <div class="panel-title">
          <h2>快捷入口</h2>
          <button class="panel-mini-btn" type="button" @click="notifyCustomizeQuick">自定义</button>
        </div>

        <div class="tool-list">
          <button
            v-for="tool in dashboardTools"
            :key="tool.name"
            type="button"
            class="tool-item"
            :class="{ active: activeToolName === tool.name }"
            @click="handleToolClick(tool)"
          >
            <span class="tool-icon" :class="tool.tone" aria-hidden="true">
              <component :is="tool.icon" />
            </span>
            <span class="tool-name">{{ tool.name }}</span>
          </button>
        </div>
      </section>

      <section class="side-card">
        <div class="panel-title">
          <h2>AI 提醒</h2>
          <small>建议</small>
        </div>
        <div class="side-note">
          <h3>{{ leftSuggestionTitle }}</h3>
          <p>{{ leftSuggestionText }}</p>
        </div>
      </section>

      <div class="customize">
        <button type="button" @click="notifyCustomizeTools">⇄　自定义工具</button>
      </div>
      </aside>

      <main class="detail-main-panel" aria-label="当日待办清单">
        <div class="detail-main-body side-content-card">
          <header class="detail-main-header">
            <div class="todo-title-row">
              <h1>{{ mainTitle }}</h1>
              <div class="todo-date">{{ selectedDateLabel }}</div>
            </div>
          </header>

          <div class="filter-stack" aria-label="待办筛选">
            <div class="filter-flow" role="tablist" aria-label="状态与类型筛选">
              <div
                v-for="filter in statusFilters"
                :key="filter.value"
                class="primary-filter-item"
                :class="{ active: statusFilter === filter.value }"
              >
                <button
                  type="button"
                  class="filter"
                  role="tab"
                  :class="{ active: statusFilter === filter.value }"
                  :aria-selected="statusFilter === filter.value"
                  @click="handleStatusFilterClick(filter.value)"
                >
                  {{ filter.label }}
                  <span class="filter-count">{{ statusFilterCounts[filter.value] }}</span>
                </button>
                <div class="inline-type-filters" aria-label="类型筛选">
                  <button
                    v-for="typeItem in typeFilters"
                    :key="typeItem.value"
                    type="button"
                    class="type-filter"
                    :class="{
                      active: statusFilter === filter.value && typeFilter === typeItem.value,
                    }"
                    :aria-pressed="statusFilter === filter.value && typeFilter === typeItem.value"
                    :tabindex="statusFilter === filter.value ? 0 : -1"
                    @click="handleTypeFilterClick(typeItem.value)"
                  >
                    {{ typeItem.label }}
                    <span class="type-count">{{
                      getTypeCountForStatus(filter.value, typeItem.value)
                    }}</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="filter-result">
              <span class="filter-result-text">
                当前显示 <strong>{{ filteredTasks.length }}</strong> 项
              </span>
            </div>
          </div>

          <AppStateBlock
            v-if="loadError"
            class="detail-main-state"
            type="error"
            title="待办数据加载失败"
            :description="loadError"
            action-label="重新加载"
            @action="refreshTodos"
          />
          <AppStateBlock
            v-else-if="isLoading"
            class="detail-main-state"
            type="loading"
            title="正在加载真实待办数据"
            description="待办、日程和协作人信息同步后会自动展示。"
          />

          <div class="task-list" aria-label="待办列表">
            <AppStateBlock
              v-if="!isLoading && !loadError && !filteredTasks.length"
              class="task-empty-state"
              type="empty"
              :title="emptyStateCopy.title"
              :description="emptyStateCopy.desc"
              :action-label="taskEmptyActionLabel"
              size="sm"
              variant="inline"
              @action="resetTaskFilters()"
            />

            <template v-else-if="!isLoading && !loadError">
              <section
                v-for="section in taskListSections"
                :key="section.key"
                class="agenda-section"
              >
                <div class="section-kicker">{{ section.label }}</div>
                <div :class="section.timeline ? 'timeline-list' : 'all-day-wrap'">
                  <article
                    v-for="task in section.tasks"
                    :key="task.id"
                    class="task-card"
                    :class="{
                      selected: activeTaskId === task.id,
                      completed: task.status === 'done',
                      allday: !section.timeline,
                    }"
                    @click="openTaskDetail(task)"
                  >
                    <div class="check-wrap" @click.stop>
                      <button
                        type="button"
                        class="task-check"
                        :class="{ checked: task.status === 'done' }"
                        :aria-label="task.status === 'done' ? '撤销完成' : '标记完成'"
                        :disabled="task.completable === false"
                        @click="toggleTaskStatus(task)"
                      >
                        <IconCheck v-if="task.status === 'done'" aria-hidden="true" />
                      </button>
                    </div>

                    <div class="task-time-wrap">
                      <div v-if="isRangeEvent(task)" class="task-time is-range">
                        <span class="task-time-range-line">{{ formatTaskRangeStart(task) }}</span>
                        <span class="task-time-range-line task-time-range-end">{{
                          formatTaskRangeEnd(task)
                        }}</span>
                      </div>
                      <div v-else class="task-time">{{ formatEventTime(task) }}</div>
                      <div class="task-time-sub">
                        {{ section.timeline ? '时间节点' : '全天事项' }}
                      </div>
                    </div>

                    <div class="task-main">
                      <div class="task-line">
                        <div class="task-name">{{ task.title }}</div>
                        <span
                          class="task-tag"
                          :class="task.type === 'meeting' ? 'meeting' : 'todo'"
                        >
                          {{ getTaskTypeLabel(task) }}
                        </span>
                      </div>
                      <div class="task-sub">来源：{{ getProjectText(task) }}</div>
                    </div>

                    <div class="task-aside">
                      <div class="task-status" :class="{ done: task.status === 'done' }">
                        {{ getTaskStatusLabel(task) }}
                      </div>
                      <div class="task-arrow" aria-hidden="true">›</div>
                    </div>
                  </article>
                </div>
              </section>
            </template>
          </div>

          <div
            class="task-detail-overlay"
            :class="{ open: isTaskDetailOpen }"
            aria-hidden="true"
            @click="closeTaskDetail"
          ></div>

          <aside
            class="task-detail-drawer"
            :class="{ open: isTaskDetailOpen }"
            :aria-hidden="!isTaskDetailOpen"
            aria-label="任务详情"
          >
            <template v-if="activeTask">
              <div class="drawer-head">
                <span class="drawer-kicker">任务详情</span>
                <button type="button" class="drawer-close-btn" aria-label="关闭详情" @click="closeTaskDetail">
                  <IconX aria-hidden="true" />
                </button>
              </div>

              <h3 class="drawer-title">{{ getTaskDetail(activeTask).title }}</h3>

              <div class="drawer-tags">
                <span
                  class="task-tag"
                  :class="activeTask.type === 'meeting' ? 'meeting' : 'todo'"
                >
                  {{ getTaskTypeLabel(activeTask) }}
                </span>
              </div>

              <p v-if="detailLoadingId === activeTask.id" class="detail-loading">正在加载详情...</p>
              <div v-else class="drawer-grid">
                <div class="drawer-row">
                  <span>时间</span>
                  <strong>{{ formatTaskDetailTime(activeTask) }}</strong>
                </div>
                <div class="drawer-row">
                  <span>状态</span>
                  <strong>{{ getTaskStatusLabel(activeTask) }}</strong>
                </div>
                <div class="drawer-row">
                  <span>来源</span>
                  <strong>{{ getProjectText(activeTask) }}</strong>
                </div>
                <div class="drawer-row">
                  <span>负责人</span>
                  <strong>{{ getAssigneeText(activeTask) }}</strong>
                </div>
              </div>

              <div class="drawer-note">{{ getDescriptionText(activeTask) }}</div>

              <div class="drawer-actions">
                <button
                  type="button"
                  class="drawer-action primary"
                  :disabled="activeTask.completable === false"
                  @click="toggleDetailTaskStatus"
                >
                  {{ activeTask.status === 'done' ? '恢复待处理' : '标记完成' }}
                </button>
              </div>
            </template>
          </aside>
        </div>

        <form class="quick-create side-content-card" @submit.prevent="submitQuickCreate">
          <button
            type="button"
            class="quick-create-plus"
            aria-label="新增待办"
            @click="openCreateModal()"
          >
            <IconPlus aria-hidden="true" />
          </button>
          <input
            v-model="quickCreateText"
            type="text"
            autocomplete="off"
            aria-label="一句话新增待办"
            placeholder="记录一个新事项，按 Enter 快速创建"
          />
          <button
            type="submit"
            :disabled="!quickCreateText.trim()"
            aria-label="打开新建待办卡片"
          >
            <IconSendHorizontal aria-hidden="true" />
          </button>
        </form>
      </main>

      <aside class="detail-side-panel" aria-label="消息通知和日历">
        <section class="notification-card side-content-card" aria-label="消息通知">
          <DashboardNotificationCenter
            layout="embedded"
            @calendar-refresh="refreshTodos()"
            @open-todo="openTodoFromNotification"
          />
        </section>

        <section
          class="calendar-card side-content-card"
          :class="{ 'is-week-mode': calendarViewMode === 'week' }"
          :aria-label="calendarViewMode === 'week' ? '周历' : '月历'"
        >
          <header class="calendar-header-mock">
            <div class="calendar-month-group">
              <button
                type="button"
                :aria-label="calendarViewMode === 'week' ? '上一周' : '上个月'"
                @click="changeCalendarPeriod(-1)"
                class="month-nav-btn"
              >
                <IconChevronLeft aria-hidden="true" />
              </button>
              <button
                type="button"
                :aria-label="calendarViewMode === 'week' ? '下一周' : '下个月'"
                @click="changeCalendarPeriod(1)"
                class="month-nav-btn"
              >
                <IconChevronRight aria-hidden="true" />
              </button>
            </div>
            <div class="calendar-header-actions">
              <div
                v-if="showCalendarRangeSwitch"
                class="calendar-range-segment"
                role="group"
                aria-label="日历范围"
              >
                <button
                  type="button"
                  :class="{ active: calendarViewMode === 'month' }"
                  :aria-pressed="calendarViewMode === 'month'"
                  @click="setCalendarViewMode('month')"
                >
                  月
                </button>
                <button
                  type="button"
                  :class="{ active: calendarViewMode === 'week' }"
                  :aria-pressed="calendarViewMode === 'week'"
                  @click="setCalendarViewMode('week')"
                >
                  周
                </button>
              </div>
              <button type="button" class="compact-mode-btn" @click="emit('switch-mode', 'simple')">
                缩略模式
              </button>
              <div class="calendar-action-group">
                <button type="button" class="today-chip" @click="goToday">今天</button>
              </div>
            </div>
          </header>

          <div class="calendar-placeholder-wrapper">
            <CalendarWeekTimeline
              v-if="calendarViewMode === 'week'"
              :days="weekCalendarDays"
              :selected-date="selectedDate"
              @select="selectCalendarDate"
            />
            <div v-else class="calendar-grid" :aria-label="`${calendarHeaderLabel}日历`">
              <span
                v-for="week in ['一', '二', '三', '四', '五', '六', '日']"
                :key="week"
                class="week-label"
              >
                {{ week }}
              </span>
              <button
                v-for="day in monthDays"
                :key="day.key"
                type="button"
                class="month-day"
                :class="{ muted: !day.inMonth, today: day.isToday, selected: day.isSelected }"
                @click="selectCalendarDate(day.key)"
              >
                <strong>{{ day.day }}</strong>
                <span class="day-dots" aria-hidden="true">
                  <i v-for="dot in day.dots" :key="`${day.key}-${dot}`" :class="`dot-${dot}`"></i>
                </span>
              </button>
            </div>
          </div>
        </section>
      </aside>
    </section>
  </section>

  <Teleport to="body">
    <Transition name="detail-create-modal">
      <div
        v-if="isCreateModalOpen"
        class="detail-create-modal"
        role="presentation"
        @click.self="requestCloseCreateModal()"
      >
        <div
          class="detail-create-card"
          role="dialog"
          aria-modal="true"
          aria-label="新增待办"
          @click.stop
        >
          <DayPreviewPanel
            ref="dayPreviewPanelRef"
            :key="quickCreateKey"
            form-only
            show-close
            :date="selectedDate"
            :date-label="selectedDateLabel"
            :events="[]"
            :special-days="[]"
            :current-user="currentUser"
            :assignable-users="assignableUsers"
            :quick-create-prompt="quickCreatePrompt"
            :quick-create-key="quickCreateKey"
            @create-todo="handleCreateTodo"
            @dirty-change="isCreateFormDirty = $event"
            @notify="notifyFromPreview"
            @close="requestCloseCreateModal()"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
<style scoped>
.detail-workspace {
  --detail-ink: #142142;
  --detail-muted: #60708d;
  --detail-blue: #2f7cff;
  --home-glass-border: rgba(255, 255, 255, 0.66);
  --home-glass-bg: linear-gradient(145deg, rgba(255, 255, 255, 0.5), rgba(242, 248, 255, 0.34)),
    rgba(248, 252, 255, 0.4);
  --home-glass-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78),
    0 16px 36px -32px rgba(8, 30, 64, 0.34);
  --home-glass-blur: blur(22px) saturate(1.12);
  --home-glass-radius: 20px;
  --content-card-bg: linear-gradient(145deg, rgba(255, 255, 255, 0.48), rgba(241, 245, 249, 0.32));
  --content-card-border: rgba(255, 255, 255, 0.58);
  --content-card-shadow: 0 10px 28px -22px rgba(15, 23, 42, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.52);
  --content-card-blur: blur(20px) saturate(1.14);
  position: relative;
  isolation: isolate;
  width: calc(100% - clamp(48px, 3.8vw, 76px));
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  margin: 0 auto;
  padding: clamp(8px, 1vw, 16px) 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  color: var(--detail-ink);
  overflow: hidden;
}

.glass-panel {
  border: 1px solid var(--home-glass-border);
  border-radius: var(--home-glass-radius);
  background: var(--home-glass-bg);
  box-shadow: var(--home-glass-shadow);
  backdrop-filter: var(--home-glass-blur);
  -webkit-backdrop-filter: var(--home-glass-blur);
}

.detail-board {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(300px, 328px) minmax(0, 1fr) minmax(444px, 472px);
  gap: 0;
  overflow: hidden;
  border: 1px solid var(--home-glass-border);
  border-radius: 28px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.38), rgba(242, 248, 255, 0.24)),
    rgba(248, 252, 255, 0.32);
  box-shadow: var(--home-glass-shadow);
  backdrop-filter: blur(25px) saturate(1.16);
  -webkit-backdrop-filter: blur(25px) saturate(1.16);
}

.detail-main-panel {
  display: flex;
  flex-direction: column;
  padding: 9px;
  min-height: 0;
  min-width: 0;
  box-sizing: border-box;
  background: transparent;
}

.detail-main-body {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 20px 22px 18px;
  box-sizing: border-box;
  overflow: hidden;
}

.detail-left-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  padding: 8px 4px 8px 8px;
  overflow-y: auto;
  gap: 14px;
  box-sizing: border-box;
  background: transparent;
  scrollbar-width: thin;
}

.detail-left-panel::-webkit-scrollbar {
  width: 6px;
}

.detail-left-panel::-webkit-scrollbar-thumb {
  background: rgba(81, 120, 173, 0.16);
  border-radius: 10px;
}

.side-card {
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.44);
  border: 1px solid rgba(255, 255, 255, 0.64);
  padding: 16px;
}

.panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.panel-title h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #14213d;
}

.panel-title small {
  color: #8795aa;
  font-size: 12px;
  font-weight: 600;
}

.panel-mini-btn {
  height: 30px;
  padding: 0 10px;
  border-radius: 10px;
  border: 0;
  color: #52627b;
  background: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
}

.panel-mini-btn:hover {
  background: rgba(255, 255, 255, 0.86);
}

.tool-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.tool-item {
  width: 100%;
  min-height: 88px;
  padding: 12px 10px;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 10px;
  border-radius: 18px;
  color: #14213d;
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.7);
  cursor: pointer;
  text-align: center;
  font: inherit;
  transition: 0.2s ease;
}

.tool-item:hover,
.tool-item.active {
  background: rgba(255, 255, 255, 0.92);
  border-color: rgba(76, 133, 235, 0.18);
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(43, 82, 132, 0.08);
}

.tool-icon {
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 13px;
  background: rgba(52, 120, 246, 0.08);
  color: #3478f6;
}

.tool-icon svg {
  width: 18px;
  height: 18px;
}

.tool-name {
  font-size: 14px;
  font-weight: 650;
  line-height: 1.2;
}

.side-note {
  margin-top: 10px;
  padding: 14px;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(52, 120, 246, 0.06), rgba(52, 120, 246, 0.03));
  border: 1px solid rgba(52, 120, 246, 0.08);
}

.side-note h3 {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 700;
  color: #14213d;
}

.side-note p {
  margin: 0;
  color: #52627b;
  font-size: 12px;
  line-height: 1.7;
}

.customize {
  margin-top: auto;
  padding: 0 2px 2px;
}

.customize button {
  width: 100%;
  height: 42px;
  border-radius: 13px;
  color: #52627b;
  background: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  border: 1px dashed rgba(108, 137, 174, 0.25);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
}

.customize button:hover {
  background: rgba(255, 255, 255, 0.72);
  border-color: rgba(108, 137, 174, 0.36);
}

.detail-main-header {
  flex: 0 0 auto;
  margin-bottom: 0;
}

.detail-main-state {
  margin: -2px 0 20px;
}

.todo-title-row {
  display: flex;
  align-items: baseline;
  gap: 18px;
}

.detail-main-header h1 {
  margin: 0;
  color: #101936;
  font-size: 26px;
  font-weight: 900;
  line-height: 1.2;
  letter-spacing: -0.4px;
}

.todo-date {
  color: #60718b;
  font-size: 16px;
  font-weight: 650;
  white-space: nowrap;
}

.filter-stack {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 18px;
  min-width: 0;
  min-height: 54px;
  padding: 7px 10px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.36);
  border: 1px solid rgba(255, 255, 255, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.filter-flow {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
}

.filter-flow::-webkit-scrollbar {
  display: none;
}

.primary-filter-item {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px;
  border-radius: 14px;
  transition:
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.primary-filter-item.active {
  background: rgba(229, 236, 246, 0.82);
  box-shadow: inset 0 0 0 1px rgba(201, 214, 231, 0.72);
}

.filter {
  position: relative;
  height: 36px;
  padding: 0 15px;
  border-radius: 11px;
  border: 0;
  color: #607089;
  background: transparent;
  cursor: pointer;
  transition: 0.2s ease;
  white-space: nowrap;
  font: inherit;
  font-size: 12px;
  font-weight: 750;
}

.filter:hover {
  color: #14213d;
  background: rgba(255, 255, 255, 0.62);
}

.filter.active {
  color: #204f91;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 6px 14px rgba(49, 76, 115, 0.11);
}

.filter-count,
.type-count {
  margin-left: 4px;
  color: inherit;
  opacity: 0.68;
  font-size: 11px;
  font-weight: 750;
  font-style: normal;
}

.inline-type-filters {
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 0;
  opacity: 0;
  overflow: hidden;
  transform: translateX(-5px);
  pointer-events: none;
  transition:
    max-width 0.26s cubic-bezier(0.22, 0.88, 0.24, 1),
    opacity 0.18s ease,
    transform 0.22s ease;
}

.primary-filter-item.active .inline-type-filters {
  max-width: 180px;
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
}

.primary-filter-item.active .inline-type-filters::before {
  content: '';
  width: 1px;
  height: 20px;
  margin: 0 2px;
  background: rgba(118, 143, 178, 0.22);
}

.type-filter {
  height: 32px;
  min-width: 58px;
  padding: 0 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border-radius: 10px;
  border: 1px solid transparent;
  color: #718097;
  background: transparent;
  cursor: pointer;
  transition: 0.2s ease;
  white-space: nowrap;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
}

.type-filter:hover {
  color: #314f79;
  background: rgba(255, 255, 255, 0.62);
}

.type-filter.active {
  color: #245797;
  background: rgba(255, 255, 255, 0.86);
  border-color: rgba(70, 124, 204, 0.18);
  box-shadow: 0 4px 10px rgba(49, 76, 115, 0.07);
}

.type-filter.active::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #3478f6;
  box-shadow: 0 0 0 3px rgba(52, 120, 246, 0.08);
}

.filter-result {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding: 0 5px 0 10px;
  border-left: 1px solid rgba(125, 151, 188, 0.14);
}

.filter-result-text {
  color: #8795aa;
  font-size: 12px;
  white-space: nowrap;
}

.filter-result-text strong {
  margin: 0 2px;
  color: #14213d;
  font-size: 13px;
  font-weight: 750;
}

.filter:focus-visible,
.type-filter:focus-visible {
  outline: 2px solid rgba(47, 124, 255, 0.55);
  outline-offset: 1px;
}

.task-list {
  position: relative;
  flex: 1;
  min-height: 0;
  margin-top: 18px;
  padding: 0 8px 8px 0;
  overflow-y: auto;
  scrollbar-color: rgba(81, 120, 173, 0.18) transparent;
  scrollbar-width: thin;
}

.task-list::-webkit-scrollbar {
  width: 6px;
}

.task-list::-webkit-scrollbar-thumb {
  background: rgba(81, 120, 173, 0.16);
  border-radius: 10px;
}

.task-empty-state {
  flex: 1;
  min-height: 168px;
}

.agenda-section {
  position: relative;
}

.agenda-section + .agenda-section {
  margin-top: 18px;
}

.section-kicker {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px 10px;
  color: #6b7c94;
  font-size: 14px;
  font-weight: 750;
  letter-spacing: 0.4px;
}

.section-kicker::before {
  content: '';
  width: 16px;
  height: 1px;
  background: rgba(103, 127, 161, 0.36);
}

.all-day-wrap {
  padding: 0 4px;
}

.timeline-list {
  position: relative;
  padding-left: 2px;
}

.task-card {
  position: relative;
  display: grid;
  grid-template-columns: 32px 112px minmax(0, 1fr) 96px;
  gap: 14px;
  align-items: center;
  min-height: 94px;
  margin: 0;
  padding: 13px 16px 13px 12px;
  border-radius: 18px;
  background: transparent;
  border: 0;
  box-shadow: none;
  cursor: pointer;
  transition:
    background 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.task-card + .task-card {
  margin-top: 2px;
}

.task-card:hover {
  transform: translateX(3px);
  background: linear-gradient(
    90deg,
    rgba(52, 120, 246, 0.12),
    rgba(52, 120, 246, 0.065) 36%,
    rgba(255, 255, 255, 0.4) 72%,
    rgba(255, 255, 255, 0.14) 100%
  );
}

.task-card.selected {
  transform: translateX(3px);
  background: linear-gradient(
    90deg,
    rgba(52, 120, 246, 0.16),
    rgba(52, 120, 246, 0.085) 38%,
    rgba(255, 255, 255, 0.44) 74%,
    rgba(255, 255, 255, 0.16) 100%
  );
}

.task-card.allday {
  min-height: 100px;
}

.task-card.allday:hover {
  transform: translateY(-1px);
  background:
    radial-gradient(circle at 87% 50%, rgba(52, 120, 246, 0.13), transparent 36%),
    linear-gradient(
      90deg,
      rgba(52, 120, 246, 0.1),
      rgba(52, 120, 246, 0.05) 34%,
      rgba(247, 250, 255, 0.98) 66%,
      rgba(255, 255, 255, 0.84) 100%
    );
  box-shadow: 0 14px 30px rgba(54, 86, 128, 0.09);
}

.task-card.allday.selected {
  transform: translateY(-1px);
  background:
    radial-gradient(circle at 87% 50%, rgba(52, 120, 246, 0.15), transparent 38%),
    linear-gradient(
      90deg,
      rgba(52, 120, 246, 0.13),
      rgba(52, 120, 246, 0.06) 36%,
      rgba(248, 251, 255, 0.99) 68%,
      rgba(255, 255, 255, 0.88) 100%
    );
  box-shadow: 0 14px 30px rgba(54, 86, 128, 0.09);
}

.check-wrap {
  display: grid;
  place-items: center;
  position: relative;
  z-index: 2;
}

.task-check {
  width: 21px;
  height: 21px;
  border: 2px solid #c6d2e2;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.96);
  color: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
  position: relative;
  box-shadow: 0 2px 7px rgba(62, 91, 128, 0.06);
  flex-shrink: 0;
}

.task-check.checked {
  border-color: #3478f6;
  background: #3478f6;
}

.task-check:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.task-check svg {
  width: 14px;
  height: 14px;
}

.task-time-wrap {
  position: relative;
  display: grid;
  gap: 7px;
  align-content: center;
  min-width: 0;
  min-height: 56px;
  padding-left: 18px;
  overflow: hidden;
}

.task-time-wrap::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 50%;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid #aac4ef;
  box-shadow: 0 0 0 4px rgba(52, 120, 246, 0.05);
  transform: translateY(-50%);
  z-index: 2;
}

.task-card.allday .task-time-wrap::before {
  background: #3478f6;
  box-shadow: 0 0 0 5px rgba(52, 120, 246, 0.08);
}

.task-time {
  font-size: 18px;
  font-weight: 780;
  letter-spacing: -0.25px;
  white-space: nowrap;
  line-height: 1;
  color: #101936;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-time.is-range {
  display: grid;
  gap: 4px;
  font-size: 15px;
  letter-spacing: -0.18px;
  line-height: 1.15;
  white-space: normal;
}

.task-time-range-line {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-time-range-end {
  color: #5a6b84;
  font-weight: 720;
}

.task-time-sub {
  color: #8795aa;
  font-size: 11px;
  font-weight: 650;
}

.task-main {
  min-width: 0;
  padding: 4px 0;
}

.task-line {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  flex-wrap: wrap;
}

.task-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 17px;
  font-weight: 760;
  letter-spacing: -0.22px;
  color: #101936;
}

.task-sub {
  margin-top: 7px;
  color: #8795aa;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-tag {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 9px;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  color: #5c6d84;
  background: rgba(231, 237, 245, 0.84);
}

.task-aside {
  display: grid;
  justify-items: end;
  gap: 11px;
}

.task-status {
  min-width: 72px;
  height: 29px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 11px;
  border-radius: 999px;
  color: #386fd0;
  background: rgba(52, 120, 246, 0.08);
  font-size: 12px;
  font-weight: 750;
}

.task-status.done {
  color: #526f7f;
  background: rgba(217, 226, 235, 0.74);
}

.task-arrow {
  color: #a4b2c4;
  font-size: 18px;
  line-height: 1;
  transition: transform 0.2s ease;
}

.task-card:hover .task-arrow,
.task-card.selected .task-arrow {
  transform: translateX(3px);
  color: #3478f6;
}

.task-card.completed .task-name {
  color: #75839a;
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}

.task-card.completed .task-time-wrap::before {
  border-color: #9fb1c5;
  background: #fff;
  box-shadow: none;
}

.task-detail-overlay {
  position: absolute;
  inset: 0;
  z-index: 8;
  border-radius: inherit;
  background: rgba(25, 45, 75, 0.14);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.task-detail-overlay.open {
  opacity: 1;
  pointer-events: auto;
}

.task-detail-drawer {
  position: absolute;
  z-index: 9;
  top: 10px;
  right: 10px;
  bottom: 10px;
  width: min(455px, 64%);
  padding: 22px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.88);
  box-shadow: -18px 0 42px rgba(38, 67, 109, 0.18);
  transform: translateX(calc(100% + 24px));
  transition: transform 0.28s cubic-bezier(0.22, 0.88, 0.24, 1);
  overflow-y: auto;
  scrollbar-width: thin;
}

.task-detail-drawer.open {
  transform: translateX(0);
}

.drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.drawer-kicker {
  color: var(--detail-blue);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.8px;
}

.drawer-close-btn {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 12px;
  color: #60708d;
  background: #f1f5fa;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.drawer-close-btn svg {
  width: 18px;
  height: 18px;
}

.drawer-title {
  margin: 18px 0 10px;
  font-size: 23px;
  line-height: 1.45;
  letter-spacing: -0.3px;
  color: #101936;
  font-weight: 900;
}

.drawer-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.drawer-grid {
  margin-top: 20px;
  display: grid;
  gap: 11px;
}

.drawer-row {
  display: grid;
  grid-template-columns: 86px 1fr;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #edf1f6;
  font-size: 13px;
}

.drawer-row span {
  color: #60708d;
}

.drawer-row strong {
  color: #101936;
  font-weight: 700;
  text-align: right;
  word-break: break-word;
}

.drawer-note {
  margin-top: 18px;
  padding: 15px;
  border-radius: 15px;
  color: #5c6b82;
  background: #f5f8fc;
  font-size: 13px;
  line-height: 1.7;
}

.drawer-actions {
  margin-top: 20px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.drawer-action {
  height: 44px;
  border: 0;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
}

.drawer-action.primary {
  color: #fff;
  background: var(--detail-blue);
  box-shadow: 0 9px 18px rgba(52, 120, 246, 0.24);
}

.drawer-action:disabled {
  opacity: 0.48;
  cursor: not-allowed;
  box-shadow: none;
}

.detail-loading {
  margin: 16px 0 0;
  color: #60708d;
  font-size: 13px;
}

.quick-create {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 0 0;
  height: 56px;
  border-radius: 17px;
  padding: 8px 9px 8px 12px;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(214, 225, 238, 0.9);
}

.quick-create-plus {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 11px;
  color: var(--detail-blue);
  background: rgba(52, 120, 246, 0.09);
  display: grid;
  place-items: center;
  cursor: pointer;
}

.quick-create-plus svg {
  width: 18px;
  height: 18px;
}
.quick-create input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: #101936;
}
.quick-create input::placeholder {
  color: #9aa8bb;
}
.quick-create button[type='submit'] {
  width: 39px;
  height: 39px;
  border-radius: 13px;
  border: none;
  background: linear-gradient(135deg, #2f72ed, #4d91ff);
  color: white;
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(52, 120, 246, 0.23);
}
.quick-create button[type='submit']:disabled {
  opacity: 0.5;
}
.quick-create button[type='submit'] svg {
  width: 18px;
  height: 18px;
}

.detail-create-modal {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 28px;
  background: rgba(25, 45, 75, 0.16);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.detail-create-card {
  width: min(600px, calc(100vw - 56px));
  height: min(760px, calc(100vh - 56px));
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.88);
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 30px 70px rgba(35, 62, 102, 0.28);
  padding: 24px;
  overflow: hidden;
}

.detail-create-card :deep(.preview-panel) {
  height: 100%;
}

.detail-create-modal-enter-active,
.detail-create-modal-leave-active {
  transition: opacity 0.2s ease;
}

.detail-create-modal-enter-active .detail-create-card,
.detail-create-modal-leave-active .detail-create-card {
  transition: transform 0.25s cubic-bezier(0.22, 0.88, 0.24, 1);
}

.detail-create-modal-enter-from,
.detail-create-modal-leave-to {
  opacity: 0;
}

.detail-create-modal-enter-from .detail-create-card,
.detail-create-modal-leave-to .detail-create-card {
  transform: translateY(18px) scale(0.98);
}

.detail-side-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  min-width: 0;
  padding: 8px 8px 8px 4px;
  box-sizing: border-box;
  background: transparent;
}

.side-content-card {
  background: var(--content-card-bg);
  border: 1px solid var(--content-card-border);
  border-radius: 16px;
  box-shadow: var(--content-card-shadow);
  backdrop-filter: var(--content-card-blur);
  -webkit-backdrop-filter: var(--content-card-blur);
}

.calendar-card {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 20px 24px 22px;
}

.calendar-card.is-week-mode {
  flex: 1 1 auto;
  min-height: clamp(420px, 46vh, 580px);
}

.notification-card {
  flex: 1;
  min-height: clamp(320px, 38vh, 520px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}

.calendar-range-segment {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.74);
  border-radius: 999px;
  padding: 4px;
  background: linear-gradient(180deg, rgba(246, 250, 255, 0.72), rgba(226, 237, 250, 0.56)),
    rgba(238, 246, 255, 0.5);
  backdrop-filter: blur(18px) saturate(1.12);
  -webkit-backdrop-filter: blur(18px) saturate(1.12);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    inset 0 -1px 0 rgba(142, 165, 197, 0.1),
    0 14px 30px -24px rgba(20, 48, 92, 0.42);
}

.calendar-range-segment button {
  flex: 1;
  min-width: 0;
  height: 32px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #5f7192;
  font: inherit;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  transition:
    background 160ms ease,
    color 160ms ease,
    box-shadow 160ms ease;
}

.calendar-range-segment button.active {
  background: linear-gradient(180deg, #428dff, #2878f6);
  color: white;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.36),
    0 10px 18px -11px rgba(37, 117, 245, 0.76);
}

.calendar-range-segment button:not(.active):hover {
  background: rgba(255, 255, 255, 0.34);
  color: #30446c;
}

.calendar-range-segment button:focus-visible,
.compact-mode-btn:focus-visible,
.month-nav-btn:focus-visible,
.today-chip:focus-visible {
  outline: 2px solid rgba(47, 124, 255, 0.65);
  outline-offset: 2px;
}

.calendar-range-segment {
  flex: 0 0 112px;
}

.calendar-range-segment button:disabled {
  cursor: default;
  opacity: 1;
}

.calendar-header-mock {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: nowrap;
}

.calendar-month-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 1 auto;
  min-width: 0;
}

.calendar-header-mock h2 {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: #142142;
  font-size: 18px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.calendar-header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex: 0 0 auto;
  min-width: 0;
  margin-left: auto;
}

.compact-mode-btn {
  flex: 0 0 auto;
  height: 34px;
  border: 1px solid rgba(199, 216, 241, 0.78);
  border-radius: 999px;
  padding: 0 12px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.74), rgba(232, 241, 253, 0.54)),
    rgba(248, 251, 255, 0.6);
  color: #31517f;
  font: inherit;
  font-size: 13px;
  font-weight: 900;
  white-space: nowrap;
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.78),
    0 12px 22px -20px rgba(20, 48, 92, 0.36);
  transition:
    background 160ms ease,
    color 160ms ease,
    box-shadow 160ms ease;
}

.compact-mode-btn:hover {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(224, 238, 255, 0.62)),
    rgba(255, 255, 255, 0.66);
  color: var(--detail-blue);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.88),
    0 12px 24px -18px rgba(47, 124, 255, 0.32);
}
.month-nav-btn {
  border: none;
  background: transparent;
  color: #273b65;
  cursor: pointer;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 10px;
  transition:
    background 160ms ease,
    color 160ms ease;
}
.month-nav-btn:hover {
  background: rgba(47, 124, 255, 0.1);
  color: var(--detail-blue);
}
.month-nav-btn svg {
  width: 18px;
  height: 18px;
  stroke-width: 2.4;
}

.calendar-action-group {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
}

.today-chip {
  height: 32px;
  min-width: 46px;
  border: 1px solid rgba(199, 216, 241, 0.78);
  border-radius: 12px;
  padding: 0 10px;
  background: rgba(248, 251, 255, 0.62);
  color: #2f7cff;
  font: inherit;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.74);
  transition:
    background 160ms ease,
    color 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.today-chip:hover {
  background: rgba(239, 246, 255, 0.92);
  border-color: rgba(147, 197, 253, 0.72);
  color: #2563eb;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.88),
    0 8px 18px -14px rgba(47, 124, 255, 0.28);
}

.calendar-placeholder-wrapper {
  flex: 1;
  min-height: 0;
  border-radius: 14px;
  padding: 2px 0 0;
  background: transparent;
  display: flex;
  flex-direction: column;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: 30px repeat(6, minmax(42px, 1fr));
  height: auto;
  column-gap: 2px;
  row-gap: 1px;
  text-align: center;
}

.week-label {
  min-width: 0;
  height: 30px;
  border-bottom: 1px solid rgba(166, 186, 214, 0.18);
  color: #7b8fa8;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.month-day {
  position: relative;
  min-width: 0;
  min-height: 0;
  border: none;
  background: transparent;
  border-radius: 0;
  color: #162442;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 2px 0;
  font: inherit;
  transition: color 160ms ease;
}

.month-day:focus-visible {
  outline: none;
}

.month-day:focus-visible:not(.selected) strong {
  outline: 2px solid rgba(47, 124, 255, 0.52);
  outline-offset: 2px;
}

.month-day:not(.selected):hover strong {
  background: rgba(214, 228, 252, 0.78);
  color: #18345f;
}

.month-day:not(.selected):active strong {
  background: rgba(199, 219, 252, 0.92);
  transform: scale(0.94);
}

.month-day strong {
  position: relative;
  z-index: 1;
  width: 36px;
  height: 36px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  font-size: 15px;
  font-weight: 900;
  line-height: 1;
  transition:
    background 180ms cubic-bezier(0.22, 1, 0.36, 1),
    color 180ms ease,
    box-shadow 180ms ease,
    transform 120ms ease;
}

.month-day.muted {
  color: #b0bdd0;
}

.month-day.muted:not(.selected):hover strong {
  background: rgba(226, 232, 240, 0.72);
  color: #8a9bb0;
}

.month-day.today:not(.selected) strong {
  color: var(--detail-blue);
  border-radius: 999px;
  box-shadow: inset 0 0 0 1.5px rgba(47, 124, 255, 0.44);
}

.month-day.today:not(.selected):hover strong {
  background: rgba(214, 228, 252, 0.62);
  box-shadow: inset 0 0 0 1.5px rgba(47, 124, 255, 0.52);
}

.month-day.selected {
  color: white;
}

.month-day.selected strong {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  color: #fff;
  background: linear-gradient(180deg, #4a90ff 0%, #2878f6 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.34),
    0 0 0 3px rgba(47, 124, 255, 0.16),
    0 10px 22px -10px rgba(40, 120, 246, 0.72);
}

.month-day.selected:hover strong,
.month-day.selected:focus-visible strong {
  background: linear-gradient(180deg, #5598ff 0%, #2f80f8 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.38),
    0 0 0 4px rgba(47, 124, 255, 0.22),
    0 12px 24px -8px rgba(40, 120, 246, 0.78);
}

.day-dots {
  position: relative;
  z-index: 2;
  min-height: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 1px;
}

.day-dots i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.month-day.selected .day-dots {
  position: absolute;
  left: 50%;
  bottom: 6px;
  transform: translateX(-50%);
  margin-top: 0;
}

.month-day.selected .day-dots i {
  width: 4px;
  height: 4px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.45);
}

@media (prefers-reduced-motion: reduce) {
  .month-day strong {
    transition: none;
  }

  .month-day:not(.selected):active strong {
    transform: none;
  }
}

.dot-blue {
  background: #2f7cff;
}

.dot-green {
  background: #20bb77;
}

.dot-orange {
  background: #f59e0b;
}

.dot-violet {
  background: #8b5cf6;
}

.dot-cyan {
  background: #09b6d7;
}

.dot-slate {
  background: #94a3b8;
}

@media (max-width: 1460px) {
  .filter-stack {
    gap: 8px;
  }

  .filter {
    padding: 0 11px;
  }

  .type-filter {
    min-width: 52px;
    padding: 0 8px;
  }

  .filter-result-text {
    display: none;
  }
}

@media (max-width: 1440px) {
  .detail-board {
    grid-template-columns: minmax(272px, 300px) minmax(0, 1fr) minmax(416px, 448px);
  }
}

@media (max-width: 1180px) {
  .detail-left-panel {
    display: none;
  }

  .detail-board {
    grid-template-columns: minmax(0, 1fr);
    overflow: auto;
  }

  .detail-main-panel {
    border-bottom: 0;
  }
}

@media (max-width: 900px) {
  .detail-workspace {
    width: calc(100% - 28px);
  }
}
</style>
