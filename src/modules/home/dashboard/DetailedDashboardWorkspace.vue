<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import IconCheck from '~icons/lucide/check'
import IconChevronLeft from '~icons/lucide/chevron-left'
import IconChevronRight from '~icons/lucide/chevron-right'
import IconClock3 from '~icons/lucide/clock-3'
import IconTag from '~icons/lucide/tag'
import IconUser from '~icons/lucide/user'
import IconUserCheck from '~icons/lucide/user-check'
import IconX from '~icons/lucide/x'
import { routeConfig } from '@/config/route.config'
import AppStateBlock from '@/shared/components/state/AppStateBlock.vue'
import { useFeedbackStore } from '@/stores/feedback.store'
import { useRouter } from 'vue-router'
import { dashboardTools, navigateDashboardTool, type DashboardTool, type DashboardToolTarget } from './dashboardTools'
import CalendarWeekTimeline from './components/CalendarWeekTimeline.vue'
import DashboardNotificationCenter from './components/DashboardNotificationCenter.vue'
import TodoQuickCreateBar from './components/TodoQuickCreateBar.vue'
import DayPreviewPanel from './DayPreviewPanel.vue'
import type { CalendarDay, CalendarEvent, CalendarTodoDraft } from './types'
import {
  compareEvents,
  formatAiFocusTodoLabel,
  formatEventTime,
  formatTodoDetailTimeField,
  getBackendTodoStatusLabel,
  getEventScheduleDisplay,
  getSmartTodoKindLabel,
  getTodoAssigneeDisplayName,
  getTodoContentDisplay,
  getTodoCreatorDisplayName,
  isCompletedTodoEvent,
  isPendingProcessTodoEvent,
  matchesDetailStatusFilter,
  shouldShowTodoAssignerField,
  isAllDayEvent,
  isRangeEvent,
  ymd,
  type DetailStatusFilter,
} from './todoDisplay'
import {
  acceptTodos,
  createTodo as serviceCreateTodo,
  deleteTodo as serviceDeleteTodo,
  getTodoMonthRange,
  getTodoWeekRange,
  loadTodoDetail,
  rejectTodo,
  updateTodoStatus as serviceUpdateTodoStatus,
} from './todo.service'
import { useDashboardTodos } from './useDashboardTodos'

type DayPreviewPanelExpose = {
  openCreateForm: () => void
  showDiscardWarning: (onConfirm?: () => void) => void
}

type LeftPanelMode = 'tools' | 'create' | 'detail'

type DetailMode = 'simple' | 'detail'
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

const DEFAULT_STATUS_FILTER: DetailStatusFilter = 'pending'

const props = defineProps<{
  selectedDate: string
}>()

const emit = defineEmits<{
  'switch-mode': [mode: DetailMode]
  'update:selectedDate': [date: string]
}>()

const router = useRouter()
const feedbackStore = useFeedbackStore()

const now = ref(new Date())
const todayDate = computed(() => ymd(now.value))
const currentMonth = ref(new Date(now.value.getFullYear(), now.value.getMonth(), 1))
const calendarViewMode = ref<'month' | 'week'>('month')
const showCalendarRangeSwitch = false
const taskDetails = ref<Record<string, CalendarEvent>>({})
const statusFilter = ref<DetailStatusFilter>(DEFAULT_STATUS_FILTER)
const typeFilter = ref<DetailTypeFilter>('all')
const activeTaskId = ref('')
const detailLoadingId = ref('')
const quickCreateText = ref('')
const leftPanelMode = ref<LeftPanelMode>('tools')
const isCreateFormDirty = ref(false)
const quickCreatePrompt = ref('')
const quickCreateKey = ref(0)
const dayPreviewPanelRef = ref<DayPreviewPanelExpose | null>(null)
const notificationCenterRef = ref<{ refreshPendingTodos: () => Promise<void> } | null>(null)
const activeToolName = ref('')
const pendingActionProcessing = ref(false)
const pendingInboxDetailActive = ref(false)
const pendingDeleteTaskId = ref('')
const deleteActionProcessing = ref(false)

function getActiveTodoLoadRange() {
  return calendarViewMode.value === 'week'
    ? getTodoWeekRange(props.selectedDate)
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
  { value: 'pending', label: '待处理' },
  { value: 'done', label: '已完成' },
  { value: 'other', label: '其他' },
]

const typeFilters: TypeFilterItem[] = [
  { value: 'task', label: '待办' },
  { value: 'meeting', label: '会议' },
]

const selectedDateEvents = computed(() => eventMap.value.get(props.selectedDate) ?? [])
const pendingEvents = computed(() =>
  selectedDateEvents.value.filter((event) => isPendingProcessTodoEvent(event)),
)
const selectedDateLabel = computed(() => formatDateTitle(props.selectedDate))
const mainTitle = computed(() => (props.selectedDate === todayDate.value ? '今日待办' : '当日待办'))

const statusFilterCounts = computed<Record<DetailStatusFilter, number>>(() => ({
  all: selectedDateEvents.value.length,
  pending: selectedDateEvents.value.filter(isPendingProcessTodoEvent).length,
  done: selectedDateEvents.value.filter(isCompletedTodoEvent).length,
  other: selectedDateEvents.value.filter((event) => matchesDetailStatusFilter(event, 'other')).length,
}))

const filteredTasks = computed(() =>
  selectedDateEvents.value.filter(
    (event) =>
      matchesDetailStatusFilter(event, statusFilter.value) &&
      matchesTypeFilter(event, typeFilter.value),
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
  () => statusFilter.value !== DEFAULT_STATUS_FILTER || typeFilter.value !== 'all',
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
  if (statusFilter.value === 'pending') {
    return {
      title: '暂无待处理事项',
      desc: '当前没有需要继续推进的待办或已接受任务。',
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
      desc: '待接受、已拒绝等协作状态事项会出现在这里。',
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
const taskEmptyActionLabel = computed(() => {
  if (isLoading.value || filteredTasks.value.length) return ''
  if (!selectedDateEvents.value.length) return ''
  if (statusFilter.value === 'all' && typeFilter.value === 'all') return ''
  return '查看全部'
})

const monthDays = computed(() => buildMonthDays())
const weekCalendarDays = computed(() => buildWeekCalendarDays())
const calendarHeaderLabel = computed(() =>
  calendarViewMode.value === 'week'
    ? weekRangeLabel(props.selectedDate)
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
const daySubject = computed(() => (props.selectedDate === todayDate.value ? '今日' : '当日'))

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

  const focusLabel = formatAiFocusTodoLabel(nextTask)
  const remaining = Math.max(pendingCount.value - 1, 0)
  if (remaining) {
    return `当前最需要关注的是${focusLabel}，建议先完成它，再处理其余 ${remaining} 项任务。`
  }

  return `当前最需要关注的是${focusLabel}，完成后即可清空待处理事项。`
})

const activeTask = computed(() => {
  if (!activeTaskId.value) return null

  const cached = taskDetails.value[activeTaskId.value]
  const fromList =
    selectedDateEvents.value.find((event) => event.id === activeTaskId.value) ??
    findEventById(activeTaskId.value)

  if (cached && fromList) {
    return { ...cached, ...fromList }
  }

  return fromList ?? cached ?? null
})

const showPendingInboxActions = computed(() => {
  if (!activeTask.value) return false
  if (pendingInboxDetailActive.value) return true
  return isPendingAcceptanceTask(getTaskDetail(activeTask.value))
})

type DetailStatusTone = 'accepted' | 'done' | 'rejected' | 'pending' | 'waiting'

const taskDetailPanel = computed(() => {
  const task = activeTask.value
  if (!task) return null

  const detail = getTaskDetail(task)
  const meta: Array<{ key: string; label: string; value: string }> = [
    {
      key: 'type',
      label: '类型',
      value: getSmartTodoKindLabel(detail),
    },
  ]

  if (shouldShowTodoAssignerField(detail)) {
    meta.push({
      key: 'assigner',
      label: '指派人',
      value: getTodoCreatorDisplayName(detail),
    })
  }

  meta.push({
    key: 'receiver',
    label: '接受人',
    value: getTodoAssigneeDisplayName(detail),
  })

  return {
    title: detail.title || '未命名待办',
    typeLabel: getTaskTypeLabel(detail),
    typeTone: detail.type === 'meeting' ? 'meeting' : 'todo',
    statusLabel: getBackendTodoStatusLabel(detail),
    statusTone: getDetailStatusTone(detail),
    time: formatTodoDetailTimeField(detail),
    content: getTodoContentDisplay(detail),
    meta,
  }
})

const isActiveDetailLoading = computed(
  () => Boolean(activeTaskId.value && detailLoadingId.value === activeTaskId.value),
)

const showDetailDeleteAction = computed(() => {
  const task = activeTask.value
  if (!task) return false
  return isCompletedTodoEvent(task)
})

const isDetailDeleteConfirming = computed(
  () => Boolean(activeTaskId.value && pendingDeleteTaskId.value === activeTaskId.value),
)

const leftPanelAriaLabel = computed(() => {
  if (leftPanelMode.value === 'create') return '完整创建'
  if (leftPanelMode.value === 'detail') return '任务详情'
  return '快捷入口'
})

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
  if (leftPanelMode.value === 'create') {
    requestCloseCreateModal()
    return
  }
  if (leftPanelMode.value === 'detail') {
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
  const preserveDetailId =
    leftPanelMode.value === 'detail' && activeTaskId.value ? activeTaskId.value : ''
  const preservedDetail = preserveDetailId ? taskDetails.value[preserveDetailId] : null

  await refreshDashboardTodos()

  if (preserveDetailId) {
    taskDetails.value = preservedDetail ? { [preserveDetailId]: preservedDetail } : {}
  } else {
    taskDetails.value = {}
  }

  ensureSelectedDateInLoadedRange()

  if (!preserveDetailId) return

  pendingInboxDetailActive.value = false

  const updatedTask = findEventById(preserveDetailId)
  if (updatedTask) {
    if (preservedDetail) {
      taskDetails.value = {
        [preserveDetailId]: {
          ...preservedDetail,
          ...updatedTask,
        },
      }
    }
    await loadTaskDetail(updatedTask, true, { silent: Boolean(preservedDetail) })
    return
  }

  if (preservedDetail) {
    await loadTaskDetail(preservedDetail, true, { silent: true })
    return
  }

  detailLoadingId.value = preserveDetailId
  try {
    const detail = await loadTodoDetail(
      preserveDetailId,
      currentUser.value,
      assignableUsers.value,
    )
    taskDetails.value = {
      [preserveDetailId]: detail,
    }
  } catch {
    closeTaskDetail()
  } finally {
    detailLoadingId.value = ''
  }
}

function findEventById(id: string) {
  for (const events of eventMap.value.values()) {
    const match = events.find((event) => event.id === id)
    if (match) return match
  }
  return null
}

async function openTodoFromNotification(payload: {
  id: string
  date?: string
  source?: 'pending-inbox'
}) {
  if (leftPanelMode.value === 'create') {
    if (isCreateFormDirty.value) {
      requestCloseCreateModal(() => {
        void openTodoFromNotification(payload)
      })
      return
    }
    closeCreateModal()
  }

  detailLoadingId.value = payload.id

  try {
    const detailEvent = await loadTodoDetail(payload.id, currentUser.value, assignableUsers.value)
    taskDetails.value = {
      ...taskDetails.value,
      [detailEvent.id]: detailEvent,
    }
    pendingInboxDetailActive.value = payload.source === 'pending-inbox'
    leftPanelMode.value = 'detail'
    activeTaskId.value = detailEvent.id
    pendingDeleteTaskId.value = ''
  } catch {
    pendingInboxDetailActive.value = false
    feedbackStore.error('查询待办详情失败')
  } finally {
    detailLoadingId.value = ''
  }
}

defineExpose({
  refreshTodos,
  openTodoFromNotification,
})

function updateSelectedDate(date: string) {
  emit('update:selectedDate', date)
}

function ensureSelectedDateInLoadedRange() {
  if (calendarViewMode.value === 'week') return
  const value = new Date(`${props.selectedDate}T12:00:00`)
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
    updateSelectedDate(todayDate.value)
    return
  }

  updateSelectedDate(
    ymd(new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth(), 1)),
  )
}

async function changeCalendarPeriod(delta: number) {
  if (calendarViewMode.value === 'week') {
    const next = new Date(`${props.selectedDate}T12:00:00`)
    next.setDate(next.getDate() + delta * 7)
    updateSelectedDate(ymd(next))
    closeTaskDetail()
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
    const nextDate = new Date(`${props.selectedDate}T12:00:00`)
    currentMonth.value = new Date(nextDate.getFullYear(), nextDate.getMonth(), 1)
  }
}

async function goToday() {
  now.value = new Date()
  updateSelectedDate(todayDate.value)
  currentMonth.value = new Date(now.value.getFullYear(), now.value.getMonth(), 1)
}

function selectCalendarDate(date: string) {
  updateSelectedDate(date)
  closeTaskDetail()
  resetTaskFilters()
}

function resetTaskFilters() {
  statusFilter.value = DEFAULT_STATUS_FILTER
  typeFilter.value = 'all'
}

function showAllTasks() {
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
  return selectedDateEvents.value.filter((event) => matchesDetailStatusFilter(event, filter))
}

function getTypeCountForStatus(status: DetailStatusFilter, type: Exclude<DetailTypeFilter, 'all'>) {
  const pool = getStatusPoolEvents(status)
  if (type === 'meeting') return pool.filter((event) => event.type === 'meeting').length
  return pool.filter((event) => event.type !== 'meeting').length
}

async function openTaskDetail(task: CalendarEvent) {
  if (leftPanelMode.value === 'create') {
    if (isCreateFormDirty.value) {
      requestCloseCreateModal(() => {
        void openTaskDetail(task)
      })
      return
    }
    closeCreateModal()
  }

  pendingInboxDetailActive.value = false
  leftPanelMode.value = 'detail'
  activeTaskId.value = task.id
  pendingDeleteTaskId.value = ''
  await loadTaskDetail(task)
}

function closeTaskDetail() {
  activeTaskId.value = ''
  pendingInboxDetailActive.value = false
  pendingDeleteTaskId.value = ''
  if (leftPanelMode.value === 'detail') {
    leftPanelMode.value = 'tools'
  }
}

async function loadTaskDetail(
  task: CalendarEvent,
  force = false,
  options?: { silent?: boolean },
) {
  if (!currentUser.value.id || (!force && taskDetails.value[task.id])) return

  const silent = options?.silent ?? false
  if (!silent) {
    detailLoadingId.value = task.id
  }

  try {
    const detail = await loadTodoDetail(task.id, currentUser.value, assignableUsers.value)
    taskDetails.value = {
      ...taskDetails.value,
      [task.id]: detail,
    }
  } catch {
    if (!silent) {
      feedbackStore.error('查询待办详情失败')
    }
  } finally {
    if (!silent) {
      detailLoadingId.value = ''
    }
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
  leftPanelMode.value = 'create'
}

function closeCreateModal() {
  leftPanelMode.value = 'tools'
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
      updateSelectedDate(payload.date)
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
  if (isPendingAcceptanceTask(task)) return '待接受'
  return '待处理'
}

function getDetailStatusTone(event: CalendarEvent): DetailStatusTone {
  const label = getBackendTodoStatusLabel(event)
  if (label === '已完成') return 'done'
  if (label === '已拒绝') return 'rejected'
  if (label === '待接受') return 'pending'
  if (label === '已接受') return 'accepted'
  return 'waiting'
}

function isPendingAcceptanceTask(task: CalendarEvent) {
  if (task.backendStatus === 3 || task.backendStatus === 6 || task.backendStatus === 9) {
    return false
  }

  if (task.scope === 'assigned_to_me') return true

  const assigneeIds =
    task.assigneeId
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean) ?? []

  return Boolean(
    currentUser.value.id &&
      assigneeIds.includes(currentUser.value.id) &&
      task.creatorId &&
      task.creatorId !== currentUser.value.id,
  )
}

async function handleAcceptPendingTodo() {
  const task = activeTask.value
  if (!task || pendingActionProcessing.value) return

  pendingActionProcessing.value = true
  try {
    await acceptTodos(task.id)
    pendingInboxDetailActive.value = false
    closeTaskDetail()
    await refreshTodos()
    await notificationCenterRef.value?.refreshPendingTodos()
    feedbackStore.success('已接受待办')
  } catch {
    // 全局拦截器已统一提示错误。
  } finally {
    pendingActionProcessing.value = false
  }
}

async function handleRejectPendingTodo() {
  const task = activeTask.value
  if (!task || pendingActionProcessing.value) return

  pendingActionProcessing.value = true
  try {
    await rejectTodo(task.id, '暂不处理')
    pendingInboxDetailActive.value = false
    closeTaskDetail()
    await refreshTodos()
    await notificationCenterRef.value?.refreshPendingTodos()
    feedbackStore.success('已拒绝待办')
  } catch {
    // 全局拦截器已统一提示错误。
  } finally {
    pendingActionProcessing.value = false
  }
}

function requestDeleteActiveTask() {
  const task = activeTask.value
  if (!task || !showDetailDeleteAction.value || isActiveDetailLoading.value) return
  pendingDeleteTaskId.value = task.id
}

function cancelDeleteActiveTask() {
  pendingDeleteTaskId.value = ''
}

async function confirmDeleteActiveTask() {
  const task = activeTask.value
  if (!task || deleteActionProcessing.value || pendingDeleteTaskId.value !== task.id) return

  deleteActionProcessing.value = true
  try {
    await serviceDeleteTodo(task.id)
    const nextDetails = { ...taskDetails.value }
    delete nextDetails[task.id]
    taskDetails.value = nextDetails
    pendingDeleteTaskId.value = ''
    closeTaskDetail()
    await refreshTodos()
    feedbackStore.success('待办已删除')
  } catch {
    // 全局拦截器已统一提示错误。
  } finally {
    deleteActionProcessing.value = false
  }
}

function matchesTypeFilter(event: CalendarEvent, filter: DetailTypeFilter) {
  if (filter === 'all') return true
  if (filter === 'meeting') return event.type === 'meeting'
  return event.type !== 'meeting'
}

function buildWeekCalendarDays(): CalendarDay[] {
  const start = new Date(`${props.selectedDate}T12:00:00`)
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
      isSelected: key === props.selectedDate,
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
    <section
      class="detail-board"
      :class="{ 'left-panel-active': leftPanelMode !== 'tools' }"
      aria-label="首页详细模式工作区"
    >
      <aside class="detail-left-panel" :aria-label="leftPanelAriaLabel">
        <template v-if="leftPanelMode === 'tools'">
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

          <section class="side-card">
            <div class="panel-title">
              <h2>快捷入口</h2>
              <button class="panel-mini-btn" type="button" @click="notifyCustomizeQuick">自定义</button>
            </div>

            <div class="tool-list">
              <button
                v-for="tool in dashboardTools"
                :key="tool.id"
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

          <div class="customize">
            <button type="button" @click="notifyCustomizeTools">⇄　自定义工具</button>
          </div>
        </template>

        <div v-else-if="leftPanelMode === 'create'" class="left-panel-create-card">
          <DayPreviewPanel
            ref="dayPreviewPanelRef"
            :key="quickCreateKey"
            form-only
            show-close
            :date="props.selectedDate"
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

        <section
          v-else-if="leftPanelMode === 'detail' && activeTaskId"
          class="left-panel-detail"
        >
          <template v-if="activeTask && taskDetailPanel">
          <header class="detail-panel-head">
            <div class="detail-panel-head-main">
              <span class="detail-panel-kicker">任务详情</span>
              <div class="detail-panel-badges">
                <span class="detail-type-badge" :class="taskDetailPanel.typeTone">
                  {{ taskDetailPanel.typeLabel }}
                </span>
                <span class="detail-status-badge" :class="taskDetailPanel.statusTone">
                  {{ taskDetailPanel.statusLabel }}
                </span>
              </div>
            </div>
            <button
              type="button"
              class="detail-panel-close"
              aria-label="关闭详情"
              @click="closeTaskDetail"
            >
              <IconX aria-hidden="true" />
            </button>
          </header>

          <div
            class="detail-panel-body"
            :class="{ 'is-loading': isActiveDetailLoading }"
            :aria-busy="isActiveDetailLoading"
          >
            <div
              v-if="isActiveDetailLoading"
              class="detail-panel-skeleton"
              aria-hidden="true"
            >
              <div class="detail-skeleton-title detail-skeleton-block"></div>
              <div class="detail-skeleton-desc detail-skeleton-block"></div>
              <div class="detail-skeleton-desc detail-skeleton-block is-short"></div>

              <div class="detail-skeleton-time-card">
                <div class="detail-skeleton-icon detail-skeleton-block"></div>
                <div class="detail-skeleton-time-copy">
                  <div class="detail-skeleton-label detail-skeleton-block"></div>
                  <div class="detail-skeleton-line detail-skeleton-block"></div>
                </div>
              </div>

              <div class="detail-skeleton-meta-grid">
                <div class="detail-skeleton-meta-item">
                  <div class="detail-skeleton-icon detail-skeleton-block"></div>
                  <div class="detail-skeleton-meta-copy">
                    <div class="detail-skeleton-label detail-skeleton-block"></div>
                    <div class="detail-skeleton-line detail-skeleton-block"></div>
                  </div>
                </div>
                <div class="detail-skeleton-meta-item">
                  <div class="detail-skeleton-icon detail-skeleton-block"></div>
                  <div class="detail-skeleton-meta-copy">
                    <div class="detail-skeleton-label detail-skeleton-block"></div>
                    <div class="detail-skeleton-line detail-skeleton-block"></div>
                  </div>
                </div>
              </div>
            </div>

            <template v-else>
              <h2 class="detail-panel-title">{{ taskDetailPanel.title }}</h2>
              <p class="detail-panel-desc">{{ taskDetailPanel.content }}</p>

              <section class="detail-time-card" aria-label="时间安排">
                <span class="detail-time-icon" aria-hidden="true">
                  <IconClock3 />
                </span>
                <div class="detail-time-main">
                  <span class="detail-field-label">时间安排</span>
                  <div class="detail-time-lines">
                    <template v-if="Array.isArray(taskDetailPanel.time)">
                      <span class="detail-time-line">{{ taskDetailPanel.time[0] }}</span>
                      <span class="detail-time-separator" aria-hidden="true">→</span>
                      <span class="detail-time-line">{{ taskDetailPanel.time[1] }}</span>
                    </template>
                    <span v-else class="detail-time-line">{{ taskDetailPanel.time }}</span>
                  </div>
                </div>
              </section>

              <section class="detail-meta-grid" aria-label="任务信息">
                <article
                  v-for="item in taskDetailPanel.meta"
                  :key="item.key"
                  class="detail-meta-item"
                >
                  <span class="detail-meta-icon" aria-hidden="true">
                    <IconTag v-if="item.key === 'type'" />
                    <IconUser v-else-if="item.key === 'assigner'" />
                    <IconUserCheck v-else />
                  </span>
                  <div class="detail-meta-copy">
                    <span class="detail-field-label">{{ item.label }}</span>
                    <strong>{{ item.value }}</strong>
                  </div>
                </article>
              </section>
            </template>
          </div>

          <footer class="detail-panel-footer">
            <div
              class="detail-panel-actions"
              :class="{
                'is-pending-inbox': showPendingInboxActions,
                'is-completed-detail': showDetailDeleteAction && !isDetailDeleteConfirming,
                'is-delete-confirm': isDetailDeleteConfirming,
              }"
            >
              <template v-if="showPendingInboxActions">
                <button
                  type="button"
                  class="detail-action accept"
                  :disabled="pendingActionProcessing || isActiveDetailLoading"
                  @click="handleAcceptPendingTodo"
                >
                  {{ pendingActionProcessing ? '处理中…' : '接受' }}
                </button>
                <button
                  type="button"
                  class="detail-action reject"
                  :disabled="pendingActionProcessing || isActiveDetailLoading"
                  @click="handleRejectPendingTodo"
                >
                  拒绝
                </button>
              </template>
              <template v-else-if="isDetailDeleteConfirming">
                <span class="detail-delete-confirm">确定删除？</span>
                <button
                  type="button"
                  class="detail-action secondary"
                  :disabled="deleteActionProcessing"
                  @click="cancelDeleteActiveTask"
                >
                  取消
                </button>
                <button
                  type="button"
                  class="detail-action delete"
                  :disabled="deleteActionProcessing"
                  @click="confirmDeleteActiveTask"
                >
                  {{ deleteActionProcessing ? '删除中…' : '确认删除' }}
                </button>
              </template>
              <template v-else>
                <button
                  type="button"
                  class="detail-action primary"
                  :disabled="activeTask.completable === false || isActiveDetailLoading"
                  @click="toggleDetailTaskStatus"
                >
                  {{ activeTask.status === 'done' ? '恢复待处理' : '标记完成' }}
                </button>
                <button
                  v-if="showDetailDeleteAction"
                  type="button"
                  class="detail-action delete"
                  :disabled="isActiveDetailLoading"
                  @click="requestDeleteActiveTask"
                >
                  删除
                </button>
              </template>
            </div>
          </footer>
          </template>
        </section>
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
              @action="showAllTasks()"
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
        </div>

        <TodoQuickCreateBar
          v-model="quickCreateText"
          variant="detail"
          @full-create="openCreateModal()"
          @submit="submitQuickCreate"
        />
      </main>

      <aside class="detail-side-panel" aria-label="消息通知和日历">
        <section class="notification-card side-content-card" aria-label="消息通知">
          <DashboardNotificationCenter
            ref="notificationCenterRef"
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
              <button
                type="button"
                class="compact-mode-btn"
                aria-label="切换到简约模式"
                @click="emit('switch-mode', 'simple')"
              >
                简约模式
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
              :selected-date="props.selectedDate"
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
  --detail-side-col: minmax(444px, 472px);
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: var(--detail-side-col) minmax(0, 1fr) var(--detail-side-col);
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

.left-panel-create-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.44);
  border: 1px solid rgba(255, 255, 255, 0.64);
  padding: 16px;
  overflow: hidden;
  box-sizing: border-box;
}

.left-panel-create-card :deep(.preview-panel) {
  flex: 1;
  min-height: 0;
}

.left-panel-detail {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 22px;
  background: linear-gradient(165deg, rgba(255, 255, 255, 0.78), rgba(246, 250, 255, 0.56));
  border: 1px solid rgba(255, 255, 255, 0.82);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 18px 36px -28px rgba(38, 67, 109, 0.22);
  overflow: hidden;
  box-sizing: border-box;
}

.detail-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px 16px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.72);
  background: rgba(255, 255, 255, 0.42);
}

.detail-panel-head-main {
  min-width: 0;
}

.detail-panel-kicker {
  display: block;
  color: var(--detail-blue);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1.1px;
}

.detail-panel-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.detail-type-badge,
.detail-status-badge {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 11px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}

.detail-type-badge.meeting {
  color: #1d4fbf;
  background: rgba(47, 124, 255, 0.12);
  border: 1px solid rgba(47, 124, 255, 0.16);
}

.detail-type-badge.todo {
  color: #5b49d6;
  background: rgba(109, 92, 255, 0.12);
  border: 1px solid rgba(109, 92, 255, 0.16);
}

.detail-status-badge.accepted {
  color: #1d4fbf;
  background: rgba(219, 234, 254, 0.92);
}

.detail-status-badge.done {
  color: #047857;
  background: rgba(220, 252, 231, 0.92);
}

.detail-status-badge.rejected {
  color: #b91c1c;
  background: rgba(254, 226, 226, 0.92);
}

.detail-status-badge.pending {
  color: #b45309;
  background: rgba(254, 243, 199, 0.96);
}

.detail-status-badge.waiting {
  color: #475569;
  background: rgba(241, 245, 249, 0.96);
}

.detail-panel-close {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 12px;
  color: #60708d;
  background: rgba(255, 255, 255, 0.82);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    transform 0.18s ease;
}

.detail-panel-close:hover {
  background: #fff;
  border-color: rgba(47, 124, 255, 0.18);
  transform: translateY(-1px);
}

.detail-panel-close svg {
  width: 18px;
  height: 18px;
}

.detail-panel-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 20px 12px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.detail-panel-title {
  margin: 0;
  font-size: 24px;
  line-height: 1.42;
  letter-spacing: -0.35px;
  color: #101936;
  font-weight: 800;
}

.detail-panel-desc {
  margin: -6px 0 0;
  color: #5c6b82;
  font-size: 14px;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
}

.detail-field-label {
  display: block;
  margin-bottom: 6px;
  color: #8795aa;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
}

.detail-time-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 15px 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(47, 124, 255, 0.1), rgba(47, 124, 255, 0.03));
  border: 1px solid rgba(47, 124, 255, 0.12);
}

.detail-time-icon {
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  color: var(--detail-blue);
  background: rgba(255, 255, 255, 0.78);
  display: grid;
  place-items: center;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.detail-time-icon svg {
  width: 18px;
  height: 18px;
}

.detail-time-main {
  min-width: 0;
  flex: 1;
}

.detail-time-lines {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.detail-time-line {
  color: #101936;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.45;
}

.detail-time-separator {
  color: #94a3b8;
  font-size: 14px;
  font-weight: 700;
}

.detail-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.detail-meta-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
  padding: 14px;
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.78);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.detail-meta-icon {
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  color: #60708d;
  background: rgba(241, 245, 249, 0.92);
  display: grid;
  place-items: center;
}

.detail-meta-icon svg {
  width: 15px;
  height: 15px;
}

.detail-meta-copy {
  min-width: 0;
}

.detail-meta-copy strong {
  display: block;
  color: #101936;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.45;
  word-break: break-word;
}

.detail-panel-footer {
  flex: 0 0 auto;
  padding: 14px 20px 18px;
  border-top: 1px solid rgba(226, 232, 240, 0.72);
  background: rgba(255, 255, 255, 0.48);
}

.detail-panel-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.detail-panel-actions.is-pending-inbox {
  grid-template-columns: 1fr 1fr;
}

.detail-panel-actions.is-completed-detail {
  grid-template-columns: 1fr 1fr;
}

.detail-panel-actions.is-delete-confirm {
  grid-template-columns: minmax(0, 1.1fr) 1fr 1fr;
  align-items: center;
}

.detail-delete-confirm {
  color: #64748b;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.35;
}

.detail-action {
  height: 46px;
  border: 0;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    opacity 0.18s ease;
}

.detail-action:hover:not(:disabled) {
  transform: translateY(-1px);
}

.detail-action.accept {
  color: #047857;
  background: rgba(220, 252, 231, 0.96);
  border: 1px solid rgba(16, 185, 129, 0.14);
}

.detail-action.reject {
  color: #b91c1c;
  background: rgba(254, 226, 226, 0.96);
  border: 1px solid rgba(239, 68, 68, 0.12);
}

.detail-action.secondary {
  color: #475569;
  background: rgba(241, 245, 249, 0.96);
  border: 1px solid rgba(226, 232, 240, 0.92);
}

.detail-action.delete {
  color: #b91c1c;
  background: rgba(254, 226, 226, 0.96);
  border: 1px solid rgba(239, 68, 68, 0.12);
}

.detail-action.primary {
  color: #fff;
  background: linear-gradient(135deg, #2f72ed, #4d91ff);
  box-shadow: 0 10px 20px rgba(52, 120, 246, 0.24);
}

.detail-action:disabled {
  opacity: 0.48;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.detail-panel-body.is-loading {
  pointer-events: none;
}

.detail-panel-skeleton {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.detail-skeleton-block {
  border-radius: 10px;
  background: linear-gradient(
    90deg,
    rgba(226, 232, 240, 0.52) 0%,
    rgba(248, 250, 252, 0.96) 50%,
    rgba(226, 232, 240, 0.52) 100%
  );
  background-size: 240px 100%;
  animation: detail-skeleton-shimmer 1.15s ease-in-out infinite;
}

.detail-skeleton-title {
  width: 58%;
  height: 28px;
  border-radius: 12px;
}

.detail-skeleton-desc {
  width: 100%;
  height: 14px;
}

.detail-skeleton-desc.is-short {
  width: 72%;
}

.detail-skeleton-time-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 15px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.42);
  border: 1px solid rgba(226, 232, 240, 0.72);
}

.detail-skeleton-icon {
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  border-radius: 12px;
}

.detail-skeleton-time-copy,
.detail-skeleton-meta-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 2px;
}

.detail-skeleton-label {
  width: 56px;
  height: 10px;
  border-radius: 6px;
}

.detail-skeleton-line {
  width: 78%;
  height: 16px;
  border-radius: 8px;
}

.detail-skeleton-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.detail-skeleton-meta-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
  padding: 14px;
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.72);
}

.detail-skeleton-meta-item .detail-skeleton-icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
}

.detail-skeleton-meta-item .detail-skeleton-line {
  width: 64%;
  height: 14px;
}

@keyframes detail-skeleton-shimmer {
  0% {
    background-position: -240px 0;
  }

  100% {
    background-position: calc(240px + 100%) 0;
  }
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
    --detail-side-col: minmax(416px, 448px);
  }
}

@media (max-width: 1180px) {
  .detail-left-panel {
    display: none;
  }

  .detail-board.left-panel-active .detail-left-panel {
    display: flex;
  }

  .detail-board.left-panel-active .detail-main-panel,
  .detail-board.left-panel-active .detail-side-panel {
    display: none;
  }

  .detail-board {
    grid-template-columns: minmax(0, 1fr);
    overflow: auto;
  }

  .detail-board.left-panel-active {
    grid-template-columns: minmax(0, 1fr);
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
