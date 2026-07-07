<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import IconCheck from '~icons/lucide/check'
import IconLayoutList from '~icons/lucide/layout-list'
import IconPresentation from '~icons/lucide/presentation'
import IconSquareCheck from '~icons/lucide/square-check'
import { routeConfig } from '@/config/route.config'
import AppStateBlock from '@/shared/components/state/AppStateBlock.vue'
import { useFeedbackStore } from '@/stores/feedback.store'
import HomePanelToolDock from './components/HomePanelToolDock.vue'
import TodoQuickCreateBar from './components/TodoQuickCreateBar.vue'
import DashboardTopBar from './DashboardTopBar.vue'
import DayPreviewPanel from './DayPreviewPanel.vue'
import { filterEventsByType, isMeetingEvent, type TodoTypeFilter } from './dayPreviewPanel.helpers'
import { navigateDashboardTool, type DashboardToolTarget } from './dashboardTools'
import { resolveHomeGreetingText } from './homeTimeOfDay'
import { DASHBOARD_ONBOARDING_TOUR_CLOSE_DAY_PREVIEW_EVENT } from './onboardingTour'
import type {
  CalendarEvent,
  CalendarEventStatus,
  CalendarSpecialDay,
  CalendarTodoDraft,
  CalendarTodoUpdate,
} from './types'
import { compareEvents, formatEventTime, isAllDayEvent } from './todoDisplay'
import {
  createTodo as serviceCreateTodo,
  deleteTodo as serviceDeleteTodo,
  getTodoMonthRange,
  getTodoWeekRange,
  loadTodoDetail,
  updateTodo as serviceUpdateTodo,
} from './todo.service'
import { useDashboardTodos } from './useDashboardTodos'
import { useDashboardGlassSettings } from './useDashboardGlassSettings'

type DayPreviewPanelExpose = {
  showDiscardWarning: (onConfirm?: () => void) => void
  openCreateForm: () => void
  openEventDetailById: (id: string) => boolean
  applyTypeFilter: (filter: TodoTypeFilter) => void
}

const props = defineProps<{
  selectedDate: string
}>()

const emit = defineEmits<{
  (event: 'switch-mode', mode: 'detail'): void
  (event: 'start-onboarding'): void
  (event: 'update:selectedDate', date: string): void
}>()

const now = ref(new Date())
const currentMonth = ref(new Date(now.value.getFullYear(), now.value.getMonth(), 1))
const isDayPreviewOpen = ref(false)
const quickCreatePrompt = ref('')
const homeQuickTodoText = ref('')
const quickCreateKey = ref(0)
const presetCreateTime = ref('')
const presetCreateKey = ref(0)
const isDayPreviewFormDirty = ref(false)
const dayPreviewPanelRef = ref<DayPreviewPanelExpose | null>(null)
const homeMainPanelRef = ref<HTMLElement | null>(null)
const calendarViewMode = ref<'month' | 'week'>('month')
const homeTodoCategoryFilter = ref<TodoTypeFilter>('all')
const route = useRoute()
const router = useRouter()
const feedbackStore = useFeedbackStore()
const { glassStyle } = useDashboardGlassSettings()
let clockTimer: ReturnType<typeof setInterval> | undefined
let isConsumingDesktopTodoText = false

const {
  assignableUsers,
  currentUser,
  eventMap,
  initializeDashboardTodos,
  isTodoStatusUpdating,
  isLoading,
  refreshTodos,
  statusUpdatingIds,
  updateTodoStatusOptimistically,
} = useDashboardTodos({
  getLoadRange: getActiveTodoLoadRange,
  onUnauthorized: redirectToLogin,
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

const specialDays: CalendarSpecialDay[] = [
  { date: '2026-01-01', name: '元旦', type: 'holiday' },
  { date: '2026-01-02', name: '元旦假期', type: 'holiday' },
  { date: '2026-01-03', name: '元旦假期', type: 'holiday' },
  { date: '2026-01-04', name: '调休上班', type: 'workday' },
  { date: '2026-02-14', name: '调休上班', type: 'workday' },
  { date: '2026-02-15', name: '春节假期', type: 'holiday' },
  { date: '2026-02-16', name: '春节假期', type: 'holiday' },
  { date: '2026-02-17', name: '春节', type: 'holiday' },
  { date: '2026-02-18', name: '春节假期', type: 'holiday' },
  { date: '2026-02-19', name: '春节假期', type: 'holiday' },
  { date: '2026-02-20', name: '春节假期', type: 'holiday' },
  { date: '2026-02-21', name: '春节假期', type: 'holiday' },
  { date: '2026-02-22', name: '春节假期', type: 'holiday' },
  { date: '2026-02-23', name: '春节假期', type: 'holiday' },
  { date: '2026-02-28', name: '调休上班', type: 'workday' },
  { date: '2026-04-04', name: '清明节', type: 'holiday' },
  { date: '2026-04-05', name: '清明假期', type: 'holiday' },
  { date: '2026-04-06', name: '清明假期', type: 'holiday' },
  { date: '2026-05-01', name: '劳动节', type: 'holiday' },
  { date: '2026-05-02', name: '劳动节假期', type: 'holiday' },
  { date: '2026-05-03', name: '劳动节假期', type: 'holiday' },
  { date: '2026-05-04', name: '劳动节假期', type: 'holiday' },
  { date: '2026-05-05', name: '劳动节假期', type: 'holiday' },
  { date: '2026-05-09', name: '调休上班', type: 'workday' },
  { date: '2026-06-19', name: '端午节', type: 'holiday' },
  { date: '2026-06-20', name: '端午假期', type: 'holiday' },
  { date: '2026-06-21', name: '端午假期', type: 'holiday' },
  { date: '2026-09-20', name: '调休上班', type: 'workday' },
  { date: '2026-09-25', name: '中秋节', type: 'holiday' },
  { date: '2026-09-26', name: '中秋假期', type: 'holiday' },
  { date: '2026-09-27', name: '中秋假期', type: 'holiday' },
  { date: '2026-10-01', name: '国庆节', type: 'holiday' },
  { date: '2026-10-02', name: '国庆假期', type: 'holiday' },
  { date: '2026-10-03', name: '国庆假期', type: 'holiday' },
  { date: '2026-10-04', name: '国庆假期', type: 'holiday' },
  { date: '2026-10-05', name: '国庆假期', type: 'holiday' },
  { date: '2026-10-06', name: '国庆假期', type: 'holiday' },
  { date: '2026-10-07', name: '国庆假期', type: 'holiday' },
  { date: '2026-10-10', name: '调休上班', type: 'workday' },
  { date: '2026-01-05', name: '小寒', type: 'solar-term' },
  { date: '2026-01-20', name: '大寒', type: 'solar-term' },
  { date: '2026-02-04', name: '立春', type: 'solar-term' },
  { date: '2026-02-18', name: '雨水', type: 'solar-term' },
  { date: '2026-03-05', name: '惊蛰', type: 'solar-term' },
  { date: '2026-03-20', name: '春分', type: 'solar-term' },
  { date: '2026-04-05', name: '清明', type: 'solar-term' },
  { date: '2026-04-20', name: '谷雨', type: 'solar-term' },
  { date: '2026-05-05', name: '立夏', type: 'solar-term' },
  { date: '2026-05-21', name: '小满', type: 'solar-term' },
  { date: '2026-06-05', name: '芒种', type: 'solar-term' },
  { date: '2026-06-21', name: '夏至', type: 'solar-term' },
  { date: '2026-07-07', name: '小暑', type: 'solar-term' },
  { date: '2026-07-23', name: '大暑', type: 'solar-term' },
  { date: '2026-08-07', name: '立秋', type: 'solar-term' },
  { date: '2026-08-23', name: '处暑', type: 'solar-term' },
  { date: '2026-09-07', name: '白露', type: 'solar-term' },
  { date: '2026-09-23', name: '秋分', type: 'solar-term' },
  { date: '2026-10-08', name: '寒露', type: 'solar-term' },
  { date: '2026-10-23', name: '霜降', type: 'solar-term' },
  { date: '2026-11-07', name: '立冬', type: 'solar-term' },
  { date: '2026-11-22', name: '小雪', type: 'solar-term' },
  { date: '2026-12-07', name: '大雪', type: 'solar-term' },
  { date: '2026-12-22', name: '冬至', type: 'solar-term' },
]

function ymd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

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
const selectedSpecialDays = computed(() => specialDayMap.value.get(props.selectedDate) ?? [])
const selectedDayPreviewTasks = computed(() =>
  filterEventsByType(
    [...selectedEvents.value].sort((a, b) => {
      const aDone = a.status === 'done' ? 1 : 0
      const bDone = b.status === 'done' ? 1 : 0
      if (aDone !== bDone) return aDone - bDone
      return compareEvents(a, b)
    }),
    homeTodoCategoryFilter.value,
  ),
)
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
    return {
      date,
      day: value.getDate(),
      weekday: ['日', '一', '二', '三', '四', '五', '六'][value.getDay()],
      isToday: date === todayDate.value,
      isSelected: date === props.selectedDate,
    }
  }),
)
const homeFooterDateLabel = computed(() => {
  const date = new Date(`${props.selectedDate}T12:00:00`)
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
  return `${date.getMonth() + 1}月${date.getDate()}日 ${weekday}`
})
const homeWeekMonthLabel = computed(() => {
  const date = new Date(`${props.selectedDate}T12:00:00`)
  return `${date.getMonth() + 1}月`
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
const homeGreetingDepartment = computed(() => currentUser.value.department ?? '信息技术部')
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
  return `${homeGreetingText.value}，${homeGreetingDisplayName.value}，${homeGreetingDepartment.value}，当前时间 ${homeCornerClockHours.value}:${homeCornerClockMinutes.value}，${date.year}${date.monthDay} ${date.weekday}`
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
  if (isAllDayEvent(event) && isSelectedToday.value) return '今天'
  return formatEventTime(event)
}

function selectHomeWeekDay(date: string) {
  if (props.selectedDate === date) return

  const switchDay = () => {
    isDayPreviewFormDirty.value = false
    quickCreatePrompt.value = ''
    presetCreateTime.value = ''
    selectDate(date, calendarViewMode.value === 'week')
  }

  if (isDayPreviewOpen.value && !confirmDiscardPreviewChanges(switchDay)) return

  switchDay()
}

function openSelectedDayAddTodo() {
  const openCreate = () => {
    isDayPreviewFormDirty.value = false
    quickCreatePrompt.value = ''
    presetCreateTime.value = ''
    selectDate(props.selectedDate)
    openTodoPanel()
    void nextTick(() => {
      dayPreviewPanelRef.value?.openCreateForm()
    })
  }

  if (isDayPreviewOpen.value && !confirmDiscardPreviewChanges(openCreate)) return

  openCreate()
}

function openSelectedDayTask(event: CalendarEvent) {
  const openDetail = () => {
    isDayPreviewFormDirty.value = false
    quickCreatePrompt.value = ''
    presetCreateTime.value = ''
    selectDate(props.selectedDate)
    openTodoPanel()
    void nextTick(() => {
      dayPreviewPanelRef.value?.applyTypeFilter(homeTodoCategoryFilter.value)
      dayPreviewPanelRef.value?.openEventDetailById(event.id)
    })
  }

  if (isDayPreviewOpen.value && !confirmDiscardPreviewChanges(openDetail)) return

  openDetail()
}

async function toggleTodayTaskStatus(event: CalendarEvent) {
  if (isTodoStatusUpdating(event.id)) return

  if (event.completable === false) {
    showToast('当前待办不可由你完成', 'info')
    return
  }

  const nextStatus: CalendarEventStatus = event.status === 'done' ? 'todo' : 'done'
  await updateTodoStatus(event.id, nextStatus)
}

function selectHomeTodoCategoryFilter(filter: TodoTypeFilter) {
  homeTodoCategoryFilter.value = filter

  if (!isDayPreviewOpen.value) return

  void nextTick(() => {
    dayPreviewPanelRef.value?.applyTypeFilter(filter)
  })
}

function closeDayPreview() {
  const closePreview = () => {
    isDayPreviewOpen.value = false
    isDayPreviewFormDirty.value = false
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

function consumeDesktopTodoText() {
  if (isConsumingDesktopTodoText || !hasInitializedTodoRange) return

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
  void refreshTodos()
})

watch(
  () => route.query.desktopTodoText,
  async () => {
    await nextTick()
    consumeDesktopTodoText()
  },
)

function confirmDiscardPreviewChanges(onConfirm?: () => void) {
  if (!isDayPreviewFormDirty.value) return true
  dayPreviewPanelRef.value?.showDiscardWarning(onConfirm)
  return false
}

function quickCreateTodo(prompt: string, date: string) {
  const createFromPrompt = () => {
    isDayPreviewFormDirty.value = false
    quickCreatePrompt.value = prompt
    presetCreateTime.value = ''
    quickCreateKey.value += 1
    selectDate(date)
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
  try {
    await serviceCreateTodo(payload)
    await refreshTodos()
    selectDate(payload.date)
    openTodoPanel()
    showToast('待办已创建')
  } catch {
    // 全局拦截器已统一提示错误
  }
}

async function updateTodo(payload: CalendarTodoUpdate) {
  try {
    await serviceUpdateTodo(payload)
    await refreshTodos()
    selectDate(payload.date)
    openTodoPanel()
    showToast('待办已保存')
  } catch {
    // 全局拦截器已统一提示错误
  }
}

async function updateTodoStatus(id: string, status: CalendarEventStatus) {
  try {
    const updated = await updateTodoStatusOptimistically(id, status)
    if (updated) {
      showToast(status === 'done' ? '已标记完成' : '已撤销完成')
    }
  } catch {
    // 全局拦截器已统一提示错误
  }
}

async function deleteTodo(id: string) {
  isDayPreviewFormDirty.value = false
  try {
    await serviceDeleteTodo(id)
    await refreshTodos()
    showToast('待办已删除')
  } catch {
    // 全局拦截器已统一提示错误
  }
}

async function openTodoFromNotification(payload: { id: string; date?: string }) {
  let targetDate = payload.date

  if (!targetDate) {
    try {
      const detailEvent = await loadTodoDetail(payload.id, currentUser.value, assignableUsers.value)
      targetDate = detailEvent.date
    } catch {
      showToast('查询消息关联待办失败', 'error')
      return
    }
  }

  isDayPreviewFormDirty.value = false
  selectDate(targetDate)
  openTodoPanel()
  await refreshTodos()
  await nextTick()
  dayPreviewPanelRef.value?.openEventDetailById(payload.id)
}

defineExpose({
  refreshTodos,
  openTodoFromNotification,
})
</script>

<template>
  <div class="calendar-workspace" @click="closeDayPreview">
    <div class="home-time-mark" :aria-label="homeCornerClockAriaLabel" aria-live="polite">
      <div class="home-time-mark__greeting" aria-hidden="true">
        <strong>{{ homeGreetingText }}，{{ homeGreetingDisplayName }}</strong>
        <span>{{ homeGreetingDepartment }}</span>
      </div>
      <time class="home-time-mark__time" :datetime="homeCornerClockIso">
        <span>{{ homeCornerClockHours }}</span>
        <span class="home-time-mark__colon" aria-hidden="true">:</span>
        <span>{{ homeCornerClockMinutes }}</span>
      </time>
      <time class="home-time-mark__date" :datetime="todayDate">
        <strong>{{ homeCornerClockDateParts.monthDay }}</strong>
        <em>{{ homeCornerClockDateParts.weekday }}</em>
        <span>{{ homeCornerClockDateParts.year }}</span>
      </time>
    </div>

    <section class="layout-column left-column" aria-label="日历与待办" @click.stop>
      <Transition name="day-preview-float">
        <aside
          v-if="isDayPreviewOpen"
          class="day-preview-popover"
          :style="glassStyle"
          aria-label="当天待办详情"
          data-tour-target="todo-create-panel"
          @click.stop
          @pointerdown.stop
        >
          <DayPreviewPanel
            ref="dayPreviewPanelRef"
            :date="props.selectedDate"
            :date-label="selectedDateLabel"
            :events="selectedEvents"
            :special-days="selectedSpecialDays"
            :current-user="currentUser"
            :assignable-users="assignableUsers"
            :status-updating-ids="statusUpdatingIds"
            :quick-create-prompt="quickCreatePrompt"
            :quick-create-key="quickCreateKey"
            :preset-create-time="presetCreateTime"
            :preset-create-key="presetCreateKey"
            show-close
            @create-todo="createTodo"
            @update-todo="updateTodo"
            @update-status="updateTodoStatus"
            @delete-todo="deleteTodo"
            @dirty-change="isDayPreviewFormDirty = $event"
            @notify="showToast"
            @close="closeDayPreview"
          />
        </aside>
      </Transition>

      <section
        ref="homeMainPanelRef"
        class="home-main-panel"
        :style="glassStyle"
        :aria-label="homeMainPanelAriaLabel"
        data-tour-target="today-panel"
      >
        <DashboardTopBar
          embedded
          :portal-target="homeMainPanelRef"
          @calendar-refresh="refreshTodos"
          @open-todo="openTodoFromNotification"
          @start-onboarding="emit('start-onboarding')"
          @switch-mode="emit('switch-mode', 'detail')"
        />

        <header class="home-todo-calendar-header">
          <div class="home-todo-calendar-card">
            <div class="home-todo-calendar-left">
              <div class="home-week-row">
                <span class="home-week-month-label">{{ homeWeekMonthLabel }}</span>
                <div class="home-week-strip" :aria-label="`${homeWeekMonthLabel}本周日期`">
                  <button
                    v-for="day in homeWeekDays"
                    :key="day.date"
                    type="button"
                    :class="{ active: day.isSelected, 'is-today': day.isToday }"
                    @click.stop="selectHomeWeekDay(day.date)"
                  >
                    <span>{{ day.weekday }}</span>
                    <strong>{{ day.day }}</strong>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div class="home-todo-body">
          <div class="home-todo-stats" :aria-label="homeTodoStatsAriaLabel">
            <button
              type="button"
              class="home-todo-stat all-stat"
              :class="{ active: homeTodoCategoryFilter === 'all' }"
              :aria-pressed="homeTodoCategoryFilter === 'all'"
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
              :class="{ active: homeTodoCategoryFilter === 'task' }"
              :aria-pressed="homeTodoCategoryFilter === 'task'"
              :aria-label="`${isSelectedToday ? '今日' : homeFooterDateLabel}待办事项`"
              @click.stop="selectHomeTodoCategoryFilter('task')"
            >
              <span class="home-todo-stat-icon" aria-hidden="true">
                <IconSquareCheck />
              </span>
              <span class="home-todo-stat-copy">
                <span>待办事项</span>
                <strong>{{ selectedDayTodoCount }}</strong>
              </span>
            </button>
            <button
              type="button"
              class="home-todo-stat meeting-stat"
              :class="{ active: homeTodoCategoryFilter === 'meeting' }"
              :aria-pressed="homeTodoCategoryFilter === 'meeting'"
              :aria-label="`${isSelectedToday ? '今日' : homeFooterDateLabel}会议信息`"
              @click.stop="selectHomeTodoCategoryFilter('meeting')"
            >
              <span class="home-todo-stat-icon" aria-hidden="true">
                <IconPresentation />
              </span>
              <span class="home-todo-stat-copy">
                <span>会议信息</span>
                <strong>{{ selectedDayMeetingCount }}</strong>
              </span>
            </button>
          </div>

          <div class="home-todo-list-shell">
            <div class="home-todo-list" :aria-label="homeTodoListAriaLabel">
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
                :class="{ 'is-done': task.status === 'done' }"
              >
                <div class="home-todo-item-main">
                  <time>{{ formatHomeTodoMeta(task) }}</time>
                  <span class="home-todo-item-title">{{ task.title }}</span>
                  <span v-if="task.status === 'done'" class="home-todo-status-tag">
                    <IconCheck aria-hidden="true" />
                    已完成
                  </span>
                </div>
                <div class="home-todo-item-actions">
                  <button
                    v-if="task.completable !== false"
                    type="button"
                    class="home-todo-action complete-action"
                    :class="{
                      'is-done': task.status === 'done',
                      'is-syncing': isTodoStatusUpdating(task.id),
                    }"
                    :disabled="isTodoStatusUpdating(task.id)"
                    :aria-busy="isTodoStatusUpdating(task.id)"
                    @click.stop="toggleTodayTaskStatus(task)"
                  >
                    {{
                      isTodoStatusUpdating(task.id)
                        ? '处理中...'
                        : task.status === 'done'
                          ? '撤销'
                          : '完成'
                    }}
                  </button>
                  <button
                    type="button"
                    class="home-todo-action detail-action"
                    @click.stop="openSelectedDayTask(task)"
                  >
                    查看详情
                  </button>
                </div>
              </article>
            </div>

            <TodoQuickCreateBar
              v-model="homeQuickTodoText"
              variant="simple"
              input-id="home-quick-todo"
              @full-create="openSelectedDayAddTodo"
              @submit="submitHomeQuickTodo"
            />
          </div>
        </div>

        <HomePanelToolDock data-tour-target="tool-dock" @select="openHomePanelTool" />
      </section>
    </section>
  </div>
</template>

<style scoped>
.calendar-workspace {
  --home-module-height: clamp(560px, 62vh, 680px);
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
  --home-glass-text-fill: rgba(248, 252, 255, 0.9);
  --home-glass-text-gradient: radial-gradient(
      circle at 22% 20%,
      rgba(255, 255, 255, 0.96),
      rgba(255, 255, 255, 0.58) 34%,
      rgba(236, 246, 255, 0.76) 68%
    ),
    linear-gradient(145deg, rgba(255, 255, 255, 0.9), rgba(223, 238, 255, 0.72)),
    rgba(248, 252, 255, 0.6);
  --home-glass-text-shadow: 0 1px 0 rgba(255, 255, 255, 0.46),
    0 14px 34px rgba(15, 23, 42, 0.34),
    0 2px 8px rgba(15, 23, 42, 0.24);
  position: absolute;
  top: clamp(32px, 4vh, 56px);
  left: clamp(32px, 2.4vw, 48px);
  z-index: 1;
  box-sizing: border-box;
  max-width: min(620px, calc(100vw - 96px));
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  pointer-events: none;
  user-select: none;
  filter: drop-shadow(0 18px 30px rgba(15, 23, 42, 0.2));
}

.home-time-mark__greeting {
  display: inline-flex;
  align-items: baseline;
  gap: 12px;
  font-family:
    'SF Pro Text',
    -apple-system,
    BlinkMacSystemFont,
    'Helvetica Neue',
    'Segoe UI',
    sans-serif;
  text-shadow:
    0 1px 0 rgba(255, 255, 255, 0.18),
    0 8px 22px rgba(15, 23, 42, 0.2);
}

.home-time-mark__greeting strong {
  color: rgba(255, 255, 255, 0.95);
  font-size: clamp(18px, 1.5vw, 22px);
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0;
}

.home-time-mark__greeting span {
  border-left: 1px solid rgba(255, 255, 255, 0.28);
  color: rgba(255, 255, 255, 0.66);
  padding-left: 12px;
  font-size: clamp(12px, 0.95vw, 14px);
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0;
}

.home-time-mark__time {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  font-family:
    'SF Pro Display',
    'SF Pro Text',
    -apple-system,
    BlinkMacSystemFont,
    'Helvetica Neue',
    'Segoe UI',
    sans-serif;
  color: rgba(255, 255, 255, 0.94);
  margin: 0;
  font-size: clamp(76px, 7.6vw, 116px);
  font-weight: 800;
  line-height: 0.86;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
  text-shadow:
    0 1px 0 rgba(255, 255, 255, 0.28),
    0 12px 30px rgba(15, 23, 42, 0.24),
    0 2px 10px rgba(15, 23, 42, 0.18);
}

.home-time-mark__colon {
  margin: 0 0.04em;
  color: rgba(255, 255, 255, 0.72);
  transform: translateY(-0.05em);
}

.home-time-mark__date {
  min-width: 0;
  margin-top: 0;
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
  font-family:
    'SF Pro Text',
    -apple-system,
    BlinkMacSystemFont,
    'Helvetica Neue',
    'Segoe UI',
    sans-serif;
  white-space: nowrap;
  font-size: clamp(15px, 1.2vw, 18px);
  line-height: 1;
  text-shadow:
    0 1px 0 rgba(255, 255, 255, 0.18),
    0 8px 22px rgba(15, 23, 42, 0.22);
}

.home-time-mark__date strong {
  color: rgba(255, 255, 255, 0.95);
  font-weight: 800;
  letter-spacing: 0;
}

.home-time-mark__date em {
  color: rgba(255, 255, 255, 0.78);
  font-style: normal;
  font-weight: 700;
}

.home-time-mark__date span {
  color: rgba(255, 255, 255, 0.55);
  font-weight: 700;
  letter-spacing: 0;
}

.home-time-mark__greeting strong,
.home-time-mark__greeting span,
.home-time-mark__time span,
.home-time-mark__date strong,
.home-time-mark__date em,
.home-time-mark__date span {
  color: var(--home-glass-text-fill);
  text-shadow: var(--home-glass-text-shadow);
  -webkit-text-stroke: 0.35px rgba(18, 42, 74, 0.16);
}

@supports ((-webkit-background-clip: text) or (background-clip: text)) {
  .home-time-mark__greeting strong,
  .home-time-mark__greeting span,
  .home-time-mark__time span,
  .home-time-mark__date strong,
  .home-time-mark__date em,
  .home-time-mark__date span {
    background: var(--home-glass-text-gradient);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
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
  border: 1px solid rgba(255, 255, 255, var(--glass-border-opacity, 0.64));
  border-radius: 24px;
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
  padding: 12px 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
  isolation: isolate;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.72),
    0 20px 36px -30px rgba(18, 38, 72, 0.4);
  backdrop-filter: blur(var(--glass-blur, 24px)) saturate(var(--glass-saturate, 1.16));
  -webkit-backdrop-filter: blur(var(--glass-blur, 24px)) saturate(var(--glass-saturate, 1.16));
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
  flex: 0 0 42px;
  min-height: 34px;
  border-radius: 12px;
  background: rgba(67, 139, 255, 0.12);
  color: #438bff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 950;
  line-height: 1;
  white-space: nowrap;
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

.home-todo-stats {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.home-todo-stat {
  min-width: 0;
  border: 0;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
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
  width: 34px;
  height: 34px;
  border-radius: 10px;
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
  background: rgba(139, 92, 246, 0.14);
  color: #8b5cf6;
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
  line-height: 1;
  font-weight: 850;
}

.home-todo-stat-copy strong {
  color: var(--home-ink);
  font-size: 20px;
  line-height: 1;
  font-weight: 950;
}

.home-todo-list-shell {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.home-todo-list {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 2px 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
}

.home-todo-empty-state {
  flex: 1 1 auto;
  min-height: 0;
}

.home-todo-item {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  flex: 0 0 auto;
  min-height: 50px;
  box-sizing: border-box;
  padding: 0 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.692);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.42);
  overflow: hidden;
  transition:
    background 0.22s ease,
    border-color 0.22s ease,
    box-shadow 0.22s ease,
    transform 0.22s ease;
}

.home-todo-item:hover,
.home-todo-item:focus-within {
  background: rgba(255, 255, 255, 0.56);
  border-color: rgba(255, 255, 255, 0.78);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 8px 18px -16px rgba(67, 139, 255, 0.28);
}

.home-todo-item-main {
  min-width: 0;
  padding: 11px 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.home-todo-item-actions {
  position: absolute;
  right: 10px;
  top: 50%;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-50%) translateX(10px);
  transition:
    opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    visibility 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.home-todo-item:hover .home-todo-item-actions,
.home-todo-item:focus-within .home-todo-item-actions {
  opacity: 1;
  visibility: visible;
  transform: translateY(-50%) translateX(0);
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

.home-todo-action:disabled {
  cursor: wait;
  opacity: 0.68;
}

.home-todo-action:disabled:hover {
  color: #64748b;
}

.home-todo-action.complete-action {
  color: #16a34a;
  background: rgba(34, 197, 94, 0.12);
}

.home-todo-action.complete-action:hover {
  background: rgba(34, 197, 94, 0.2);
  color: #15803d;
}

.home-todo-action.complete-action.is-done {
  color: #64748b;
  background: rgba(148, 163, 184, 0.14);
}

.home-todo-action.complete-action.is-done:hover {
  background: rgba(148, 163, 184, 0.22);
  color: #475569;
}

.home-todo-action.complete-action.is-syncing,
.home-todo-action.complete-action.is-syncing:hover {
  color: #64748b;
  background: rgba(148, 163, 184, 0.16);
}

.home-todo-action.detail-action {
  color: #438bff;
  background: rgba(67, 139, 255, 0.1);
}

.home-todo-action.detail-action:hover {
  background: rgba(67, 139, 255, 0.18);
  color: #2563eb;
}

.home-todo-item-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: #1f2f4d;
  font-size: 14px;
  font-weight: 850;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition:
    color 0.22s ease,
    opacity 0.22s ease;
}

.home-todo-item time {
  flex: 0 0 auto;
  min-width: 42px;
  color: #8b99ae;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
  text-align: left;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.home-todo-item.is-done {
  opacity: 0.85;
}

.home-todo-item.is-done .home-todo-item-title {
  color: #94a3b8;
  text-decoration: line-through;
}

.home-todo-item.is-done .home-todo-item-actions {
  right: 78px;
}

.home-todo-status-tag {
  flex: 0 0 auto;
  margin-left: auto;
  position: relative;
  z-index: 3;
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

.home-todo-item:not(.is-done):hover .home-todo-item-title,
.home-todo-item:not(.is-done):focus-within .home-todo-item-title {
  padding-right: 132px;
}

.home-todo-item.is-done:hover .home-todo-item-title,
.home-todo-item.is-done:focus-within .home-todo-item-title {
  padding-right: 170px;
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
  min-width: 0;
  height: 50px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #8b99ae;
  padding: 0;
  display: grid;
  grid-template-rows: 12px 30px;
  align-content: center;
  justify-items: center;
  row-gap: 4px;
  font: inherit;
  cursor: pointer;
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
  height: min(680px, calc(100% - 96px));
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
  padding: 24px;
  overflow: hidden;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.72),
    0 20px 36px -30px rgba(18, 38, 72, 0.4);
  backdrop-filter: blur(var(--glass-blur, 24px)) saturate(var(--glass-saturate, 1.16));
  -webkit-backdrop-filter: blur(var(--glass-blur, 24px)) saturate(var(--glass-saturate, 1.16));
  transform: none;
}

.day-preview-popover :deep(.preview-panel) {
  height: 100%;
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
    height: 580px;
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
