<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import IconCheck from '~icons/lucide/check'
import IconChevronLeft from '~icons/lucide/chevron-left'
import IconChevronRight from '~icons/lucide/chevron-right'
import IconInbox from '~icons/lucide/inbox'
import IconLayoutList from '~icons/lucide/layout-list'
import IconPresentation from '~icons/lucide/presentation'
import IconSend from '~icons/lucide/send'
import IconSquareCheck from '~icons/lucide/square-check'
import { routeConfig } from '@/config/route.config'
import { isDesktopUserMismatch } from '@/modules/auth/desktop-auth'
import AppStateBlock from '@/shared/components/state/AppStateBlock.vue'
import { useFeedbackStore } from '@/stores/feedback.store'
import HomePanelToolDock from './components/HomePanelToolDock.vue'
import TodoDetailViewPanel from './components/TodoDetailViewPanel.vue'
import TodoQuickCreateBar from './components/TodoQuickCreateBar.vue'
import DashboardTopBar from './DashboardTopBar.vue'
import DayPreviewPanel from './DayPreviewPanel.vue'
import {
  eventTypeLabel,
  filterEventsByScope,
  filterEventsByType,
  isMeetingEvent,
  type TodoScopeFilter,
  type TodoTypeFilter,
} from './helpers/dayPreviewPanel.helpers'
import {
  clearDesktopTodoDetailQuery as buildClearedDesktopTodoDetailQuery,
  getDesktopTodoDetailRequest,
} from './helpers/desktopTodoQuery'
import { navigateDashboardTool, type DashboardToolTarget } from './config/dashboardTools'
import { resolveHomeGreetingText } from './helpers/homeTimeOfDay'
import { DASHBOARD_ONBOARDING_TOUR_CLOSE_DAY_PREVIEW_EVENT } from './helpers/onboardingTour'
import { specialDays } from './config/calendar-special-days/2026'
import type {
  CalendarEvent,
  CalendarEventStatus,
  CalendarSpecialDay,
  CalendarTodoDraft,
  CalendarTodoUpdate,
  TodoOpenSource,
} from './config/types'
import {
  compareEvents,
  countTodoScopeEvents,
  formatEventTime,
  formatEventTimeForDayList,
  getTodoListDisplayText,
  getTodoScopeBadge,
  isRejectedTodo,
  isRangeEvent,
  isSameDayRangeEvent,
  ymd,
} from './helpers/todoDisplay'
import {
  buildTodoDetailPanelViewModel,
  canDeleteTodoEvent,
  canEditTodoEvent,
  isPendingAcceptanceTask,
  mergeCalendarEventWithDetail,
  resolveCalendarEventDetail,
  storeCalendarEventDetail,
} from './helpers/todoDetailPanel.helpers'
import {
  acceptTodos,
  createTodo as serviceCreateTodo,
  deleteTodo as serviceDeleteTodo,
  getTodoMonthRange,
  getTodoWeekRange,
  loadTodoDetail,
  rejectTodo,
  updateTodo as serviceUpdateTodo,
} from './services/todo.service'
import { useDashboardTodos } from './composables/useDashboardTodos'
import { runDashboardTodoAction } from './helpers/dashboardTodoActions'
import { useDashboardGlassSettings } from './composables/useDashboardGlassSettings'
import { useTodoDetailCache } from './composables/useTodoDetailCache'

type HomePanelMode = 'view' | 'edit' | 'create'

type DayPreviewPanelExpose = {
  showDiscardWarning: (onConfirm?: () => void) => void
  openCreateForm: () => void
  openEditFormById: (id: string) => boolean
}

const props = defineProps<{
  selectedDate: string
}>()

const emit = defineEmits<{
  (event: 'switch-mode', mode: 'simple' | 'detail'): void
  (event: 'start-onboarding'): void
  (event: 'update:selectedDate', date: string): void
}>()

const now = ref(new Date())
const currentMonth = ref(new Date(now.value.getFullYear(), now.value.getMonth(), 1))
const isDayPreviewOpen = ref(false)
const homePanelMode = ref<HomePanelMode>('view')
const activePanelTaskId = ref('')
const pendingDeleteTaskId = ref('')
const pendingDeleteListTaskId = ref('')
const pendingActionProcessing = ref(false)
const panelTodoOpenSource = ref<TodoOpenSource>('calendar')
const deleteActionProcessing = ref(false)
const listDeleteActionProcessing = ref(false)
const quickCreatePrompt = ref('')
const homeQuickTodoText = ref('')
const quickCreateKey = ref(0)
const presetCreateTime = ref('')
const presetCreateKey = ref(0)
const isDayPreviewFormDirty = ref(false)
const dayPreviewPanelRef = ref<DayPreviewPanelExpose | null>(null)
const dayPreviewEditPanelRef = ref<DayPreviewPanelExpose | null>(null)
const homeMainPanelRef = ref<HTMLElement | null>(null)
const calendarViewMode = ref<'month' | 'week'>('month')
const homeTodoCategoryFilter = ref<TodoTypeFilter>('all')
const homeTodoScopeFilter = ref<TodoScopeFilter>('all')
const route = useRoute()
const router = useRouter()
const feedbackStore = useFeedbackStore()
const { glassStyle } = useDashboardGlassSettings()
let clockTimer: ReturnType<typeof setInterval> | undefined
let isConsumingDesktopTodoText = false
let isConsumingDesktopTodoDetail = false

const {
  assignableUsers,
  currentUser,
  eventMap,
  initializeDashboardTodos,
  isLoading,
  isTodoStatusUpdating,
  refreshTodos,
  updateTodoStatusOptimistically,
} = useDashboardTodos({
  getLoadRange: getActiveTodoLoadRange,
  onUnauthorized: redirectToLogin,
})

const {
  taskDetails,
  detailLoadingId,
  loadTaskDetail: loadCachedTaskDetail,
} = useTodoDetailCache({
  currentUser,
  assignableUsers,
  onError: () => showToast('查询待办详情失败', 'error'),
})

onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = new Date()
  }, 60_000)
  window.addEventListener(
    DASHBOARD_ONBOARDING_TOUR_CLOSE_DAY_PREVIEW_EVENT,
    handleTourCloseDayPreview,
  )
  void initializeDashboardData()
})

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
  window.removeEventListener(
    DASHBOARD_ONBOARDING_TOUR_CLOSE_DAY_PREVIEW_EVENT,
    handleTourCloseDayPreview,
  )
})

let hasInitializedTodoRange = false

const specialDayMap = computed(() => {
  const map = new Map<string, CalendarSpecialDay[]>()
  for (const item of specialDays) {
    if (item.type === 'solar-term') continue

    const list = map.get(item.date) ?? []
    list.push(item)
    map.set(item.date, list)
  }
  return map
})

const todayDate = computed(() => ymd(now.value))
const isSelectedToday = computed(() => props.selectedDate === todayDate.value)
const selectedEvents = computed(() => eventMap.value.get(props.selectedDate) ?? [])
const activePanelTask = computed(() => {
  if (!activePanelTaskId.value) return null

  const fromList = selectedEvents.value.find((event) => event.id === activePanelTaskId.value)
  const cached = taskDetails.value[activePanelTaskId.value]

  if (cached && fromList) {
    return mergeCalendarEventWithDetail(fromList, cached)
  }

  return fromList ?? cached ?? null
})
const panelTaskDetail = computed(() => {
  const task = activePanelTask.value
  if (!task) return null

  return buildTodoDetailPanelViewModel(
    resolveCalendarEventDetail(taskDetails.value, task),
    currentUser.value,
  )
})
const isPanelDetailLoading = computed(() =>
  Boolean(activePanelTaskId.value && detailLoadingId.value === activePanelTaskId.value),
)
const showPanelEditAction = computed(() => {
  const task = activePanelTask.value
  if (!task) return false
  return canEditTodoEvent(taskDetails.value[task.id] ?? task)
})
const showPanelDeleteAction = computed(() => {
  const task = activePanelTask.value
  if (!task) return false
  return canDeleteTodoEvent(taskDetails.value[task.id] ?? task, currentUser.value)
})
const showPanelPendingInboxActions = computed(() => {
  const task = activePanelTask.value
  if (!task) return false
  return isPendingAcceptanceTask(taskDetails.value[task.id] ?? task, currentUser.value)
})
const showPanelDetailFooter = computed(() => {
  if (panelTodoOpenSource.value === 'notification') return false
  if (panelTodoOpenSource.value === 'pending-inbox' && !showPanelPendingInboxActions.value) {
    return false
  }
  return true
})
const isPanelDeleteConfirming = computed(() =>
  Boolean(activePanelTaskId.value && pendingDeleteTaskId.value === activePanelTaskId.value),
)
const selectedSpecialDays = computed(() => specialDayMap.value.get(props.selectedDate) ?? [])
const selectedDayPreviewTasks = computed(() =>
  filterEventsByScope(
    filterEventsByType([...selectedEvents.value].sort(compareEvents), homeTodoCategoryFilter.value),
    homeTodoScopeFilter.value,
  ),
)
const assignedByMeCount = computed(() =>
  countTodoScopeEvents(selectedEvents.value, 'assigned_by_me'),
)
const assignedToMeCount = computed(() =>
  countTodoScopeEvents(selectedEvents.value, 'assigned_to_me'),
)
const homeTodoFilterColumns = computed(() => {
  let count = 3
  if (assignedByMeCount.value > 0) count += 1
  if (assignedToMeCount.value > 0) count += 1
  return count
})
const selectedDayAllCount = computed(() => selectedEvents.value.length)
const selectedDayTodoCount = computed(
  () => selectedEvents.value.filter((event) => !isMeetingEvent(event)).length,
)
const selectedDayMeetingCount = computed(
  () => selectedEvents.value.filter((event) => isMeetingEvent(event)).length,
)

watch(
  () => props.selectedDate,
  () => {
    homeTodoCategoryFilter.value = 'all'
    homeTodoScopeFilter.value = 'all'
  },
)
const currentWeekDates = computed(() => {
  const start = new Date(`${props.selectedDate}T12:00:00`)
  const offset = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - offset)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return ymd(date)
  })
})
const todoLoadRangeKey = computed(() => {
  const range =
    calendarViewMode.value === 'week'
      ? getTodoWeekRange(props.selectedDate)
      : getTodoMonthRange(currentMonth.value)

  return `${range.startDate}:${range.endDate}`
})
const homeWeekDays = computed(() =>
  currentWeekDates.value.map((date) => {
    const value = new Date(`${date}T12:00:00`)
    const events = eventMap.value.get(date) ?? []
    const hasMeeting = events.some((event) => isMeetingEvent(event))
    const hasTask = events.some((event) => !isMeetingEvent(event))

    return {
      date,
      day: value.getDate(),
      weekday: ['日', '一', '二', '三', '四', '五', '六'][value.getDay()],
      isToday: date === todayDate.value,
      isSelected: date === props.selectedDate,
      hasTask,
      hasMeeting,
    }
  }),
)
const homeFooterDateLabel = computed(() => {
  const date = new Date(`${props.selectedDate}T12:00:00`)
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
  return `${date.getMonth() + 1}月${date.getDate()}日 ${weekday}`
})
const homeWeekMonthLabel = computed(() => {
  const weekStart = new Date(`${currentWeekDates.value[0]}T12:00:00`)
  const weekEnd = new Date(`${currentWeekDates.value[6]}T12:00:00`)
  const startMonth = weekStart.getMonth() + 1
  const endMonth = weekEnd.getMonth() + 1

  if (startMonth === endMonth) return `${startMonth}月`

  return `${startMonth}/${endMonth}月`
})
const homeWeekStripAriaLabel = computed(() => {
  const start = new Date(`${currentWeekDates.value[0]}T12:00:00`)
  const end = new Date(`${currentWeekDates.value[6]}T12:00:00`)
  return `${start.getMonth() + 1}月${start.getDate()}日至${end.getMonth() + 1}月${end.getDate()}日`
})
const homeMainPanelAriaLabel = computed(() =>
  isSelectedToday.value ? '今日待办' : `${homeFooterDateLabel.value}待办`,
)
const homeTodoStatsAriaLabel = computed(() =>
  isSelectedToday.value ? '今日待办统计' : `${homeFooterDateLabel.value}待办统计`,
)
const homeTodoListAriaLabel = computed(() =>
  isSelectedToday.value ? '今日待办列表' : `${homeFooterDateLabel.value}待办列表`,
)
const homeTodoEmptyTitle = computed(() => {
  const dateLabel = isSelectedToday.value ? '今日' : homeFooterDateLabel.value
  if (homeTodoCategoryFilter.value === 'task') {
    return `${dateLabel}暂无待办事项`
  }
  if (homeTodoCategoryFilter.value === 'meeting') {
    return `${dateLabel}暂无会议信息`
  }
  return isSelectedToday.value ? '今日暂无待办' : `${homeFooterDateLabel.value}暂无待办`
})
const homeGreetingText = computed(() => resolveHomeGreetingText(now.value))
const homeGreetingDisplayName = computed(() =>
  currentUser.value.name && currentUser.value.name !== '未登录' ? currentUser.value.name : '刘美华',
)
const homeCornerClockHours = computed(() => String(now.value.getHours()).padStart(2, '0'))
const homeCornerClockMinutes = computed(() => String(now.value.getMinutes()).padStart(2, '0'))
const homeCornerClockDateParts = computed(() => {
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.value.getDay()]
  return {
    year: `${now.value.getFullYear()}年`,
    monthDay: `${now.value.getMonth() + 1}月${now.value.getDate()}日`,
    weekday,
  }
})
const homeCornerClockAriaLabel = computed(() => {
  const date = homeCornerClockDateParts.value
  return `${date.year}${date.monthDay} ${date.weekday}，当前时间 ${homeCornerClockHours.value}:${homeCornerClockMinutes.value}，${homeGreetingText.value}，${homeGreetingDisplayName.value}`
})
const homeCornerClockIso = computed(() => now.value.toISOString())
const selectedDateLabel = computed(() => {
  const date = new Date(`${props.selectedDate}T12:00:00`)
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekday}`
})

function selectDate(date: string, syncMonth = true) {
  emit('update:selectedDate', date)
  const nextDate = new Date(`${date}T12:00:00`)
  if (
    syncMonth &&
    (nextDate.getFullYear() !== currentMonth.value.getFullYear() ||
      nextDate.getMonth() !== currentMonth.value.getMonth())
  ) {
    currentMonth.value = new Date(nextDate.getFullYear(), nextDate.getMonth(), 1)
  }
}

function formatHomeTodoMeta(event: CalendarEvent) {
  return formatEventTimeForDayList(event, props.selectedDate, {
    isToday: isSelectedToday.value,
    todayText: '今天',
  })
}

function formatHomeTodoTimeTitle(event: CalendarEvent) {
  return formatEventTime(event)
}

function isCrossDayRangeOnList(event: CalendarEvent) {
  return isRangeEvent(event) && !isSameDayRangeEvent(event)
}

function selectHomeWeekDay(date: string) {
  if (props.selectedDate === date) return

  const switchDay = () => {
    selectDate(date, calendarViewMode.value === 'week')
  }

  if (
    isDayPreviewOpen.value &&
    homePanelMode.value !== 'create' &&
    homePanelMode.value !== 'edit' &&
    !confirmDiscardPreviewChanges(switchDay)
  ) {
    return
  }

  switchDay()
}

function shiftHomeWeek(dayOffset: number) {
  const shiftWeek = () => {
    const nextDate = new Date(`${props.selectedDate}T12:00:00`)
    nextDate.setDate(nextDate.getDate() + dayOffset)
    selectDate(ymd(nextDate), calendarViewMode.value === 'week')
  }

  if (
    isDayPreviewOpen.value &&
    homePanelMode.value !== 'create' &&
    homePanelMode.value !== 'edit' &&
    !confirmDiscardPreviewChanges(shiftWeek)
  ) {
    return
  }

  shiftWeek()
}

function openSelectedDayAddTodo() {
  const openCreate = () => {
    isDayPreviewFormDirty.value = false
    quickCreatePrompt.value = ''
    presetCreateTime.value = ''
    activePanelTaskId.value = ''
    selectDate(props.selectedDate)
    homePanelMode.value = 'create'
    openTodoPanel()
    void nextTick(() => {
      dayPreviewPanelRef.value?.openCreateForm()
    })
  }

  if (isDayPreviewOpen.value && !confirmDiscardPreviewChanges(openCreate)) return

  openCreate()
}

async function loadPanelTaskDetail(task: CalendarEvent, options?: { silent?: boolean }) {
  await loadCachedTaskDetail(task, {
    force: true,
    silent: options?.silent,
  })
}

async function refreshCalendarTodos() {
  const preserveTaskId =
    isDayPreviewOpen.value && homePanelMode.value === 'view' && activePanelTaskId.value
      ? activePanelTaskId.value
      : ''
  const preservedDetail = preserveTaskId ? taskDetails.value[preserveTaskId] : null

  await refreshTodos()

  if (!preserveTaskId) return

  const updatedTask = selectedEvents.value.find((event) => event.id === preserveTaskId)
  if (updatedTask) {
    taskDetails.value = storeCalendarEventDetail(
      taskDetails.value,
      mergeCalendarEventWithDetail(updatedTask, preservedDetail),
      preserveTaskId,
    )
    await loadPanelTaskDetail(updatedTask, { silent: Boolean(preservedDetail?.childTodos?.length) })
    return
  }

  if (preservedDetail) {
    await loadPanelTaskDetail(preservedDetail, { silent: true })
  }
}

function openHomePanel(mode: HomePanelMode, task?: CalendarEvent) {
  homePanelMode.value = mode
  activePanelTaskId.value = task?.id ?? ''
  pendingDeleteTaskId.value = ''
  if (mode === 'view' && task) {
    panelTodoOpenSource.value = 'calendar'
  }
  openTodoPanel()
}

function openSelectedDayView(event: CalendarEvent) {
  const openView = () => {
    isDayPreviewFormDirty.value = false
    quickCreatePrompt.value = ''
    presetCreateTime.value = ''
    selectDate(props.selectedDate)
    openHomePanel('view', event)
    void loadPanelTaskDetail(event)
  }

  if (isDayPreviewOpen.value && !confirmDiscardPreviewChanges(openView)) return

  openView()
}

function handleHomeTodoItemClick(task: CalendarEvent) {
  if (pendingDeleteListTaskId.value === task.id) return
  openSelectedDayView(task)
}

function openSelectedDayEdit(event: CalendarEvent) {
  const openEdit = () => {
    isDayPreviewFormDirty.value = false
    quickCreatePrompt.value = ''
    presetCreateTime.value = ''
    selectDate(props.selectedDate)
    openHomePanel('edit', event)
    void nextTick(() => {
      dayPreviewEditPanelRef.value?.openEditFormById(event.id)
    })
  }

  if (isDayPreviewOpen.value && !confirmDiscardPreviewChanges(openEdit)) return

  openEdit()
}

function switchPanelToEdit() {
  const task = activePanelTask.value
  if (!task || !showPanelEditAction.value) return

  homePanelMode.value = 'edit'
  void nextTick(() => {
    dayPreviewEditPanelRef.value?.openEditFormById(task.id)
  })
}

function requestCloseEditPanel(onConfirm?: () => void) {
  const close = () => {
    isDayPreviewFormDirty.value = false
    isDayPreviewOpen.value = false
    activePanelTaskId.value = ''
    pendingDeleteTaskId.value = ''
    onConfirm?.()
  }

  if (!isDayPreviewFormDirty.value) {
    close()
    return
  }

  dayPreviewEditPanelRef.value?.showDiscardWarning(close)
}

async function togglePanelTaskStatus() {
  const task = activePanelTask.value
  if (!task) return

  const updated = await toggleTodayTaskStatus(task)
  if (!updated) return

  const updatedTask = selectedEvents.value.find((event) => event.id === task.id)
  await loadPanelTaskDetail(updatedTask ?? task)
}

async function handleAcceptPanelTodo() {
  const task = activePanelTask.value
  if (!task || pendingActionProcessing.value) return

  pendingActionProcessing.value = true
  try {
    await acceptTodos([task.id])
    await refreshTodos()
    await loadPanelTaskDetail(task)
    showToast('已接受待办')
  } catch {
    // 全局拦截器已统一提示错误
  } finally {
    pendingActionProcessing.value = false
  }
}

async function handleRejectPanelTodo() {
  const task = activePanelTask.value
  if (!task || pendingActionProcessing.value) return

  pendingActionProcessing.value = true
  try {
    await rejectTodo(task.id, '暂不处理')
    await refreshTodos()
    closeDayPreview()
    showToast('已拒绝待办')
  } catch {
    // 全局拦截器已统一提示错误
  } finally {
    pendingActionProcessing.value = false
  }
}

function requestDeletePanelTask() {
  const task = activePanelTask.value
  if (!task || !showPanelDeleteAction.value || isPanelDetailLoading.value) return
  pendingDeleteTaskId.value = task.id
}

function cancelDeletePanelTask() {
  pendingDeleteTaskId.value = ''
}

async function confirmDeletePanelTask() {
  const task = activePanelTask.value
  if (!task || deleteActionProcessing.value) return

  deleteActionProcessing.value = true
  try {
    await deleteTodo(task.id)
    closeDayPreview()
  } finally {
    deleteActionProcessing.value = false
    pendingDeleteTaskId.value = ''
  }
}

function requestDeleteListTask(task: CalendarEvent) {
  if (!canDeleteTodoEvent(task, currentUser.value) || listDeleteActionProcessing.value) return
  pendingDeleteListTaskId.value = task.id
}

function cancelDeleteListTask() {
  pendingDeleteListTaskId.value = ''
}

async function confirmDeleteListTask(task: CalendarEvent) {
  if (!task || listDeleteActionProcessing.value || pendingDeleteListTaskId.value !== task.id) return

  listDeleteActionProcessing.value = true
  try {
    await deleteTodo(task.id)
    if (activePanelTaskId.value === task.id) {
      isDayPreviewOpen.value = false
      activePanelTaskId.value = ''
      pendingDeleteTaskId.value = ''
    }
    pendingDeleteListTaskId.value = ''
  } finally {
    listDeleteActionProcessing.value = false
  }
}

async function toggleTodayTaskStatus(event: CalendarEvent) {
  if (isTodoStatusUpdating(event.id)) return false

  if (event.completable === false) {
    showToast('当前待办不可由你完成', 'info')
    return false
  }

  const nextStatus: CalendarEventStatus = event.status === 'done' ? 'todo' : 'done'
  return updateTodoStatus(event.id, nextStatus)
}

function selectHomeTodoCategoryFilter(filter: TodoTypeFilter) {
  homeTodoCategoryFilter.value = filter
  homeTodoScopeFilter.value = 'all'
}

function selectHomeTodoScopeFilter(filter: Exclude<TodoScopeFilter, 'all'>) {
  homeTodoScopeFilter.value = homeTodoScopeFilter.value === filter ? 'all' : filter
  if (homeTodoScopeFilter.value !== 'all') {
    homeTodoCategoryFilter.value = 'all'
  }
}

function closeDayPreview() {
  const closePreview = () => {
    isDayPreviewOpen.value = false
    isDayPreviewFormDirty.value = false
    activePanelTaskId.value = ''
    pendingDeleteTaskId.value = ''
    panelTodoOpenSource.value = 'calendar'
  }

  if (!confirmDiscardPreviewChanges(closePreview)) return

  closePreview()
}

function handleTourCloseDayPreview() {
  if (!isDayPreviewOpen.value) return
  closeDayPreview()
}

function openTodoPanel() {
  isDayPreviewOpen.value = true
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
  if (type === 'error') {
    feedbackStore.error(message)
  } else if (type === 'info') {
    feedbackStore.info(message)
  } else {
    feedbackStore.success(message)
  }
}

async function initializeDashboardData() {
  const initialized = await initializeDashboardTodos()
  if (!initialized) return

  hasInitializedTodoRange = true
  await nextTick()
  await consumeDesktopTodoDetailQuery()
  consumeDesktopTodoText()
}

function redirectToLogin() {
  void router.replace({
    path: routeConfig.loginRoute,
    query: { redirect: router.currentRoute.value.fullPath },
  })
}

function getDesktopTodoTextQuery() {
  const value = route.query.desktopTodoText
  const text = Array.isArray(value) ? value[0] : value
  return typeof text === 'string' ? text.trim() : ''
}

function clearDesktopTodoTextQuery() {
  const query = { ...route.query }
  delete query.desktopTodoText

  void router.replace({
    path: route.path,
    query,
    hash: route.hash,
  })
}

function clearDesktopTodoDetailQuery() {
  void router.replace({
    path: route.path,
    query: buildClearedDesktopTodoDetailQuery(route.query),
    hash: route.hash,
  })
}

function hasDesktopAccountMismatch() {
  return isDesktopUserMismatch(route.query, currentUser.value.id)
}

async function consumeDesktopTodoDetailQuery() {
  if (isConsumingDesktopTodoDetail || !hasInitializedTodoRange) return false
  if (hasDesktopAccountMismatch()) return false

  const request = getDesktopTodoDetailRequest(route.query)
  if (!request) return false

  isConsumingDesktopTodoDetail = true
  try {
    await openTodoFromNotification({ id: request.todoId })
  } finally {
    clearDesktopTodoDetailQuery()
    isConsumingDesktopTodoDetail = false
  }

  return true
}

function consumeDesktopTodoText() {
  if (isConsumingDesktopTodoText || !hasInitializedTodoRange) return
  if (hasDesktopAccountMismatch()) return

  const prompt = getDesktopTodoTextQuery()
  if (!prompt) return

  isConsumingDesktopTodoText = true
  quickCreateTodo(prompt, todayDate.value)
  clearDesktopTodoTextQuery()
  isConsumingDesktopTodoText = false
}

function getActiveTodoLoadRange() {
  return calendarViewMode.value === 'week'
    ? getTodoWeekRange(props.selectedDate)
    : getTodoMonthRange(currentMonth.value)
}

watch(todoLoadRangeKey, () => {
  if (!hasInitializedTodoRange) return
  void refreshCalendarTodos()
})

watch(
  () => route.query.desktopTodoText,
  async () => {
    await nextTick()
    if (getDesktopTodoDetailRequest(route.query)) return
    consumeDesktopTodoText()
  },
)

watch(
  () => route.query.desktopTodoId,
  async () => {
    await nextTick()
    await consumeDesktopTodoDetailQuery()
    consumeDesktopTodoText()
  },
)

function confirmDiscardPreviewChanges(onConfirm?: () => void) {
  if (!isDayPreviewFormDirty.value) return true
  const panelRef = homePanelMode.value === 'edit' ? dayPreviewEditPanelRef : dayPreviewPanelRef
  panelRef.value?.showDiscardWarning(onConfirm)
  return false
}

function quickCreateTodo(prompt: string, date: string) {
  const createFromPrompt = () => {
    isDayPreviewFormDirty.value = false
    quickCreatePrompt.value = prompt
    presetCreateTime.value = ''
    quickCreateKey.value += 1
    activePanelTaskId.value = ''
    selectDate(date)
    homePanelMode.value = 'create'
    openTodoPanel()
  }

  if (isDayPreviewOpen.value && !confirmDiscardPreviewChanges(createFromPrompt)) return false

  createFromPrompt()
  return true
}

function submitHomeQuickTodo() {
  const prompt = homeQuickTodoText.value.trim()
  if (!prompt) return

  if (quickCreateTodo(prompt, props.selectedDate)) {
    homeQuickTodoText.value = ''
  }
}

function openHomePanelTool(tool: DashboardToolTarget) {
  void navigateDashboardTool(router, tool)
}

async function createTodo(payload: CalendarTodoDraft) {
  await runDashboardTodoAction(async () => {
    await serviceCreateTodo(payload)
    await refreshTodos()
    selectDate(payload.date)
    closeDayPreview()
    showToast('待办已创建')
  })
}

async function updateTodo(payload: CalendarTodoUpdate) {
  await runDashboardTodoAction(async () => {
    await serviceUpdateTodo(payload)
    await refreshTodos()
    isDayPreviewFormDirty.value = false
    homePanelMode.value = 'view'
    selectDate(payload.date)
    if (activePanelTaskId.value) {
      const task = selectedEvents.value.find((event) => event.id === activePanelTaskId.value)
      if (task) {
        await loadPanelTaskDetail(task)
      }
    }
    showToast('待办已保存')
  })
}

async function updateTodoStatus(id: string, status: CalendarEventStatus) {
  return runDashboardTodoAction(async () => {
    const updated = await updateTodoStatusOptimistically(id, status)
    if (!updated) throw new Error('待办状态正在更新')

    showToast(status === 'done' ? '已标记完成' : '已撤销完成')
  })
}

async function deleteTodo(id: string) {
  isDayPreviewFormDirty.value = false
  await runDashboardTodoAction(async () => {
    await serviceDeleteTodo(id)
    await refreshTodos()
    showToast('待办已删除')
  })
}

async function openTodoFromNotification(payload: {
  id: string
  date?: string
  source?: TodoOpenSource
}) {
  let targetDate = payload.date
  let cachedDetail: CalendarEvent | null = null

  if (!targetDate) {
    try {
      cachedDetail = await loadTodoDetail(payload.id, currentUser.value, assignableUsers.value)
      targetDate = cachedDetail.date
    } catch {
      showToast('查询消息关联待办失败', 'error')
      return
    }
  }

  isDayPreviewFormDirty.value = false
  panelTodoOpenSource.value = payload.source ?? 'calendar'
  selectDate(targetDate)
  activePanelTaskId.value = payload.id
  homePanelMode.value = 'view'
  openTodoPanel()
  await refreshTodos()

  const task = selectedEvents.value.find((event) => event.id === payload.id)
  if (task) {
    await loadPanelTaskDetail(task)
    return
  }

  if (!cachedDetail) {
    try {
      cachedDetail = await loadTodoDetail(payload.id, currentUser.value, assignableUsers.value)
    } catch {
      showToast('查询待办详情失败', 'error')
      closeDayPreview()
      return
    }
  }

  taskDetails.value = storeCalendarEventDetail(taskDetails.value, cachedDetail, payload.id)
}

defineExpose({
  refreshTodos: refreshCalendarTodos,
  openTodoFromNotification,
})
</script>

<template>
  <div class="calendar-workspace" @click="closeDayPreview">
    <div class="home-time-mark" :aria-label="homeCornerClockAriaLabel" aria-live="polite">
      <time class="home-time-mark__date" :datetime="todayDate">
        <span>{{ homeCornerClockDateParts.year }}</span>
        <strong>{{ homeCornerClockDateParts.monthDay }}</strong>
        <em>{{ homeCornerClockDateParts.weekday }}</em>
      </time>
      <time class="home-time-mark__time" :datetime="homeCornerClockIso">
        <span>{{ homeCornerClockHours }}</span>
        <span class="home-time-mark__colon" aria-hidden="true">:</span>
        <span>{{ homeCornerClockMinutes }}</span>
      </time>
      <div class="home-time-mark__greeting" aria-hidden="true">
        <strong>{{ homeGreetingText }}，{{ homeGreetingDisplayName }}</strong>
      </div>
    </div>

    <section class="layout-column left-column" aria-label="日历与待办" @click.stop>
      <Transition name="day-preview-float">
        <aside
          v-if="isDayPreviewOpen"
          class="day-preview-popover"
          :class="{ 'is-detail-view': homePanelMode === 'view' }"
          :style="homePanelMode === 'view' ? undefined : glassStyle"
          aria-label="当天待办详情"
          data-tour-target="todo-create-panel"
          @click.stop
          @pointerdown.stop
        >
          <TodoDetailViewPanel
            v-if="homePanelMode === 'view' && activePanelTask"
            :panel="panelTaskDetail"
            :loading="isPanelDetailLoading"
            @close="closeDayPreview"
          >
            <template v-if="showPanelDetailFooter" #footer>
              <div
                class="detail-panel-actions"
                :class="{
                  'is-pending-inbox': showPanelPendingInboxActions,
                  'is-completed-detail':
                    (showPanelDeleteAction || showPanelEditAction) && !isPanelDeleteConfirming,
                  'is-delete-confirm': isPanelDeleteConfirming,
                }"
              >
                <template v-if="showPanelPendingInboxActions">
                  <button
                    type="button"
                    class="detail-action accept"
                    :disabled="pendingActionProcessing || isPanelDetailLoading"
                    @click="handleAcceptPanelTodo"
                  >
                    {{ pendingActionProcessing ? '处理中…' : '接受' }}
                  </button>
                  <button
                    type="button"
                    class="detail-action reject"
                    :disabled="pendingActionProcessing || isPanelDetailLoading"
                    @click="handleRejectPanelTodo"
                  >
                    拒绝
                  </button>
                </template>
                <template v-else-if="isPanelDeleteConfirming">
                  <span class="detail-delete-confirm">确定删除？</span>
                  <button
                    type="button"
                    class="detail-action secondary"
                    :disabled="deleteActionProcessing"
                    @click="cancelDeletePanelTask"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    class="detail-action delete"
                    :disabled="deleteActionProcessing"
                    @click="confirmDeletePanelTask"
                  >
                    {{ deleteActionProcessing ? '删除中…' : '确认删除' }}
                  </button>
                </template>
                <template v-else>
                  <button
                    v-if="showPanelDeleteAction"
                    type="button"
                    class="detail-action delete"
                    :disabled="isPanelDetailLoading"
                    @click="requestDeletePanelTask"
                  >
                    删除
                  </button>
                  <button
                    v-if="showPanelEditAction"
                    type="button"
                    class="detail-action secondary"
                    :disabled="isPanelDetailLoading"
                    @click="switchPanelToEdit"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    class="detail-action primary"
                    :class="{ 'is-syncing': isTodoStatusUpdating(activePanelTask.id) }"
                    :disabled="
                      activePanelTask.completable === false ||
                      isPanelDetailLoading ||
                      isTodoStatusUpdating(activePanelTask.id)
                    "
                    :aria-busy="isTodoStatusUpdating(activePanelTask.id)"
                    @click="togglePanelTaskStatus"
                  >
                    {{
                      isTodoStatusUpdating(activePanelTask.id)
                        ? '处理中...'
                        : activePanelTask.status === 'done'
                          ? '恢复待处理'
                          : '标记完成'
                    }}
                  </button>
                </template>
              </div>
            </template>
          </TodoDetailViewPanel>

          <DayPreviewPanel
            v-else-if="homePanelMode === 'edit' && activePanelTask"
            ref="dayPreviewEditPanelRef"
            form-only
            show-close
            :date="props.selectedDate"
            :date-label="selectedDateLabel"
            :events="[activePanelTask]"
            :special-days="selectedSpecialDays"
            :current-user="currentUser"
            :assignable-users="assignableUsers"
            @update-todo="updateTodo"
            @dirty-change="isDayPreviewFormDirty = $event"
            @notify="showToast"
            @close="requestCloseEditPanel()"
          />

          <DayPreviewPanel
            v-else-if="homePanelMode === 'create'"
            ref="dayPreviewPanelRef"
            form-only
            show-close
            :date="props.selectedDate"
            :date-label="selectedDateLabel"
            :events="selectedEvents"
            :special-days="selectedSpecialDays"
            :current-user="currentUser"
            :assignable-users="assignableUsers"
            :quick-create-prompt="quickCreatePrompt"
            :quick-create-key="quickCreateKey"
            :preset-create-time="presetCreateTime"
            :preset-create-key="presetCreateKey"
            @create-todo="createTodo"
            @dirty-change="isDayPreviewFormDirty = $event"
            @notify="showToast"
            @close="closeDayPreview"
          />
        </aside>
      </Transition>

      <section
        ref="homeMainPanelRef"
        class="home-main-panel dashboard-glass-surface"
        :style="glassStyle"
        :aria-label="homeMainPanelAriaLabel"
        data-tour-target="today-panel"
      >
        <DashboardTopBar
          embedded
          view-mode="simple"
          :portal-target="homeMainPanelRef"
          @calendar-refresh="refreshTodos"
          @open-todo="openTodoFromNotification"
          @start-onboarding="emit('start-onboarding')"
          @switch-mode="emit('switch-mode', $event)"
        />

        <header class="home-todo-calendar-header">
          <div class="home-todo-calendar-card">
            <div class="home-todo-calendar-left">
              <div class="home-week-row">
                <span class="home-week-month-label">{{ homeWeekMonthLabel }}</span>
                <div class="home-week-nav">
                  <button
                    type="button"
                    class="home-week-nav-btn"
                    aria-label="上一周"
                    @click.stop="shiftHomeWeek(-7)"
                  >
                    <IconChevronLeft aria-hidden="true" />
                  </button>
                  <div class="home-week-strip" :aria-label="homeWeekStripAriaLabel">
                    <button
                      v-for="day in homeWeekDays"
                      :key="day.date"
                      type="button"
                      :class="{
                        active: day.isSelected,
                        'is-today': day.isToday,
                      }"
                      :aria-label="`${day.date}${day.hasTask ? '，有待办' : ''}${day.hasMeeting ? '，有会议' : ''}`"
                      @click.stop="selectHomeWeekDay(day.date)"
                    >
                      <span>{{ day.weekday }}</span>
                      <strong>{{ day.day }}</strong>
                      <span
                        v-if="day.hasTask || day.hasMeeting"
                        class="home-week-day-dots"
                        aria-hidden="true"
                      >
                        <i v-if="day.hasTask" class="home-week-day-dot is-task"></i>
                        <i v-if="day.hasMeeting" class="home-week-day-dot is-meeting"></i>
                      </span>
                    </button>
                  </div>
                  <button
                    type="button"
                    class="home-week-nav-btn"
                    aria-label="下一周"
                    @click.stop="shiftHomeWeek(7)"
                  >
                    <IconChevronRight aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div class="home-todo-body">
          <div
            class="home-todo-filter-row"
            :style="{ '--home-todo-filter-columns': homeTodoFilterColumns }"
            :aria-label="homeTodoStatsAriaLabel"
          >
            <div class="home-todo-stats">
              <button
                type="button"
                class="home-todo-stat all-stat"
                :class="{
                  active: homeTodoCategoryFilter === 'all' && homeTodoScopeFilter === 'all',
                }"
                :aria-pressed="homeTodoCategoryFilter === 'all' && homeTodoScopeFilter === 'all'"
                :aria-label="`${isSelectedToday ? '今日' : homeFooterDateLabel}全部待办`"
                @click.stop="selectHomeTodoCategoryFilter('all')"
              >
                <span class="home-todo-stat-icon" aria-hidden="true">
                  <IconLayoutList />
                </span>
                <span class="home-todo-stat-copy">
                  <span>全部</span>
                  <strong>{{ selectedDayAllCount }}</strong>
                </span>
              </button>
              <button
                type="button"
                class="home-todo-stat task-stat"
                :class="{
                  active: homeTodoCategoryFilter === 'task' && homeTodoScopeFilter === 'all',
                }"
                :aria-pressed="homeTodoCategoryFilter === 'task' && homeTodoScopeFilter === 'all'"
                :aria-label="`${isSelectedToday ? '今日' : homeFooterDateLabel}待办事项`"
                @click.stop="selectHomeTodoCategoryFilter('task')"
              >
                <span class="home-todo-stat-icon" aria-hidden="true">
                  <IconSquareCheck />
                </span>
                <span class="home-todo-stat-copy">
                  <span>待办</span>
                  <strong>{{ selectedDayTodoCount }}</strong>
                </span>
              </button>
              <button
                type="button"
                class="home-todo-stat meeting-stat"
                :class="{
                  active: homeTodoCategoryFilter === 'meeting' && homeTodoScopeFilter === 'all',
                }"
                :aria-pressed="
                  homeTodoCategoryFilter === 'meeting' && homeTodoScopeFilter === 'all'
                "
                :aria-label="`${isSelectedToday ? '今日' : homeFooterDateLabel}会议信息`"
                @click.stop="selectHomeTodoCategoryFilter('meeting')"
              >
                <span class="home-todo-stat-icon" aria-hidden="true">
                  <IconPresentation />
                </span>
                <span class="home-todo-stat-copy">
                  <span>会议</span>
                  <strong>{{ selectedDayMeetingCount }}</strong>
                </span>
              </button>
              <button
                v-if="assignedByMeCount > 0"
                type="button"
                class="home-todo-stat outgoing-stat"
                :class="{ active: homeTodoScopeFilter === 'assigned_by_me' }"
                :aria-pressed="homeTodoScopeFilter === 'assigned_by_me'"
                :aria-label="`${isSelectedToday ? '今日' : homeFooterDateLabel}我派发的待办`"
                @click.stop="selectHomeTodoScopeFilter('assigned_by_me')"
              >
                <span class="home-todo-stat-icon" aria-hidden="true">
                  <IconSend />
                </span>
                <span class="home-todo-stat-copy">
                  <span>我派发</span>
                  <strong>{{ assignedByMeCount }}</strong>
                </span>
              </button>
              <button
                v-if="assignedToMeCount > 0"
                type="button"
                class="home-todo-stat incoming-stat"
                :class="{ active: homeTodoScopeFilter === 'assigned_to_me' }"
                :aria-pressed="homeTodoScopeFilter === 'assigned_to_me'"
                :aria-label="`${isSelectedToday ? '今日' : homeFooterDateLabel}别人派发的待办`"
                @click.stop="selectHomeTodoScopeFilter('assigned_to_me')"
              >
                <span class="home-todo-stat-icon" aria-hidden="true">
                  <IconInbox />
                </span>
                <span class="home-todo-stat-copy">
                  <span>派给我</span>
                  <strong>{{ assignedToMeCount }}</strong>
                </span>
              </button>
            </div>
          </div>

          <section class="home-todo-panel">
            <div class="home-todo-scroll" :aria-label="homeTodoListAriaLabel">
              <AppStateBlock
                v-if="isLoading"
                class="home-todo-empty-state"
                type="loading"
                title="正在加载待办"
                description="同步完成后会自动展示在这里。"
                size="sm"
                variant="inline"
              />
              <AppStateBlock
                v-else-if="!selectedDayPreviewTasks.length"
                class="home-todo-empty-state"
                type="empty"
                :title="homeTodoEmptyTitle"
                description="新增待办后会展示在这里。"
                size="sm"
                variant="inline"
              />
              <article
                v-for="task in selectedDayPreviewTasks"
                :key="task.id"
                class="home-todo-item"
                :class="{
                  selected: activePanelTaskId === task.id && isDayPreviewOpen,
                  'is-done': task.status === 'done',
                  'is-rejected': isRejectedTodo(task),
                  'is-delete-confirm': pendingDeleteListTaskId === task.id,
                  meeting: task.type === 'meeting',
                  todo: task.type !== 'meeting',
                  'scope-assigned_by_me': task.scope === 'assigned_by_me',
                  'scope-assigned_to_me': task.scope === 'assigned_to_me',
                }"
                @click="handleHomeTodoItemClick(task)"
              >
                <div class="home-todo-item-leading">
                  <div v-if="!isRejectedTodo(task)" class="home-todo-check-wrap" @click.stop>
                    <button
                      type="button"
                      class="home-todo-check"
                      :class="{
                        checked: task.status === 'done',
                        'is-syncing': isTodoStatusUpdating(task.id),
                      }"
                      :aria-label="task.status === 'done' ? '撤销完成' : '标记完成'"
                      :disabled="task.completable === false || isTodoStatusUpdating(task.id)"
                      :aria-busy="isTodoStatusUpdating(task.id)"
                      @click="toggleTodayTaskStatus(task)"
                    >
                      <IconCheck v-if="task.status === 'done'" aria-hidden="true" />
                    </button>
                  </div>
                  <time
                    class="home-todo-item-time"
                    :class="{
                      'is-range': isRangeEvent(task),
                      'is-cross-range': isCrossDayRangeOnList(task),
                    }"
                    :title="formatHomeTodoTimeTitle(task)"
                  >
                    {{ formatHomeTodoMeta(task) }}
                  </time>
                </div>
                <div class="home-todo-item-main">
                  <span
                    class="home-todo-type-tag"
                    :class="isMeetingEvent(task) ? 'is-meeting' : 'is-task'"
                  >
                    {{ eventTypeLabel(task) }}
                  </span>
                  <span
                    v-if="getTodoScopeBadge(task)"
                    class="todo-scope-badge home-todo-scope-badge"
                    :class="`tone-${getTodoScopeBadge(task)!.tone}`"
                  >
                    {{ getTodoScopeBadge(task)!.label }}
                  </span>
                  <span class="home-todo-item-title">{{ getTodoListDisplayText(task) }}</span>
                </div>
                <div class="home-todo-item-aside">
                  <div class="home-todo-item-actions" @click.stop>
                    <template v-if="pendingDeleteListTaskId === task.id">
                      <span class="home-todo-delete-prompt">确定删除？</span>
                      <button
                        type="button"
                        class="home-todo-action"
                        :disabled="listDeleteActionProcessing"
                        @click.stop="cancelDeleteListTask"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        class="home-todo-action delete-action"
                        :disabled="listDeleteActionProcessing"
                        @click.stop="confirmDeleteListTask(task)"
                      >
                        {{ listDeleteActionProcessing ? '删除中…' : '删除' }}
                      </button>
                    </template>
                    <template v-else>
                      <button
                        v-if="canEditTodoEvent(task)"
                        type="button"
                        class="home-todo-action edit-action"
                        @click.stop="openSelectedDayEdit(task)"
                      >
                        编辑
                      </button>
                      <button
                        v-if="canDeleteTodoEvent(task, currentUser)"
                        type="button"
                        class="home-todo-action delete-action"
                        @click.stop="requestDeleteListTask(task)"
                      >
                        删除
                      </button>
                    </template>
                  </div>
                  <span v-if="isRejectedTodo(task)" class="home-todo-status-tag is-rejected">
                    已拒绝
                  </span>
                  <span
                    v-else-if="task.status === 'done' && pendingDeleteListTaskId !== task.id"
                    class="home-todo-status-tag"
                  >
                    <IconCheck aria-hidden="true" />
                    已完成
                  </span>
                </div>
              </article>
            </div>

            <TodoQuickCreateBar
              v-model="homeQuickTodoText"
              variant="simple"
              embedded
              input-id="home-quick-todo"
              @full-create="openSelectedDayAddTodo"
              @submit="submitHomeQuickTodo"
            />
          </section>
        </div>

        <HomePanelToolDock data-tour-target="tool-dock" @select="openHomePanelTool" />
      </section>
    </section>
  </div>
</template>

<style scoped>
.calendar-workspace {
  --home-module-height: min(720px, calc(100% - 48px));
  --home-ink: #13203a;
  --home-muted: #6d7c93;
  position: relative;
  isolation: isolate;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding: 0;
  display: block;
  overflow: hidden;
}

.home-time-mark {
  position: absolute;
  top: clamp(32px, 4vh, 56px);
  left: clamp(32px, 2.4vw, 48px);
  z-index: 1;
  box-sizing: border-box;
  max-width: min(620px, calc(100vw - 96px));
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: clamp(12px, 1.6vh, 20px);
  padding: 0;
  pointer-events: none;
  user-select: none;
  --time-mark-fill: #ffffff;
  --time-mark-fill-soft: rgba(255, 255, 255, 0.9);
  --time-mark-shadow: 0 1px 2px rgba(10, 20, 38, 0.22), 0 4px 12px rgba(10, 20, 38, 0.18),
    0 12px 32px rgba(10, 20, 38, 0.12);
}

.home-time-mark__greeting {
  align-self: center;
  display: block;
  margin-left: 0;
  margin-top: 0;
  text-align: center;
  font-family:
    'SF Pro Text',
    -apple-system,
    BlinkMacSystemFont,
    'Helvetica Neue',
    'Segoe UI',
    sans-serif;
}

.home-time-mark__greeting strong {
  color: var(--time-mark-fill);
  font-size: clamp(30px, 2.8vw, 38px);
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 0.01em;
  text-shadow: var(--time-mark-shadow);
}

.home-time-mark__time {
  align-self: flex-start;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  font-family:
    'SF Pro Display',
    'SF Pro Text',
    -apple-system,
    BlinkMacSystemFont,
    'Helvetica Neue',
    'Segoe UI',
    sans-serif;
  margin: 0;
  font-size: clamp(76px, 7.6vw, 116px);
  font-weight: 600;
  line-height: 0.86;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.home-time-mark__time,
.home-time-mark__time span {
  color: var(--time-mark-fill);
  text-shadow:
    0 2px 4px rgba(10, 20, 38, 0.22),
    0 8px 24px rgba(10, 20, 38, 0.18),
    0 24px 48px rgba(10, 20, 38, 0.12);
}

.home-time-mark__colon {
  margin: 0 0.04em;
  opacity: 0.94;
  transform: translateY(-0.05em);
}

.home-time-mark__date {
  align-self: center;
  min-width: 0;
  margin-top: 0;
  margin-left: 0;
  display: inline-flex;
  align-items: baseline;
  justify-content: center;
  gap: 10px;
  font-family:
    'SF Pro Text',
    -apple-system,
    BlinkMacSystemFont,
    'Helvetica Neue',
    'Segoe UI',
    sans-serif;
  white-space: nowrap;
  font-size: clamp(20px, 1.9vw, 26px);
  line-height: 1;
}

.home-time-mark__date strong {
  color: var(--time-mark-fill);
  font-weight: 600;
  letter-spacing: 0.01em;
  text-shadow: var(--time-mark-shadow);
}

.home-time-mark__date em {
  color: var(--time-mark-fill-soft);
  font-style: normal;
  font-weight: 500;
  text-shadow: var(--time-mark-shadow);
}

.home-time-mark__date span {
  color: var(--time-mark-fill-soft);
  font-weight: 500;
  letter-spacing: 0.02em;
  text-shadow: var(--time-mark-shadow);
}

.dashboard-glass-surface {
  border: 1px solid rgba(255, 255, 255, var(--glass-border-opacity, 0.64));
  background: radial-gradient(
      circle at 22% 20%,
      rgba(255, 255, 255, var(--glass-highlight-opacity, 0.7)),
      rgba(255, 255, 255, 0) 34%
    ),
    linear-gradient(
      145deg,
      rgba(255, 255, 255, var(--glass-gradient-start, 0.28)),
      rgba(238, 246, 255, var(--glass-gradient-end, 0.2))
    ),
    rgba(248, 252, 255, var(--glass-base-opacity, 0.18));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.72),
    0 20px 36px -30px rgba(18, 38, 72, 0.4);
  backdrop-filter: blur(var(--glass-blur, 24px)) saturate(var(--glass-saturate, 1.16));
  -webkit-backdrop-filter: blur(var(--glass-blur, 24px)) saturate(var(--glass-saturate, 1.16));
}

.left-column {
  position: absolute;
  inset: 0;
  display: block;
  min-height: 0;
  pointer-events: none;
}

.home-main-panel,
.day-preview-popover {
  pointer-events: auto;
}

.home-main-panel {
  position: absolute;
  right: clamp(32px, 2.4vw, 48px);
  bottom: clamp(24px, 3.2vh, 40px);
  width: clamp(520px, 32vw, 660px);
  height: var(--home-module-height);
  max-height: var(--home-module-height);
  box-sizing: border-box;
  border-radius: 24px;
  padding: 12px 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
  isolation: isolate;
}

.home-main-panel :deep(.dashboard-topbar.is-embedded) {
  flex: 0 0 auto;
}

.home-todo-calendar-header {
  flex: 0 0 auto;
}

.home-todo-calendar-card {
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.58);
  min-height: 78px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.82);
}

.home-todo-calendar-left {
  min-width: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.home-week-row {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.home-week-month-label {
  flex: 0 0 auto;
  min-width: 42px;
  min-height: 34px;
  border-radius: 12px;
  background: rgba(67, 139, 255, 0.12);
  color: #438bff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  font-size: 13px;
  font-weight: 950;
  line-height: 1;
  white-space: nowrap;
}

.home-week-nav {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 4px;
}

.home-week-nav-btn {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.62);
  color: #64748b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.home-week-nav-btn:hover {
  background: rgba(67, 139, 255, 0.14);
  color: #3478f6;
}

.home-week-nav-btn:active {
  transform: scale(0.96);
}

.home-week-nav-btn svg {
  width: 16px;
  height: 16px;
  stroke-width: 2.5px;
}

.home-todo-body {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.58);
  padding: 7px 9px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.82);
}

.home-todo-filter-row {
  flex: 0 0 auto;
  min-width: 0;
}

.home-todo-stats {
  display: grid;
  grid-template-columns: repeat(var(--home-todo-filter-columns, 3), minmax(0, 1fr));
  gap: 10px;
  align-items: stretch;
  min-width: 0;
}

.home-todo-stat {
  min-width: 0;
  height: 100%;
  border: 0;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  padding: 10px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background 0.18s ease,
    transform 0.18s ease;
}

.home-todo-stat:hover,
.home-todo-stat.active {
  background: rgba(255, 255, 255, 0.92);
  transform: translateY(-1px);
}

.home-todo-stat.active {
  box-shadow: inset 0 0 0 1px rgba(67, 139, 255, 0.18);
}

.home-todo-stat-icon {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.home-todo-stat-icon svg {
  width: 16px;
  height: 16px;
}

.all-stat .home-todo-stat-icon {
  background: rgba(67, 139, 255, 0.14);
  color: #438bff;
}

.task-stat .home-todo-stat-icon {
  background: rgba(40, 200, 121, 0.14);
  color: #28c879;
}

.meeting-stat .home-todo-stat-icon {
  background: rgba(67, 139, 255, 0.14);
  color: #2f66c9;
}

.outgoing-stat .home-todo-stat-icon {
  background: rgba(14, 116, 144, 0.14);
  color: #0e7490;
}

.incoming-stat .home-todo-stat-icon {
  background: rgba(217, 119, 6, 0.14);
  color: #b45309;
}

.outgoing-stat.active {
  box-shadow: inset 0 0 0 1px rgba(14, 116, 144, 0.18);
}

.incoming-stat.active {
  box-shadow: inset 0 0 0 1px rgba(217, 119, 6, 0.18);
}

.home-todo-stat-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.home-todo-stat-copy > span {
  color: #6d7c93;
  font-size: 11px;
  line-height: 1.2;
  font-weight: 850;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.home-todo-stat-copy strong {
  color: var(--home-ink);
  font-size: 18px;
  line-height: 1;
  font-weight: 950;
}

.home-todo-panel {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.34);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
  overflow: hidden;
}

.home-todo-scroll {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 8px 6px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
}

.home-todo-empty-state {
  flex: 1 1 auto;
  min-height: 0;
  align-content: center;
  gap: 6px;
}

.home-todo-empty-state :deep(.app-state-block__copy) {
  gap: 4px;
}

.home-todo-item {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
  min-height: 50px;
  box-sizing: border-box;
  padding: 0 14px 0 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.692);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.42);
  overflow: hidden;
  cursor: pointer;
  transition:
    background 0.22s ease,
    border-color 0.22s ease,
    box-shadow 0.22s ease,
    transform 0.22s ease;
}

.home-todo-item.scope-assigned_by_me {
  background: linear-gradient(90deg, rgba(236, 254, 255, 0.72), rgba(255, 255, 255, 0)), #ffffff;
}

.home-todo-item.scope-assigned_to_me {
  background: linear-gradient(90deg, rgba(255, 251, 235, 0.82), rgba(255, 255, 255, 0)), #ffffff;
}

.home-todo-scope-badge {
  flex: 0 0 auto;
  max-width: 100%;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.2;
  white-space: nowrap;
}

.home-todo-item-leading {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.home-todo-check-wrap {
  display: grid;
  place-items: center;
  position: relative;
  z-index: 2;
  flex-shrink: 0;
}

.home-todo-check {
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

.home-todo-check.checked {
  border-color: #16a34a;
  background: linear-gradient(180deg, #22c55e, #16a34a);
  box-shadow:
    0 0 0 4px rgba(34, 197, 94, 0.12),
    0 8px 16px -10px rgba(22, 163, 74, 0.72);
}

.home-todo-check:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.home-todo-check.is-syncing:disabled {
  opacity: 0.72;
  cursor: wait;
}

.home-todo-check svg {
  width: 14px;
  height: 14px;
}

.home-todo-item:hover,
.home-todo-item:focus-within {
  background: rgba(255, 255, 255, 0.56);
  border-color: rgba(255, 255, 255, 0.78);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 8px 18px -16px rgba(67, 139, 255, 0.28);
}

.home-todo-item.selected {
  transform: translateX(2px);
  background: rgba(255, 255, 255, 0.88);
  box-shadow:
    inset 0 0 0 1px rgba(67, 139, 255, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 8px 18px -16px rgba(67, 139, 255, 0.34);
}

.home-todo-item.selected.scope-assigned_by_me {
  background: linear-gradient(90deg, rgba(207, 250, 254, 0.92), rgba(255, 255, 255, 0.24)), #ffffff;
  box-shadow:
    inset 0 0 0 1px rgba(14, 116, 144, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 8px 18px -16px rgba(14, 116, 144, 0.22);
}

.home-todo-item.selected.scope-assigned_to_me {
  background: linear-gradient(90deg, rgba(254, 243, 199, 0.96), rgba(255, 255, 255, 0.24)), #ffffff;
  box-shadow:
    inset 0 0 0 1px rgba(217, 119, 6, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 8px 18px -16px rgba(217, 119, 6, 0.18);
}

.home-todo-item.todo.selected {
  box-shadow:
    inset 0 0 0 1px rgba(30, 174, 118, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 8px 18px -16px rgba(30, 174, 118, 0.22);
}

.home-todo-item.meeting.selected {
  box-shadow:
    inset 0 0 0 1px rgba(52, 120, 246, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 8px 18px -16px rgba(52, 120, 246, 0.22);
}

.home-todo-item-main {
  min-width: 0;
  padding: 11px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.home-todo-item.is-delete-confirm {
  grid-template-columns: auto minmax(0, 1fr);
}

.home-todo-item.is-delete-confirm .home-todo-item-main {
  display: none;
}

.home-todo-item.is-delete-confirm .home-todo-item-aside {
  justify-content: flex-end;
}

.home-todo-item-aside {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
}

.home-todo-delete-prompt {
  flex: 0 0 auto;
  margin: 0;
  color: #b45309;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
}

.home-todo-item-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  max-width: 0;
  overflow: hidden;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    max-width 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    visibility 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.home-todo-item:hover .home-todo-item-actions,
.home-todo-item:focus-within .home-todo-item-actions,
.home-todo-item.selected .home-todo-item-actions,
.home-todo-item.is-delete-confirm .home-todo-item-actions {
  max-width: 160px;
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.home-todo-item.is-delete-confirm .home-todo-item-actions {
  max-width: 220px;
  gap: 4px;
}

.home-todo-item.is-done:hover .home-todo-item-actions,
.home-todo-item.is-done:focus-within .home-todo-item-actions,
.home-todo-item.is-done.selected .home-todo-item-actions,
.home-todo-item.is-done.is-delete-confirm .home-todo-item-actions {
  max-width: 160px;
}

.home-todo-item.is-done.is-delete-confirm .home-todo-item-actions {
  max-width: 220px;
}

.home-todo-action {
  min-height: 28px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #64748b;
  padding: 0 10px;
  font: inherit;
  font-size: 12px;
  font-weight: 850;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease;
}

.home-todo-action:hover {
  background: rgba(255, 255, 255, 0.72);
  color: #1f2f4d;
}

.home-todo-action.edit-action {
  color: #475569;
  background: rgba(241, 245, 249, 0.96);
  border: 1px solid rgba(226, 232, 240, 0.92);
}

.home-todo-action.edit-action:hover {
  background: rgba(226, 232, 240, 0.92);
  color: #1f2f4d;
}

.home-todo-action.delete-action {
  color: #dc2626;
  background: rgba(254, 226, 226, 0.72);
}

.home-todo-action.delete-action:hover {
  background: rgba(254, 202, 202, 0.92);
  color: #b91c1c;
}

.home-todo-item-title {
  flex: 1 1 0;
  min-width: 3.5rem;
  overflow: hidden;
  color: #0f172a;
  font-size: 14px;
  font-weight: 720;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition:
    color 0.22s ease,
    opacity 0.22s ease;
}

.home-todo-item-time {
  flex: 0 0 auto;
  min-width: 3.1rem;
  color: #64748b;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  line-height: 1.2;
  transition:
    color 0.22s ease,
    opacity 0.2s ease;
}

.home-todo-item-time.is-range {
  min-width: 3.6rem;
  font-size: 13px;
}

.home-todo-item-time.is-cross-range {
  min-width: 4.1rem;
  font-size: 13px;
}

.home-todo-item.todo .home-todo-item-time {
  color: #059669;
}

.home-todo-item.meeting .home-todo-item-time {
  color: #2563eb;
}

.home-todo-item.is-done .home-todo-item-time {
  color: #94a3b8;
}

.home-todo-type-tag {
  flex: 0 0 auto;
  min-height: 22px;
  border-radius: 999px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 850;
  line-height: 1;
  white-space: nowrap;
}

.home-todo-type-tag.is-task {
  background: rgba(218, 247, 232, 0.86);
  color: #08724f;
}

.home-todo-type-tag.is-meeting {
  background: rgba(219, 234, 254, 0.92);
  color: #2f66c9;
}

.home-todo-item.is-done .home-todo-type-tag {
  opacity: 0.72;
}

.home-todo-item.is-rejected {
  grid-template-columns: auto minmax(0, 1fr) auto;
  padding-left: 14px;
  background: linear-gradient(90deg, rgba(254, 242, 242, 0.92), rgba(255, 255, 255, 0.72));
  box-shadow: inset 0 0 0 1px rgba(220, 38, 38, 0.08);
}

.home-todo-item.is-rejected .home-todo-item-title {
  color: #991b1b;
}

.home-todo-item.is-rejected .home-todo-item-time {
  color: #b45309;
}

.home-todo-status-tag.is-rejected {
  border-color: rgba(220, 38, 38, 0.22);
  background: rgba(254, 226, 226, 0.92);
  color: #991b1b;
}

.home-todo-item.is-done {
  opacity: 0.85;
}

.home-todo-item.is-done .home-todo-item-title {
  color: #94a3b8;
  text-decoration: line-through;
}

.home-todo-status-tag {
  flex: 0 0 auto;
  position: relative;
  z-index: 1;
  min-height: 24px;
  border: 1px solid rgba(21, 128, 61, 0.2);
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.1);
  color: #15803d;
  padding: 0 8px 0 6px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}

.home-todo-status-tag svg {
  width: 12px;
  height: 12px;
  stroke-width: 3px;
}

.home-todo-item.is-done.meeting .home-todo-status-tag {
  border-color: rgba(37, 99, 235, 0.22);
  background: rgba(219, 234, 254, 0.92);
  color: #1d4ed8;
}

.home-week-strip {
  min-width: 0;
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  align-items: center;
  gap: 4px;
}

.home-week-strip button {
  position: relative;
  min-width: 0;
  height: 50px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #8b99ae;
  padding: 0;
  display: grid;
  grid-template-rows: 12px 28px;
  align-content: center;
  justify-items: center;
  row-gap: 2px;
  font: inherit;
  cursor: pointer;
}

.home-week-day-dots {
  position: absolute;
  left: 50%;
  bottom: -7px;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  pointer-events: none;
}

.home-week-day-dot {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  display: block;
  flex-shrink: 0;
}

.home-week-day-dot.is-task {
  background: #22c55e;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.72);
}

.home-week-day-dot.is-meeting {
  background: #3b82f6;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.72);
}

.home-week-strip button strong {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #5f6e84;
  font-size: 12px;
  font-weight: 950;
  line-height: 1;
}

.home-week-strip button span {
  height: 12px;
  color: #9aa6b8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
}

.home-week-strip button.active strong {
  background: #438bff;
  color: #ffffff;
  box-shadow: 0 8px 16px -10px rgba(67, 139, 255, 0.84);
}

.day-preview-popover {
  position: absolute;
  z-index: 999;
  top: auto;
  bottom: clamp(24px, 3.2vh, 40px);
  right: calc(clamp(32px, 2.4vw, 48px) + clamp(520px, 32vw, 660px) + 22px);
  width: min(530px, calc(100vw - 870px));
  height: var(--home-module-height);
  max-height: var(--home-module-height);
  min-width: 460px;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, var(--glass-border-opacity, 0.64));
  border-radius: 26px;
  background: radial-gradient(
      circle at 22% 20%,
      rgba(255, 255, 255, var(--glass-highlight-opacity, 0.7)),
      rgba(255, 255, 255, 0) 34%
    ),
    linear-gradient(
      145deg,
      rgba(255, 255, 255, var(--glass-gradient-start, 0.28)),
      rgba(238, 246, 255, var(--glass-gradient-end, 0.2))
    ),
    rgba(248, 252, 255, var(--glass-base-opacity, 0.18));
  padding: 0;
  overflow: hidden;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.72),
    0 20px 36px -30px rgba(18, 38, 72, 0.4);
  backdrop-filter: blur(var(--glass-blur, 24px)) saturate(var(--glass-saturate, 1.16));
  -webkit-backdrop-filter: blur(var(--glass-blur, 24px)) saturate(var(--glass-saturate, 1.16));
  transform: none;
}

.day-preview-popover.is-detail-view {
  border: 1px solid rgba(255, 255, 255, 0.88);
  background: linear-gradient(165deg, rgba(255, 255, 255, 0.98), rgba(246, 250, 255, 0.94));
  box-shadow:
    0 28px 72px -34px rgba(15, 23, 42, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.92);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.day-preview-popover.is-detail-view :deep(.todo-detail-view-panel) {
  height: 100%;
  min-height: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.day-preview-popover.is-detail-view :deep(.detail-panel-head) {
  background: rgba(255, 255, 255, 0.96);
}

.day-preview-popover.is-detail-view :deep(.detail-panel-footer) {
  background: rgba(255, 255, 255, 0.94);
}

.day-preview-popover :deep(.preview-panel),
.day-preview-popover :deep(.todo-detail-view-panel) {
  height: 100%;
  min-height: 0;
}

.day-preview-float-enter-active,
.day-preview-float-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.day-preview-float-enter-from,
.day-preview-float-leave-to {
  opacity: 0;
  transform: translate(12px, 0);
}

@media (max-width: 1280px) {
  .home-main-panel {
    width: min(600px, calc(100vw - 64px));
  }
}

@media (max-width: 1120px) {
  .calendar-workspace {
    overflow: auto;
    padding: 16px;
  }

  .home-time-mark {
    position: relative;
    top: auto;
    left: auto;
    max-width: 100%;
    margin: 4px 0 8px;
    align-items: flex-start;
  }

  .home-time-mark__time {
    font-size: clamp(54px, 15vw, 82px);
  }

  .left-column {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 16px;
    pointer-events: auto;
  }

  .home-main-panel {
    position: relative;
    top: auto;
    right: auto;
    bottom: auto;
    left: auto;
    width: 100%;
    min-height: 440px;
    height: auto;
    max-height: var(--home-module-height);
  }

  .day-preview-popover {
    position: relative;
    top: auto;
    right: auto;
    width: 100%;
    min-width: 0;
    height: 720px;
    max-height: calc(100vh - 32px);
    transform: none;
  }
}

@media (max-width: 760px) {
  .home-main-panel {
    height: auto;
    max-height: none;
    min-height: 0;
    padding: 16px;
  }

  .home-todo-stats {
    grid-template-columns: 1fr;
  }

  .home-todo-calendar-card {
    min-height: 74px;
    padding: 10px 12px;
  }
}
</style>
