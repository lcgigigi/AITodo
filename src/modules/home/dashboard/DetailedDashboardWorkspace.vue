<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import IconCheck from '~icons/lucide/check'
import { routeConfig } from '@/config/route.config'
import AppStateBlock from '@/shared/components/state/AppStateBlock.vue'
import { useFeedbackStore } from '@/stores/feedback.store'
import { useRouter } from 'vue-router'
import CalendarMonth from './CalendarMonth.vue'
import TodoQuickCreateBar from './components/TodoQuickCreateBar.vue'
import TodoDetailViewPanel from './components/TodoDetailViewPanel.vue'
import DayPreviewPanel from './DayPreviewPanel.vue'
import type { CalendarDay, CalendarEvent, CalendarTodoDraft, CalendarTodoUpdate } from './types'
import {
  compareEvents,
  formatEventTime,
  getEventScheduleDisplay,
  isCompletedTodoEvent,
  isRejectedTodo,
  matchesDetailCategoryFilter,
  matchesDetailStatusFilter,
  matchesTodoScopeFilter,
  isAllDayEvent,
  isRangeEvent,
  ymd,
  getTodoScopeBadge,
  countTodoScopeEvents,
  getTodoListDisplayText,
  type DetailCategoryFilter,
  type DetailStatusFilter,
  type TodoScopeFilter,
} from './todoDisplay'
import {
  buildTodoDetailPanelViewModel,
  canDeleteTodoEvent,
  canEditTodoEvent,
  getTaskTypeLabel,
  isPendingAcceptanceTask,
  mergeCalendarEventWithDetail,
  resolveCalendarEventDetail,
  storeCalendarEventDetail,
} from './todoDetailPanel.helpers'
import {
  acceptTodos,
  createTodo as serviceCreateTodo,
  deleteTodo as serviceDeleteTodo,
  getTodoMonthRange,
  getTodoWeekRange,
  loadTodoDetail,
  rejectTodo,
  updateTodo as serviceUpdateTodo,
} from './todo.service'
import { useDashboardTodos } from './useDashboardTodos'

type DayPreviewPanelExpose = {
  openCreateForm: () => void
  openEditFormById: (id: string) => boolean
  showDiscardWarning: (onConfirm?: () => void) => void
}

type LeftPanelMode = 'tools' | 'create' | 'detail' | 'edit'

type DetailMode = 'simple' | 'detail'

type CategoryFilterItem = {
  value: DetailCategoryFilter
  label: string
}

type StatusFilterItem = {
  value: Exclude<DetailStatusFilter, 'all'>
  label: string
}

const DEFAULT_CATEGORY_FILTER: DetailCategoryFilter = 'all'

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
const taskDetails = ref<Record<string, CalendarEvent>>({})
const categoryFilter = ref<DetailCategoryFilter>(DEFAULT_CATEGORY_FILTER)
const statusFilter = ref<DetailStatusFilter>('all')
const scopeFilter = ref<TodoScopeFilter>('all')
const activeTaskId = ref('')
const detailLoadingId = ref('')
const quickCreateText = ref('')
const leftPanelMode = ref<LeftPanelMode>('tools')
const isCreateFormDirty = ref(false)
const quickCreatePrompt = ref('')
const quickCreateKey = ref(0)
const dayPreviewPanelRef = ref<DayPreviewPanelExpose | null>(null)
const dayPreviewEditPanelRef = ref<DayPreviewPanelExpose | null>(null)
const isEditFormDirty = ref(false)
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
  isTodoStatusUpdating,
  loadError,
  refreshTodos: refreshDashboardTodos,
  initializeDashboardTodos,
  updateTodoStatusOptimistically,
} = useDashboardTodos({
  getLoadRange: getActiveTodoLoadRange,
  loadErrorFallback: '加载待办数据失败',
  onUnauthorized: redirectToLogin,
})

let hasInitializedTodoRange = false

const categoryFilters: CategoryFilterItem[] = [
  { value: 'all', label: '全部' },
  { value: 'task', label: '待办' },
  { value: 'meeting', label: '会议' },
]

const statusSubFilters: StatusFilterItem[] = [
  { value: 'pending', label: '待处理' },
  { value: 'done', label: '已完成' },
  { value: 'rejected', label: '已拒绝' },
]

const selectedDateEvents = computed(() => eventMap.value.get(props.selectedDate) ?? [])
const selectedDateLabel = computed(() => formatDateTitle(props.selectedDate))
const mainTitle = computed(() => (props.selectedDate === todayDate.value ? '今日待办' : '当日待办'))

const categoryFilterCounts = computed<Record<DetailCategoryFilter, number>>(() => ({
  all: selectedDateEvents.value.length,
  task: selectedDateEvents.value.filter((event) => event.type !== 'meeting').length,
  meeting: selectedDateEvents.value.filter((event) => event.type === 'meeting').length,
}))

const assignedByMeCount = computed(() =>
  countTodoScopeEvents(selectedDateEvents.value, 'assigned_by_me'),
)
const assignedToMeCount = computed(() =>
  countTodoScopeEvents(selectedDateEvents.value, 'assigned_to_me'),
)
const hasScopeFilters = computed(() => assignedByMeCount.value > 0 || assignedToMeCount.value > 0)

const filteredTasks = computed(() =>
  selectedDateEvents.value.filter(
    (event) =>
      matchesDetailCategoryFilter(event, categoryFilter.value) &&
      matchesDetailStatusFilter(event, statusFilter.value) &&
      matchesTodoScopeFilter(event, scopeFilter.value),
  ),
)

const sortedFilteredTasks = computed(() => [...filteredTasks.value].sort(compareTaskListEvents))

const taskListSections = computed(() => {
  const meetings = sortedFilteredTasks.value.filter(isMeetingEvent)
  const todoEvents = sortedFilteredTasks.value.filter((event) => !isMeetingEvent(event))
  const timed = todoEvents.filter((event) => !isAllDayEvent(event))
  const allDay = todoEvents.filter((event) => isAllDayEvent(event))
  const sections: Array<{ key: string; label: string; timeline: boolean; tasks: CalendarEvent[] }> = []

  if (meetings.length) {
    sections.push({ key: 'meeting', label: '会议安排', timeline: true, tasks: meetings })
  }
  if (timed.length) {
    sections.push({ key: 'timed', label: '时间安排', timeline: true, tasks: timed })
  }
  if (allDay.length) {
    sections.push({ key: 'allday', label: '全天事项', timeline: false, tasks: allDay })
  }

  return sections
})

const hasActiveTaskFilters = computed(
  () =>
    categoryFilter.value !== DEFAULT_CATEGORY_FILTER ||
    statusFilter.value !== 'all' ||
    scopeFilter.value !== 'all',
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
  if (categoryFilter.value === 'task' && statusFilter.value === 'pending') {
    return {
      title: '暂无待处理事项',
      desc: '当前没有需要继续推进的待办或已接受任务。',
    }
  }
  if (categoryFilter.value === 'task' && statusFilter.value === 'done') {
    return {
      title: '暂无已完成事项',
      desc: '完成待办后会在这里展示记录。',
    }
  }
  if (categoryFilter.value === 'task' && statusFilter.value === 'rejected') {
    return {
      title: '暂无已拒绝事项',
      desc: '已拒绝的待办会在这里展示记录。',
    }
  }
  if (categoryFilter.value === 'meeting' && statusFilter.value === 'pending') {
    return {
      title: '暂无待处理会议',
      desc: '当前没有需要继续推进的会议安排。',
    }
  }
  if (categoryFilter.value === 'meeting' && statusFilter.value === 'done') {
    return {
      title: '暂无已完成会议',
      desc: '已完成的会议会在这里展示记录。',
    }
  }
  if (categoryFilter.value === 'meeting' && statusFilter.value === 'rejected') {
    return {
      title: '暂无已拒绝会议',
      desc: '已拒绝的会议会在这里展示记录。',
    }
  }
  if (categoryFilter.value === 'meeting') {
    return {
      title: '暂无会议事项',
      desc: '当前日期没有会议安排，可切换筛选或创建新待办。',
    }
  }
  if (categoryFilter.value === 'task') {
    return {
      title: '暂无待办事项',
      desc: '当前日期没有待办安排，可切换筛选或创建新待办。',
    }
  }
  if (scopeFilter.value === 'assigned_by_me') {
    return {
      title: '暂无我派发的待办',
      desc: '你派发给别人的待办会在这里展示，便于跟进进度。',
    }
  }
  if (scopeFilter.value === 'assigned_to_me') {
    return {
      title: '暂无别人派发的待办',
      desc: '别人派发给你的待办会在这里展示。',
    }
  }
  return {
    title: '当前筛选下暂无待办',
    desc: '试试切换类型或状态筛选，或清除筛选查看全部安排。',
  }
})
const taskEmptyActionLabel = computed(() => {
  if (isLoading.value || filteredTasks.value.length) return ''
  if (!selectedDateEvents.value.length) return ''
  if (
    categoryFilter.value === 'all' &&
    statusFilter.value === 'all' &&
    scopeFilter.value === 'all'
  ) {
    return ''
  }
  return '查看全部'
})

const monthCalendarDays = computed(() => buildMonthCalendarDays())
const weekCalendarDays = computed(() => buildWeekCalendarDays())
const calendarDays = computed(() =>
  calendarViewMode.value === 'week' ? weekCalendarDays.value : monthCalendarDays.value,
)
const todoLoadRangeKey = computed(() => {
  const range = getActiveTodoLoadRange()
  return `${range.startDate}:${range.endDate}`
})

const activeTask = computed(() => {
  if (!activeTaskId.value) return null

  const cached = taskDetails.value[activeTaskId.value]
  const fromList =
    selectedDateEvents.value.find((event) => event.id === activeTaskId.value) ??
    findEventById(activeTaskId.value)

  if (cached && fromList) {
    return mergeCalendarEventWithDetail(fromList, cached)
  }

  return fromList ?? cached ?? null
})

const showPendingInboxActions = computed(() => {
  if (!activeTask.value) return false
  if (pendingInboxDetailActive.value) return true
  return isPendingAcceptanceTask(getTaskDetail(activeTask.value), currentUser.value)
})

const taskDetailPanel = computed(() => {
  const task = activeTask.value
  if (!task) return null

  return buildTodoDetailPanelViewModel(getTaskDetail(task), currentUser.value)
})

const showDetailEditAction = computed(() => {
  const task = activeTask.value
  if (!task) return false
  return canEditTodoEvent(getTaskDetail(task))
})

const isActiveDetailLoading = computed(
  () => Boolean(activeTaskId.value && detailLoadingId.value === activeTaskId.value),
)

const showDetailDeleteAction = computed(() => {
  const task = activeTask.value
  if (!task) return false
  return canDeleteTodoEvent(getTaskDetail(task), currentUser.value)
})

const isDetailDeleteConfirming = computed(
  () => Boolean(activeTaskId.value && pendingDeleteTaskId.value === activeTaskId.value),
)

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
  if (leftPanelMode.value === 'edit') {
    requestCloseTaskEdit()
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
      taskDetails.value = storeCalendarEventDetail(
        taskDetails.value,
        mergeCalendarEventWithDetail(updatedTask, preservedDetail),
        preserveDetailId,
      )
    }
    await loadTaskDetail(updatedTask, true, { silent: Boolean(preservedDetail?.childTodos?.length) })
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
    taskDetails.value = storeCalendarEventDetail(taskDetails.value, detail, preserveDetailId)
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
    taskDetails.value = storeCalendarEventDetail(taskDetails.value, detailEvent, payload.id)
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
    if (leftPanelMode.value === 'detail') {
      closeTaskDetail()
    }
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

function selectCalendarDate(date: string) {
  updateSelectedDate(date)
  if (leftPanelMode.value === 'detail') {
    closeTaskDetail()
  }
  resetTaskFilters()
}

async function quickCreateFromCalendar(prompt: string, date: string) {
  updateSelectedDate(date)
  await nextTick()
  openCreateModal(prompt)
}

function openAgentCenter() {
  void router.push({ name: 'AgentCenter' })
}

function resetTaskFilters() {
  categoryFilter.value = DEFAULT_CATEGORY_FILTER
  statusFilter.value = 'all'
  scopeFilter.value = 'all'
}

function showAllTasks() {
  categoryFilter.value = 'all'
  statusFilter.value = 'all'
  scopeFilter.value = 'all'
}

function handleScopeFilterClick(nextFilter: Exclude<TodoScopeFilter, 'all'>) {
  scopeFilter.value = scopeFilter.value === nextFilter ? 'all' : nextFilter
}

function handleCategoryFilterClick(nextFilter: DetailCategoryFilter) {
  if (categoryFilter.value === nextFilter && statusFilter.value !== 'all') {
    statusFilter.value = 'all'
    scopeFilter.value = 'all'
    return
  }

  categoryFilter.value = nextFilter
  statusFilter.value = 'all'
  scopeFilter.value = 'all'
}

function isCategoryFilterActive(filter: DetailCategoryFilter) {
  if (categoryFilter.value !== filter) return false
  if (filter === 'all') return scopeFilter.value === 'all'
  return true
}

function handleStatusFilterClick(
  category: Exclude<DetailCategoryFilter, 'all'>,
  status: Exclude<DetailStatusFilter, 'all'>,
) {
  if (categoryFilter.value === category && statusFilter.value === status) {
    statusFilter.value = 'all'
    return
  }

  categoryFilter.value = category
  statusFilter.value = status
}

function getCategoryPoolEvents(filter: DetailCategoryFilter) {
  return selectedDateEvents.value.filter((event) => matchesDetailCategoryFilter(event, filter))
}

function getStatusCountForCategory(
  category: DetailCategoryFilter,
  status: Exclude<DetailStatusFilter, 'all'>,
) {
  const pool = getCategoryPoolEvents(category)
  return pool.filter((event) => matchesDetailStatusFilter(event, status)).length
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

  if (leftPanelMode.value === 'edit') {
    requestCloseTaskEdit(() => {
      void openTaskDetail(task)
    })
    return
  }

  pendingInboxDetailActive.value = false
  leftPanelMode.value = 'detail'
  activeTaskId.value = task.id
  pendingDeleteTaskId.value = ''
  await loadTaskDetail(task)
}

function openTaskEdit() {
  const task = activeTask.value
  if (!task || !showDetailEditAction.value) return

  leftPanelMode.value = 'edit'
  void nextTick(() => {
    dayPreviewEditPanelRef.value?.openEditFormById(task.id)
  })
}

function closeTaskEdit() {
  isEditFormDirty.value = false
  if (leftPanelMode.value === 'edit') {
    leftPanelMode.value = activeTaskId.value ? 'detail' : 'tools'
  }
}

function requestCloseTaskEdit(onConfirm?: () => void) {
  const close = () => {
    closeTaskEdit()
    onConfirm?.()
  }

  if (!isEditFormDirty.value) {
    close()
    return
  }

  dayPreviewEditPanelRef.value?.showDiscardWarning(close)
}

async function handleUpdateTodo(payload: CalendarTodoUpdate) {
  try {
    await serviceUpdateTodo(payload)
    await refreshTodos()
    closeTaskEdit()
    if (activeTaskId.value) {
      const task =
        selectedDateEvents.value.find((event) => event.id === activeTaskId.value) ??
        findEventById(activeTaskId.value)
      if (task) {
        await loadTaskDetail(task, true)
      }
    }
    feedbackStore.success('待办已保存')
  } catch {
    // 全局拦截器已统一提示错误。
  }
}

function closeTaskDetail() {
  activeTaskId.value = ''
  pendingInboxDetailActive.value = false
  pendingDeleteTaskId.value = ''
  if (leftPanelMode.value === 'detail' || leftPanelMode.value === 'edit') {
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
    taskDetails.value = storeCalendarEventDetail(taskDetails.value, detail, task.id)
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
  if (isTodoStatusUpdating(task.id)) return false

  if (task.completable === false) {
    feedbackStore.info('当前待办不可由你完成')
    return false
  }

  try {
    const nextStatus = task.status === 'done' ? 'todo' : 'done'
    const updated = await updateTodoStatusOptimistically(task.id, nextStatus)
    if (!updated) return

    if (activeTaskId.value === task.id) {
      const updatedTask = selectedDateEvents.value.find((event) => event.id === task.id)
      if (updatedTask) {
        await loadTaskDetail(updatedTask, true)
      }
    }
    feedbackStore.success(nextStatus === 'done' ? '已标记完成' : '已撤销完成')
    return true
  } catch {
    // 全局拦截器已统一提示错误。
    return false
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
}

function getTaskStatusLabel(task: CalendarEvent) {
  if (task.backendStatus === 6 || task.status === 'done') return '已完成'
  if (task.backendStatus === 9) return '已拒绝'
  if (task.backendStatus === 3) return '已接受'
  if (isPendingAcceptanceTask(task, currentUser.value)) return '待接受'
  return '待处理'
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

function isMeetingEvent(event: CalendarEvent) {
  return event.type === 'meeting'
}

function compareTaskListEvents(a: CalendarEvent, b: CalendarEvent) {
  if (isMeetingEvent(a) !== isMeetingEvent(b)) {
    return isMeetingEvent(a) ? -1 : 1
  }

  return compareEvents(a, b)
}

function getTaskTimeSub(task: CalendarEvent) {
  if (isTimedRangeEvent(task)) return ''
  if (isAllDayEvent(task)) return isMeetingEvent(task) ? '全天会议' : '全天事项'
  return ''
}

function isTimedRangeEvent(event: CalendarEvent) {
  return isRangeEvent(event) && Boolean(event.time || event.endTime)
}

function isSameDayRangeEvent(event: CalendarEvent) {
  return isRangeEvent(event) && (event.endDate ?? event.date) === event.date
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

function buildMonthCalendarDays(): CalendarDay[] {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const cursor = new Date(year, month, 1 - offset)

  return Array.from({ length: 42 }, () => {
    const date = ymd(cursor)
    const result: CalendarDay = {
      date,
      day: cursor.getDate(),
      inMonth: cursor.getFullYear() === year && cursor.getMonth() === month,
      isToday: date === todayDate.value,
      specialDays: [],
      events: eventMap.value.get(date) ?? [],
    }
    cursor.setDate(cursor.getDate() + 1)
    return result
  })
}

function getTaskDetail(task: CalendarEvent) {
  return resolveCalendarEventDetail(taskDetails.value, task)
}

function getTaskRemarkText(event: CalendarEvent) {
  const detail = getTaskDetail(event)
  return detail.remark?.trim() || ''
}

function formatDateTitle(date: string) {
  const value = new Date(`${date}T12:00:00`)
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][value.getDay()]
  return `${value.getFullYear()} 年 ${value.getMonth() + 1} 月 ${value.getDate()} 日 ${weekday}`
}

function formatTaskRangeStart(event: CalendarEvent) {
  const display = getEventScheduleDisplay(event)
  if (display.kind !== 'range') return ''
  if (isSameDayRangeEvent(event)) return display.start.time || display.start.date
  return `${display.start.date}${display.start.time ? ` ${display.start.time}` : ''}`
}

function formatTaskRangeEnd(event: CalendarEvent) {
  const display = getEventScheduleDisplay(event)
  if (display.kind !== 'range') return ''
  if (isSameDayRangeEvent(event)) return display.end.time || ''
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
      <section
        class="detail-calendar-panel"
        :class="{ 'is-week-mode': calendarViewMode === 'week' }"
        :aria-label="calendarViewMode === 'week' ? '周历' : '月历'"
      >
        <CalendarMonth
          :days="calendarDays"
          :selected-date="props.selectedDate"
          :month-label="monthLabel(currentMonth)"
          :week-label="weekRangeLabel(props.selectedDate)"
          :view-mode="calendarViewMode"
          @select="selectCalendarDate"
          @previous-period="changeCalendarPeriod(-1)"
          @next-period="changeCalendarPeriod(1)"
          @quick-create-todo="quickCreateFromCalendar"
          @open-agent-center="openAgentCenter"
          @update:view-mode="setCalendarViewMode"
        />
      </section>

      <main class="detail-main-panel" aria-label="当日待办清单">
        <div class="detail-main-body side-content-card">
          <header class="detail-main-header">
            <div class="todo-title-row">
              <h1>{{ mainTitle }}</h1>
              <div class="todo-date">{{ selectedDateLabel }}</div>
            </div>
          </header>

          <div class="filter-stack" :class="{ 'has-scope-filters': hasScopeFilters }" aria-label="待办筛选">
            <div class="filter-primary">
              <div class="filter-flow" role="tablist" aria-label="类型与状态筛选">
                <div
                  v-for="filter in categoryFilters"
                  :key="filter.value"
                  class="primary-filter-item"
                  :class="{ active: isCategoryFilterActive(filter.value) }"
                >
                  <button
                    type="button"
                    class="filter"
                    role="tab"
                    :class="{ active: isCategoryFilterActive(filter.value) }"
                    :aria-selected="isCategoryFilterActive(filter.value)"
                    @click="handleCategoryFilterClick(filter.value)"
                  >
                    {{ filter.label }}
                    <span class="filter-count">{{ categoryFilterCounts[filter.value] }}</span>
                  </button>
                  <div
                    v-if="filter.value !== 'all' && categoryFilter === filter.value"
                    class="inline-type-filters"
                    role="group"
                    aria-label="状态筛选"
                  >
                    <span class="inline-type-divider" aria-hidden="true"></span>
                    <button
                      v-for="statusItem in statusSubFilters"
                      :key="statusItem.value"
                      type="button"
                      class="type-filter"
                      :class="{ active: statusFilter === statusItem.value }"
                      :aria-pressed="statusFilter === statusItem.value"
                      @click="handleStatusFilterClick(filter.value, statusItem.value)"
                    >
                      {{ statusItem.label }}
                      <span class="type-count">{{
                        getStatusCountForCategory(filter.value, statusItem.value)
                      }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <template v-if="hasScopeFilters">
              <span class="filter-stack-divider" aria-hidden="true"></span>
              <div class="filter-secondary" role="group" aria-label="派发来源筛选">
                <div class="filter-secondary-flow">
                  <button
                    v-if="assignedByMeCount > 0"
                    type="button"
                    class="filter scope-filter scope-outgoing"
                    :class="{ active: scopeFilter === 'assigned_by_me' }"
                    :aria-pressed="scopeFilter === 'assigned_by_me'"
                    @click="handleScopeFilterClick('assigned_by_me')"
                  >
                    我派发
                    <span class="filter-count">{{ assignedByMeCount }}</span>
                  </button>
                  <button
                    v-if="assignedToMeCount > 0"
                    type="button"
                    class="filter scope-filter scope-incoming"
                    :class="{ active: scopeFilter === 'assigned_to_me' }"
                    :aria-pressed="scopeFilter === 'assigned_to_me'"
                    @click="handleScopeFilterClick('assigned_to_me')"
                  >
                    派给我
                    <span class="filter-count">{{ assignedToMeCount }}</span>
                  </button>
                </div>
              </div>
            </template>
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
                      rejected: isRejectedTodo(task),
                      allday: isAllDayEvent(task),
                      meeting: task.type === 'meeting',
                      todo: task.type !== 'meeting',
                      'scope-assigned_by_me': task.scope === 'assigned_by_me',
                      'scope-assigned_to_me': task.scope === 'assigned_to_me',
                    }"
                    @click="openTaskDetail(task)"
                  >
                    <div class="check-wrap" @click.stop>
                      <button
                        v-if="!isRejectedTodo(task)"
                        type="button"
                        class="task-check"
                        :class="{
                          checked: task.status === 'done',
                          'is-syncing': isTodoStatusUpdating(task.id),
                        }"
                        :aria-label="task.status === 'done' ? '撤销完成' : '标记完成'"
                        :disabled="task.completable === false || isTodoStatusUpdating(task.id)"
                        :aria-busy="isTodoStatusUpdating(task.id)"
                        @click="toggleTaskStatus(task)"
                      >
                        <IconCheck v-if="task.status === 'done'" aria-hidden="true" />
                      </button>
                    </div>

                    <div class="task-time-wrap" :class="{ 'has-range': isRangeEvent(task) }">
                      <div v-if="isRangeEvent(task)" class="task-time is-range">
                        <div class="task-time-range-rail" aria-hidden="true">
                          <span class="task-time-range-dot"></span>
                          <span class="task-time-range-bridge"></span>
                          <span class="task-time-range-dot"></span>
                        </div>
                        <div class="task-time-range-stack">
                          <span class="task-time-range-line">{{ formatTaskRangeStart(task) }}</span>
                          <span
                            v-if="formatTaskRangeEnd(task)"
                            class="task-time-range-line task-time-range-end"
                          >
                            {{ formatTaskRangeEnd(task) }}
                          </span>
                        </div>
                      </div>
                      <div v-else class="task-time">{{ formatEventTime(task) }}</div>
                      <div v-if="getTaskTimeSub(task)" class="task-time-sub">
                        {{ getTaskTimeSub(task) }}
                      </div>
                    </div>

                    <div class="task-main">
                      <div class="task-line">
                        <div class="task-name">{{ getTodoListDisplayText(task) }}</div>
                        <span
                          class="task-tag"
                          :class="task.type === 'meeting' ? 'meeting' : 'todo'"
                        >
                          {{ getTaskTypeLabel(task) }}
                        </span>
                        <span
                          v-if="getTodoScopeBadge(task)"
                          class="task-scope-badge"
                          :class="`tone-${getTodoScopeBadge(task)!.tone}`"
                        >
                          {{ getTodoScopeBadge(task)!.label }}
                        </span>
                      </div>
                      <div v-if="getTaskRemarkText(task)" class="task-sub">
                        备注：{{ getTaskRemarkText(task) }}
                      </div>
                    </div>

                    <div class="task-aside">
                      <div
                        class="task-status"
                        :class="{
                          done: task.status === 'done',
                          rejected: isRejectedTodo(task),
                        }"
                      >
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

      <Transition name="detail-drawer">
        <aside
          v-if="leftPanelMode !== 'tools'"
          class="detail-drawer-panel"
          :aria-label="
            leftPanelMode === 'create'
              ? '完整创建'
              : leftPanelMode === 'edit'
                ? '编辑待办'
                : '任务详情'
          "
        >
          <div v-if="leftPanelMode === 'create'" class="left-panel-create-card">
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

          <div v-else-if="leftPanelMode === 'edit' && activeTask" class="left-panel-create-card">
            <DayPreviewPanel
              ref="dayPreviewEditPanelRef"
              form-only
              show-close
              :date="props.selectedDate"
              :date-label="selectedDateLabel"
              :events="[activeTask]"
              :special-days="[]"
              :current-user="currentUser"
              :assignable-users="assignableUsers"
              @update-todo="handleUpdateTodo"
              @dirty-change="isEditFormDirty = $event"
              @notify="notifyFromPreview"
              @close="requestCloseTaskEdit()"
            />
          </div>

          <TodoDetailViewPanel
            v-else-if="leftPanelMode === 'detail' && activeTaskId"
            :panel="taskDetailPanel"
            :loading="isActiveDetailLoading"
            @close="closeTaskDetail"
          >
            <template v-if="activeTask" #footer>
              <div
                class="detail-panel-actions"
                :class="{
                  'is-pending-inbox': showPendingInboxActions,
                  'is-completed-detail':
                    (showDetailDeleteAction || showDetailEditAction) && !isDetailDeleteConfirming,
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
                    v-if="showDetailDeleteAction"
                    type="button"
                    class="detail-action delete"
                    :disabled="isActiveDetailLoading"
                    @click="requestDeleteActiveTask"
                  >
                    删除
                  </button>
                  <button
                    v-if="showDetailEditAction"
                    type="button"
                    class="detail-action secondary"
                    :disabled="isActiveDetailLoading"
                    @click="openTaskEdit"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    class="detail-action primary"
                    :class="{ 'is-syncing': isTodoStatusUpdating(activeTask.id) }"
                    :disabled="
                      activeTask.completable === false ||
                      isActiveDetailLoading ||
                      isTodoStatusUpdating(activeTask.id)
                    "
                    :aria-busy="isTodoStatusUpdating(activeTask.id)"
                    @click="toggleDetailTaskStatus"
                  >
                    {{
                      isTodoStatusUpdating(activeTask.id)
                        ? '处理中...'
                        : activeTask.status === 'done'
                          ? '恢复待处理'
                          : '标记完成'
                    }}
                  </button>
                </template>
              </div>
            </template>
          </TodoDetailViewPanel>
        </aside>
      </Transition>
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
  position: relative;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
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

.detail-calendar-panel {
  min-width: 0;
  min-height: 0;
  padding: 9px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.detail-calendar-panel :deep(.calendar-board) {
  width: 100%;
  min-height: 0;
  border-radius: 20px;
  border: 1px solid var(--content-card-border);
  background: var(--content-card-bg);
  box-shadow: var(--content-card-shadow);
  backdrop-filter: var(--content-card-blur);
  -webkit-backdrop-filter: var(--content-card-blur);
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

.detail-drawer-panel {
  position: absolute;
  z-index: 28;
  top: 9px;
  right: 9px;
  bottom: 9px;
  width: min(460px, calc(100% - 18px));
  min-height: 0;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 22px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.84), rgba(244, 249, 255, 0.72));
  box-shadow:
    0 28px 72px -34px rgba(15, 23, 42, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(26px) saturate(1.18);
  -webkit-backdrop-filter: blur(26px) saturate(1.18);
  padding: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-drawer-enter-active,
.detail-drawer-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}

.detail-drawer-enter-from,
.detail-drawer-leave-to {
  opacity: 0;
  transform: translateX(18px);
}

.left-panel-create-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 22px;
  background: transparent;
  border: 0;
  padding: 0;
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
  color: #166534;
  background: rgba(220, 252, 231, 0.94);
  border: 1px solid rgba(22, 163, 74, 0.22);
}

.detail-status-badge.done::before {
  content: '✓';
  margin-right: 5px;
  font-weight: 900;
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
  display: flex;
  flex-wrap: nowrap;
  gap: 10px;
}

.detail-panel-actions.is-completed-detail .detail-action {
  flex: 1 1 0;
  min-width: 0;
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

.detail-action.is-syncing:disabled {
  opacity: 0.72;
  cursor: wait;
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

.filter-stack.has-scope-filters {
  align-items: stretch;
  gap: 10px;
  min-height: 0;
}

.filter-stack.has-scope-filters .filter-primary {
  flex: 3 1 0;
  min-width: 0;
}

.filter-stack-divider {
  flex: 0 0 1px;
  align-self: stretch;
  margin: 6px 0;
  background: rgba(148, 163, 184, 0.28);
}

.filter-primary {
  min-width: 0;
}

.filter-secondary {
  flex: 2 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
}



.filter-secondary-flow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.filter-flow {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}

.filter-flow::-webkit-scrollbar {
  display: none;
}

.filter.scope-filter.active.scope-outgoing {
  color: #0e7490;
}

.filter.scope-filter.active.scope-incoming {
  color: #b45309;
}

.primary-filter-item {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px;
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
  height: 34px;
  padding: 0 14px;
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
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.inline-type-divider {
  flex: 0 0 auto;
  width: 1px;
  height: 18px;
  margin: 0 2px;
  background: rgba(118, 143, 178, 0.22);
}

.type-filter {
  height: 28px;
  padding: 0 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: 999px;
  border: 1px solid rgba(125, 151, 188, 0.16);
  color: #718097;
  background: rgba(255, 255, 255, 0.36);
  cursor: pointer;
  transition: 0.2s ease;
  white-space: nowrap;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
}

.type-filter:hover {
  color: #314f79;
  background: rgba(255, 255, 255, 0.78);
  border-color: rgba(125, 151, 188, 0.24);
}

.type-filter.active {
  color: #245797;
  background: rgba(52, 120, 246, 0.12);
  border-color: rgba(52, 120, 246, 0.28);
  box-shadow: none;
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
  min-height: 78px;
  margin: 0;
  padding: 9px 16px 9px 12px;
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

.task-card.rejected {
  background: linear-gradient(
    90deg,
    rgba(254, 226, 226, 0.72),
    rgba(255, 255, 255, 0.28) 54%,
    rgba(255, 255, 255, 0.06) 100%
  );
  box-shadow: inset 0 0 0 1px rgba(220, 38, 38, 0.08);
}

.task-card.rejected:hover {
  background: linear-gradient(
    90deg,
    rgba(254, 202, 202, 0.78),
    rgba(255, 255, 255, 0.34) 54%,
    rgba(255, 255, 255, 0.1) 100%
  );
  box-shadow: inset 0 0 0 1px rgba(220, 38, 38, 0.12);
}

.task-card.rejected .task-name {
  color: #991b1b;
}

.task-card.rejected .task-time,
.task-card.rejected .task-time-sub,
.task-card.rejected .task-sub {
  color: #b45309;
}

.task-card + .task-card {
  margin-top: 6px;
}

.task-card.scope-assigned_by_me {
  background: linear-gradient(90deg, rgba(236, 254, 255, 0.72), rgba(255, 255, 255, 0)), #ffffff;
}

.task-card.scope-assigned_to_me {
  background: linear-gradient(90deg, rgba(255, 251, 235, 0.82), rgba(255, 255, 255, 0)), #ffffff;
}

.task-scope-badge {
  flex: 0 0 auto;
  max-width: 100%;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.2;
  white-space: nowrap;
}

.task-scope-badge.tone-outgoing {
  color: #0e7490;
  background: rgba(207, 250, 254, 0.92);
  box-shadow: inset 0 0 0 1px rgba(14, 116, 144, 0.16);
}

.task-scope-badge.tone-incoming {
  color: #b45309;
  background: rgba(254, 243, 199, 0.96);
  box-shadow: inset 0 0 0 1px rgba(217, 119, 6, 0.18);
}

.task-card.todo {
  background: linear-gradient(
    90deg,
    rgba(30, 174, 118, 0.095),
    rgba(255, 255, 255, 0.25) 54%,
    rgba(255, 255, 255, 0.06) 100%
  );
}

.task-card.meeting {
  background: linear-gradient(
    90deg,
    rgba(52, 120, 246, 0.16),
    rgba(219, 234, 254, 0.34) 42%,
    rgba(255, 255, 255, 0.2) 100%
  );
  box-shadow: inset 0 0 0 1px rgba(52, 120, 246, 0.08);
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

.task-card.todo:hover {
  transform: translateX(3px);
  background: linear-gradient(
    90deg,
    rgba(30, 174, 118, 0.14),
    rgba(226, 250, 239, 0.42) 42%,
    rgba(255, 255, 255, 0.3) 100%
  );
}

.task-card.todo.selected {
  transform: translateX(3px);
  background: linear-gradient(
    90deg,
    rgba(30, 174, 118, 0.18),
    rgba(226, 250, 239, 0.5) 44%,
    rgba(255, 255, 255, 0.34) 100%
  );
  box-shadow: inset 0 0 0 1px rgba(30, 174, 118, 0.1);
}

.task-card.meeting:hover {
  transform: translateX(3px);
  background: linear-gradient(
    90deg,
    rgba(52, 120, 246, 0.2),
    rgba(219, 234, 254, 0.48) 42%,
    rgba(255, 255, 255, 0.32) 100%
  );
  box-shadow: inset 0 0 0 1px rgba(52, 120, 246, 0.12);
}

.task-card.meeting.selected {
  transform: translateX(3px);
  background: linear-gradient(
    90deg,
    rgba(52, 120, 246, 0.24),
    rgba(219, 234, 254, 0.56) 44%,
    rgba(255, 255, 255, 0.36) 100%
  );
  box-shadow: inset 0 0 0 1px rgba(52, 120, 246, 0.15);
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
  border-color: #16a34a;
  background: linear-gradient(180deg, #22c55e, #16a34a);
  box-shadow:
    0 0 0 4px rgba(34, 197, 94, 0.12),
    0 8px 16px -10px rgba(22, 163, 74, 0.72);
}

.task-check:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.task-check.is-syncing:disabled {
  opacity: 0.72;
  cursor: wait;
}

.task-check svg {
  width: 14px;
  height: 14px;
}

.task-time-wrap {
  position: relative;
  display: grid;
  gap: 5px;
  align-content: center;
  min-width: 0;
  min-height: 48px;
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

.task-card.todo .task-time-wrap::before {
  border-color: #8dd9bd;
  box-shadow: 0 0 0 4px rgba(30, 174, 118, 0.07);
}

.task-card.meeting .task-time-wrap::before {
  border-color: #84b2fb;
  box-shadow: 0 0 0 4px rgba(52, 120, 246, 0.07);
}

.task-card.allday.todo .task-time-wrap::before {
  background: #1eae76;
  box-shadow: 0 0 0 5px rgba(30, 174, 118, 0.08);
}

.task-card.allday.meeting .task-time-wrap::before {
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

.task-time-wrap.has-range {
  padding-left: 0;
}

.task-time-wrap.has-range::before {
  display: none;
}

.task-time.is-range {
  display: flex;
  align-items: stretch;
  gap: 8px;
  font-size: 14px;
  letter-spacing: -0.16px;
  line-height: 1;
  white-space: normal;
}

.task-time-range-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 12px;
  padding: 3px 0;
  flex-shrink: 0;
}

.task-time-range-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid rgba(52, 120, 246, 0.58);
  box-shadow: 0 0 0 2px rgba(52, 120, 246, 0.1);
  flex-shrink: 0;
}

.task-time-range-bridge {
  flex: 1;
  width: 2px;
  min-height: 14px;
  margin: 3px 0;
  border-radius: 999px;
  background: linear-gradient(
    180deg,
    rgba(52, 120, 246, 0.58) 0%,
    rgba(52, 120, 246, 0.28) 55%,
    rgba(52, 120, 246, 0.12) 100%
  );
}

.task-time-range-stack {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding: 1px 0;
}

.task-time-range-line {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-card.todo .task-time-range-dot {
  border-color: rgba(30, 174, 118, 0.62);
  box-shadow: 0 0 0 2px rgba(30, 174, 118, 0.1);
}

.task-card.todo .task-time-range-bridge {
  background: linear-gradient(
    180deg,
    rgba(30, 174, 118, 0.58) 0%,
    rgba(30, 174, 118, 0.28) 55%,
    rgba(30, 174, 118, 0.12) 100%
  );
}

.task-card.meeting .task-time-range-dot {
  border-color: rgba(52, 120, 246, 0.68);
  box-shadow: 0 0 0 2px rgba(52, 120, 246, 0.12);
}

.task-card.meeting .task-time-range-bridge {
  background: linear-gradient(
    180deg,
    rgba(52, 120, 246, 0.68) 0%,
    rgba(52, 120, 246, 0.34) 55%,
    rgba(52, 120, 246, 0.14) 100%
  );
}

.task-time-range-end {
  color: inherit;
  font-weight: inherit;
}

.task-time-sub {
  color: #8795aa;
  font-size: 11px;
  font-weight: 650;
}

.task-main {
  min-width: 0;
  padding: 2px 0;
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
  margin-top: 5px;
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

.task-tag.todo {
  color: #08724f;
  background: rgba(218, 247, 232, 0.86);
}

.task-tag.meeting {
  color: #2f66c9;
  background: rgba(219, 234, 254, 0.92);
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
  color: #166534;
  background: rgba(220, 252, 231, 0.9);
  border: 1px solid rgba(22, 163, 74, 0.22);
}

.task-status.done::before {
  content: '✓';
  margin-right: 5px;
  font-size: 12px;
  font-weight: 900;
}

.task-status.rejected {
  color: #991b1b;
  background: rgba(254, 226, 226, 0.92);
  border: 1px solid rgba(220, 38, 38, 0.22);
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
  color: #64748b;
  text-decoration: line-through;
  text-decoration-color: rgba(22, 101, 52, 0.36);
  text-decoration-thickness: 1.5px;
}

.task-card.completed,
.task-card.completed.todo,
.task-card.completed.selected,
.task-card.completed.todo.selected {
  background: linear-gradient(
    90deg,
    rgba(220, 252, 231, 0.52),
    rgba(248, 250, 252, 0.76) 44%,
    rgba(255, 255, 255, 0.34) 100%
  );
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.08);
}

.task-card.completed.meeting,
.task-card.completed.meeting.selected {
  background: linear-gradient(
    90deg,
    rgba(219, 234, 254, 0.56),
    rgba(248, 250, 252, 0.76) 44%,
    rgba(255, 255, 255, 0.34) 100%
  );
  box-shadow: inset 0 0 0 1px rgba(52, 120, 246, 0.1);
}

.task-card.completed:hover,
.task-card.completed.todo:hover {
  transform: translateX(2px);
  background: linear-gradient(
    90deg,
    rgba(187, 247, 208, 0.6),
    rgba(248, 250, 252, 0.86) 44%,
    rgba(255, 255, 255, 0.42) 100%
  );
  box-shadow: inset 0 0 0 1px rgba(34, 197, 94, 0.1);
}

.task-card.completed.meeting:hover {
  transform: translateX(2px);
  background: linear-gradient(
    90deg,
    rgba(191, 219, 254, 0.64),
    rgba(248, 250, 252, 0.86) 44%,
    rgba(255, 255, 255, 0.42) 100%
  );
  box-shadow: inset 0 0 0 1px rgba(52, 120, 246, 0.14);
}

.task-card.completed .task-time,
.task-card.completed .task-time-sub,
.task-card.completed .task-sub {
  color: #94a3b8;
}

.task-card.completed .task-tag {
  color: #64748b;
  background: rgba(226, 232, 240, 0.78);
}

.task-card.completed .task-arrow {
  color: #94a3b8;
}

.task-card.completed .task-time-wrap::before {
  border-color: #16a34a;
  background: #dcfce7;
  box-shadow: 0 0 0 5px rgba(34, 197, 94, 0.1);
}

.task-card.completed .task-time-range-dot {
  border-color: rgba(22, 163, 74, 0.55);
  background: #dcfce7;
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.1);
}

.task-card.completed .task-time-range-bridge {
  background: linear-gradient(
    180deg,
    rgba(22, 163, 74, 0.45) 0%,
    rgba(22, 163, 74, 0.2) 55%,
    rgba(22, 163, 74, 0.08) 100%
  );
}

.task-card.completed.meeting .task-time-wrap::before {
  border-color: #3478f6;
  background: #dbeafe;
  box-shadow: 0 0 0 5px rgba(52, 120, 246, 0.1);
}

.task-card.completed.meeting .task-time-range-dot {
  border-color: rgba(52, 120, 246, 0.62);
  background: #dbeafe;
  box-shadow: 0 0 0 2px rgba(52, 120, 246, 0.12);
}

.task-card.completed.meeting .task-time-range-bridge {
  background: linear-gradient(
    180deg,
    rgba(52, 120, 246, 0.55) 0%,
    rgba(52, 120, 246, 0.26) 55%,
    rgba(52, 120, 246, 0.1) 100%
  );
}

.task-card.completed.meeting .task-tag.meeting {
  color: #1d4ed8;
  background: rgba(219, 234, 254, 0.92);
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.22);
}

.task-card.completed.meeting .task-status.done {
  color: #1d4ed8;
  background: rgba(219, 234, 254, 0.92);
  border: 1px solid rgba(37, 99, 235, 0.22);
}

.side-content-card {
  background: var(--content-card-bg);
  border: 1px solid var(--content-card-border);
  border-radius: 16px;
  box-shadow: var(--content-card-shadow);
  backdrop-filter: var(--content-card-blur);
  -webkit-backdrop-filter: var(--content-card-blur);
}

@media (max-width: 1460px) {
  .filter-stack {
    gap: 8px;
  }

  .filter {
    padding: 0 11px;
  }

  .type-filter {
    padding: 0 10px;
  }

 
}

@media (max-width: 1180px) {
  .detail-board {
    grid-template-columns: minmax(0, 1fr);
    overflow: auto;
  }

  .detail-calendar-panel {
    min-height: 560px;
  }

  .detail-main-panel {
    border-bottom: 0;
  }

  .detail-drawer-panel {
    position: fixed;
    inset: auto 14px 14px;
    top: 86px;
    width: auto;
  }
}

@media (max-width: 900px) {
  .detail-workspace {
    width: calc(100% - 28px);
  }
}
</style>
