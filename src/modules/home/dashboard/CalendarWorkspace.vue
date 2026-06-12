<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Component } from 'vue'
import { useRouter } from 'vue-router'
import IconBox from '~icons/lucide/box'
import IconCalendarDays from '~icons/lucide/calendar-days'
import IconCalendarRange from '~icons/lucide/calendar-range'
import IconClipboardList from '~icons/lucide/clipboard-list'
import IconCode from '~icons/lucide/code'
import IconCompass from '~icons/lucide/compass'
import IconFileText from '~icons/lucide/file-text'
import IconImage from '~icons/lucide/image'
import IconMessageCircle from '~icons/lucide/message-circle'
import IconPresentation from '~icons/lucide/presentation'
import IconTrendingUp from '~icons/lucide/trending-up'
import IconUsers from '~icons/lucide/users'
import libaoImage from '@/assets/libao.png'
import campusImage from '@/assets/modelone.png'
import { routeConfig } from '@/config/route.config'
import { useFeedbackStore } from '@/stores/feedback.store'
import { useUserStore } from '@/stores/user.store'
import CalendarMonth from './CalendarMonth.vue'
import DayPreviewPanel from './DayPreviewPanel.vue'
import type {
  CalendarDay,
  CalendarEvent,
  CalendarEventStatus,
  CalendarSpecialDay,
  CalendarTodoDraft,
  CalendarTodoUpdate,
  CalendarUser,
} from './types'
import { compareEvents, dateRange, formatEventTime } from './todoDisplay'
import {
  createTodo as serviceCreateTodo,
  deleteTodo as serviceDeleteTodo,
  listTodos,
  loadCurrentUser,
  loadAssignableUsers as serviceLoadAssignableUsers,
  getTodoMonthRange,
  getTodoWeekRange,
  loadTodos,
  syncCalendar as serviceSyncCalendar,
  updateTodo as serviceUpdateTodo,
  updateTodoStatus as serviceUpdateTodoStatus,
} from './todo.service'

type CampusTool = {
  name: string
  icon: Component
  tone: string
  position: string
  agentKey?: string
  isMore?: boolean
  simulated?: boolean
}

type MetricTone = 'blue' | 'green' | 'violet'

type DashboardMetric = {
  label: string
  value: number
  unit: string
  detail: string
  progress: number
  icon: Component
  tone: MetricTone
  variant: 'today' | 'week' | 'month'
  pending: number
  completed: number
  nextText?: string
  statusItems?: Array<{ label: string; value: number }>
  heatCells?: Array<{ key: string; label: string; intensity: number; isToday: boolean }>
}

type DayPreviewPanelExpose = {
  showDiscardWarning: (onConfirm?: () => void) => void
}

const now = ref(new Date())
const selectedDate = ref(ymd(now.value))
const currentMonth = ref(new Date(now.value.getFullYear(), now.value.getMonth(), 1))
const allEvents = ref<CalendarEvent[]>([])
const backendAssignableUsers = ref<CalendarUser[]>([])
const isDashboardLoading = ref(false)
const isProfileDialogOpen = ref(false)
const isDayPreviewOpen = ref(false)
const isTodayBubbleVisible = ref(true)
const isTodayBubbleManualClosed = ref(false)
const isTodayBubbleAutoHidden = ref(false)
const quickCreatePrompt = ref('')
const quickCreateKey = ref(0)
const presetCreateTime = ref('')
const presetCreateKey = ref(0)
const isDayPreviewFormDirty = ref(false)
const isSyncingCalendar = ref(false)
const dayPreviewPanelRef = ref<DayPreviewPanelExpose | null>(null)
const calendarViewMode = ref<'month' | 'week'>('month')
const taskMetricMode = ref<'week' | 'month'>('week')
const trendStatMode = ref<'week' | 'month'>('week')
const router = useRouter()
const userStore = useUserStore()
const feedbackStore = useFeedbackStore()
let clockTimer: ReturnType<typeof setInterval> | undefined
let todayBubbleTimer: ReturnType<typeof setTimeout> | undefined
let panelCloseRestoreTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = new Date()
  }, 60_000)
  void initializeDashboardData()
})

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
  clearTodayBubbleTimer()
  clearPanelCloseRestoreTimer()
})

let hasInitializedTodoRange = false

const campusTools: CampusTool[] = [
  {
    name: '力宝百问',
    icon: IconMessageCircle,
    tone: 'blue',
    position: 'qa',
    agentKey: 'policy-qa',
  },
  {
    name: '会议纪要',
    icon: IconFileText,
    tone: 'green',
    position: 'meeting',
    agentKey: 'meeting-notes',
  },
  {
    name: 'PPT创作',
    icon: IconPresentation,
    tone: 'violet',
    position: 'ppt',
    agentKey: 'ppt-creator',
  },
  {
    name: '图文分析',
    icon: IconImage,
    tone: 'orange',
    position: 'image',
    agentKey: 'image-analysis',
  },
  {
    name: '面试中心',
    icon: IconUsers,
    tone: 'sky',
    position: 'interview',
    agentKey: 'interview-center',
  },
  {
    name: '代码辅助',
    icon: IconCode,
    tone: 'cyan',
    position: 'code',
    agentKey: 'code-assistant',
  },
  {
    name: '智体工坊',
    icon: IconBox,
    tone: 'violet',
    position: 'workshop',
    simulated: true,
  },
  {
    name: '查看更多',
    icon: IconCompass,
    tone: 'slate',
    position: 'more',
    isMore: true,
  },
]

const pointStats = [
  { label: '积分', value: '2,480' },
  { label: '本周使用', value: '18' },
  { label: '连续活跃', value: '7天' },
]

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

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function completedEventCountByDate(date: string) {
  return events.value.filter(
    (event) => event.status === 'done' && dateRange(event.date, event.endDate).includes(date),
  ).length
}

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
const todayDate = computed(() => ymd(now.value))

const days = computed<CalendarDay[]>(() => {
  const result: CalendarDay[] = []
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  const start = new Date(year, month, 1)
  const offset = (start.getDay() + 6) % 7
  const cursor = new Date(year, month, 1 - offset)

  for (let i = 0; i < 42; i += 1) {
    const date = ymd(cursor)
    result.push({
      date,
      day: cursor.getDate(),
      inMonth: cursor.getFullYear() === year && cursor.getMonth() === month,
      isToday: date === todayDate.value,
      specialDays: specialDayMap.value.get(date) ?? [],
      events: eventMap.value.get(date) ?? [],
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return result
})

const weekDays = computed<CalendarDay[]>(() => {
  const result: CalendarDay[] = []
  const selected = new Date(`${selectedDate.value}T12:00:00`)
  const offset = (selected.getDay() + 6) % 7
  const cursor = new Date(selected)
  cursor.setDate(selected.getDate() - offset)

  for (let i = 0; i < 7; i += 1) {
    const date = ymd(cursor)
    result.push({
      date,
      day: cursor.getDate(),
      inMonth:
        cursor.getFullYear() === currentMonth.value.getFullYear() &&
        cursor.getMonth() === currentMonth.value.getMonth(),
      inActiveWeek: true,
      isToday: date === todayDate.value,
      specialDays: specialDayMap.value.get(date) ?? [],
      events: eventMap.value.get(date) ?? [],
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return result
})

const monthLabel = computed(
  () => `${currentMonth.value.getFullYear()} 年 ${currentMonth.value.getMonth() + 1} 月`,
)
const weekLabel = computed(() => {
  const activeDays = weekDays.value.filter((day) => day.inActiveWeek)
  const first = activeDays[0]
  const last = activeDays[activeDays.length - 1]
  if (!first || !last) return monthLabel.value

  const start = new Date(`${first.date}T12:00:00`)
  const end = new Date(`${last.date}T12:00:00`)
  const startLabel = `${start.getMonth() + 1}月${start.getDate()}日`
  const endLabel = `${end.getMonth() + 1}月${end.getDate()}日`

  return `${start.getFullYear()} 年 ${startLabel} - ${endLabel}`
})
const visibleCalendarDays = computed(() =>
  calendarViewMode.value === 'week' ? weekDays.value : days.value,
)
const isTodoOperating = computed(() => isDayPreviewOpen.value)
const shouldShowTodayBubble = computed(
  () =>
    calendarViewMode.value === 'month' &&
    isTodayBubbleVisible.value &&
    !isTodayBubbleManualClosed.value &&
    !isTodoOperating.value,
)
const selectedEvents = computed(() => eventMap.value.get(selectedDate.value) ?? [])
const selectedSpecialDays = computed(() => specialDayMap.value.get(selectedDate.value) ?? [])
const todayEvents = computed(() => eventMap.value.get(todayDate.value) ?? [])
const todayPendingEvents = computed(() =>
  todayEvents.value.filter((event) => event.status !== 'done'),
)
const todayCompletedCount = computed(
  () => todayEvents.value.length - todayPendingEvents.value.length,
)
const currentWeekDates = computed(() => {
  const start = new Date(`${selectedDate.value}T12:00:00`)
  const offset = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - offset)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return ymd(date)
  })
})
const currentMonthDates = computed(() => {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  const dayCount = getDaysInMonth(year, month)

  return Array.from({ length: dayCount }, (_, index) => ymd(new Date(year, month, index + 1)))
})
const todoLoadRangeKey = computed(() => {
  const range =
    calendarViewMode.value === 'week'
      ? getTodoWeekRange(selectedDate.value)
      : getTodoMonthRange(currentMonth.value)

  return `${range.startDate}:${range.endDate}`
})
const weekEvents = computed(() =>
  events.value.filter((event) => eventIntersectsDates(event, currentWeekDates.value)),
)
const weekPendingEvents = computed(() =>
  weekEvents.value.filter((event) => event.status !== 'done'),
)
const weekCompletedCount = computed(() => weekEvents.value.length - weekPendingEvents.value.length)
const monthEvents = computed(() =>
  events.value.filter((event) => eventIntersectsDates(event, currentMonthDates.value)),
)
const monthPendingEvents = computed(() =>
  monthEvents.value.filter((event) => event.status !== 'done'),
)
const monthCompletedCount = computed(
  () => monthEvents.value.length - monthPendingEvents.value.length,
)
const nextTodayEvent = computed(() => todayPendingEvents.value[0])
const userName = computed(() => currentUser.value.name)
const userDepartment = computed(
  () =>
    `${currentUser.value.department ?? 'AI平台'} · ${currentUser.value.role === 'leader' ? '领导' : '员工'}`,
)
const avatarUrl = computed(() => libaoImage)
const greeting = computed(() => {
  const hour = now.value.getHours()
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
})
const todayTaskProgress = computed(() =>
  todayEvents.value.length
    ? Math.round((todayCompletedCount.value / todayEvents.value.length) * 100)
    : 0,
)
const profileTaskInsight = computed(() => {
  const todayCount = todayPendingEvents.value.length
  const weekCount = weekPendingEvents.value.length

  return {
    todayCount,
    weekCount,
    nextText: nextTodayEvent.value
      ? `下一项 ${formatEventTime(nextTodayEvent.value)} 处理「${nextTodayEvent.value.title}」`
      : '可以补充新的重点安排',
  }
})
const weekTaskProgress = computed(() =>
  weekEvents.value.length
    ? Math.round((weekCompletedCount.value / weekEvents.value.length) * 100)
    : 0,
)
const monthTaskProgress = computed(() =>
  monthEvents.value.length
    ? Math.round((monthCompletedCount.value / monthEvents.value.length) * 100)
    : 0,
)
const weekSpanningEventCount = computed(
  () => weekEvents.value.filter((event) => event.endDate && event.endDate !== event.date).length,
)
const monthHeatCells = computed(() =>
  currentMonthDates.value.map((date) => {
    const dayEvents = eventMap.value.get(date) ?? []
    const intensity = Math.min(dayEvents.length, 4)
    const day = new Date(`${date}T12:00:00`).getDate()

    return {
      key: date,
      label: String(day),
      intensity,
      isToday: date === todayDate.value,
    }
  }),
)
const dashboardMetrics = computed<DashboardMetric[]>(() => [
  {
    label: '今日待办',
    value: todayEvents.value.length,
    unit: '项',
    detail: `待处理 ${todayPendingEvents.value.length} 项 · 已完成 ${todayCompletedCount.value} 项`,
    progress: todayTaskProgress.value,
    icon: IconCalendarDays,
    tone: 'blue',
    variant: 'today',
    pending: todayPendingEvents.value.length,
    completed: todayCompletedCount.value,
    nextText: nextTodayEvent.value
      ? `${formatEventTime(nextTodayEvent.value)} · ${nextTodayEvent.value.title}`
      : '今天暂无待处理事项',
  },
  {
    label: '本周任务',
    value: weekEvents.value.length,
    unit: '项',
    detail: `待处理 ${weekPendingEvents.value.length} 项 · 已完成 ${weekCompletedCount.value} 项`,
    progress: weekTaskProgress.value,
    icon: IconClipboardList,
    tone: 'green',
    variant: 'week',
    pending: weekPendingEvents.value.length,
    completed: weekCompletedCount.value,
    statusItems: [
      { label: '待办', value: weekPendingEvents.value.length },
      { label: '完成', value: weekCompletedCount.value },
      { label: '跨天', value: weekSpanningEventCount.value },
    ],
  },
  {
    label: '本月任务',
    value: monthEvents.value.length,
    unit: '项',
    detail: `待处理 ${monthPendingEvents.value.length} 项 · 已完成 ${monthCompletedCount.value} 项`,
    progress: monthTaskProgress.value,
    icon: IconCalendarRange,
    tone: 'violet',
    variant: 'month',
    pending: monthPendingEvents.value.length,
    completed: monthCompletedCount.value,
    heatCells: monthHeatCells.value,
  },
])
const todayMetric = computed(() => dashboardMetrics.value.find((metric) => metric.variant === 'today'))
const weekMetric = computed(() => dashboardMetrics.value.find((metric) => metric.variant === 'week'))
const monthMetric = computed(() => dashboardMetrics.value.find((metric) => metric.variant === 'month'))
const periodMetric = computed(() =>
  taskMetricMode.value === 'week' ? weekMetric.value : monthMetric.value,
)
const trendSeries = computed(() =>
  trendStatMode.value === 'week' ? weekTrendSeries.value : monthTrendSeries.value,
)
const weekTrendSeries = computed(() =>
  weekDays.value.map((day) => ({
    label: ['日', '一', '二', '三', '四', '五', '六'][new Date(`${day.date}T12:00:00`).getDay()],
    value: completedEventCountByDate(day.date),
  })),
)
const monthTrendSeries = computed(() => {
  const rows: Array<{ label: string; value: number }> = []

  for (let row = 0; row < 6; row += 1) {
    const rowDays = days.value.slice(row * 7, row * 7 + 7).filter((day) => day.inMonth)
    if (!rowDays.length) continue

    rows.push({
      label: `${rows.length + 1}周`,
      value: rowDays.reduce((total, day) => total + completedEventCountByDate(day.date), 0),
    })
  }

  return rows
})
const trendTotal = computed(() => trendSeries.value.reduce((total, item) => total + item.value, 0))
const trendMaxValue = computed(() => Math.max(...trendSeries.value.map((item) => item.value), 1))
const trendChartPoints = computed(() => {
  const series = trendSeries.value
  const width = 210
  const height = 56
  const top = 8
  const count = Math.max(series.length - 1, 1)

  return series.map((item, index) => {
    const x = Number(((index / count) * width).toFixed(1))
    const y = Number((top + (1 - item.value / trendMaxValue.value) * height).toFixed(1))
    return { ...item, x, y }
  })
})
const trendLinePoints = computed(() =>
  trendChartPoints.value.map((point) => `${point.x},${point.y}`).join(' '),
)
const trendAreaPoints = computed(() => `0,74 ${trendLinePoints.value} 210,74`)
const trendInsight = computed(() => {
  if (!trendTotal.value) return trendStatMode.value === 'week' ? '本周暂无完成记录' : '本月暂无完成记录'

  const peak = trendSeries.value.reduce(
    (currentPeak, item) => (item.value > currentPeak.value ? item : currentPeak),
    trendSeries.value[0],
  )
  const average = (trendTotal.value / Math.max(trendSeries.value.length, 1)).toFixed(1)

  return `峰值 ${peak.label} ${peak.value} 项 · 平均 ${average} 项`
})
const selectedDateLabel = computed(() => {
  const date = new Date(`${selectedDate.value}T12:00:00`)
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekday}`
})

function eventIntersectsDates(event: CalendarEvent, targetDates: string[]) {
  const targetDateSet = new Set(targetDates)
  return dateRange(event.date, event.endDate).some((date) => targetDateSet.has(date))
}

function selectDate(date: string, syncMonth = true) {
  selectedDate.value = date
  const nextDate = new Date(`${date}T12:00:00`)
  if (
    syncMonth &&
    (nextDate.getFullYear() !== currentMonth.value.getFullYear() ||
      nextDate.getMonth() !== currentMonth.value.getMonth())
  ) {
    currentMonth.value = new Date(nextDate.getFullYear(), nextDate.getMonth(), 1)
  }
}

function toggleDayPreview(date: string, time?: string) {
  if (time) {
    const openTimedCreate = () => {
      isDayPreviewFormDirty.value = false
      quickCreatePrompt.value = ''
      presetCreateTime.value = time
      presetCreateKey.value += 1
      selectDate(date, calendarViewMode.value === 'week')
      openTodoPanel()
    }

    if (isDayPreviewOpen.value && !confirmDiscardPreviewChanges(openTimedCreate)) return

    openTimedCreate()
    return
  }

  if (isDayPreviewOpen.value && selectedDate.value === date) {
    return
  }

  const openSelectedDay = () => {
    isDayPreviewFormDirty.value = false
    quickCreatePrompt.value = ''
    presetCreateTime.value = ''
    selectDate(date, calendarViewMode.value === 'week')
    openTodoPanel()
  }

  if (isDayPreviewOpen.value && !confirmDiscardPreviewChanges(openSelectedDay)) return

  openSelectedDay()
}

function closeDayPreview() {
  const closePreview = () => {
    isDayPreviewOpen.value = false
    isDayPreviewFormDirty.value = false
    scheduleTodayBubbleAfterPanelClose()
  }

  if (!confirmDiscardPreviewChanges(closePreview)) return

  closePreview()
}

function closeTodayBubble() {
  clearTodayBubbleTimer()
  clearPanelCloseRestoreTimer()
  isTodayBubbleVisible.value = false
  isTodayBubbleAutoHidden.value = false
  isTodayBubbleManualClosed.value = true
}

function openTodoPanel() {
  clearTodayBubbleTimer()
  clearPanelCloseRestoreTimer()
  isTodayBubbleVisible.value = false
  isTodayBubbleAutoHidden.value = false
  isDayPreviewOpen.value = true
}

function clearTodayBubbleTimer() {
  if (!todayBubbleTimer) return
  clearTimeout(todayBubbleTimer)
  todayBubbleTimer = undefined
}

function clearPanelCloseRestoreTimer() {
  if (!panelCloseRestoreTimer) return
  clearTimeout(panelCloseRestoreTimer)
  panelCloseRestoreTimer = undefined
}

function showToast(message: string) {
  feedbackStore.success(message)
}

async function initializeDashboardData() {
  isDashboardLoading.value = true

  try {
    if (!userStore.token) {
      void router.replace({
        path: routeConfig.loginRoute,
        query: { redirect: router.currentRoute.value.fullPath },
      })
      return
    }

    if (!userStore.profile) {
      const profile = await loadCurrentUser()
      userStore.setProfile(profile)
    }

    await refreshAssignableUsers()
    await refreshTodos()
    hasInitializedTodoRange = true
  } catch (error) {
    const message = error instanceof Error ? error.message : '后台接口连接失败'

    if (message.includes('登录状态') || message.includes('401')) {
      userStore.logout()
      void router.replace({
        path: routeConfig.loginRoute,
        query: { redirect: router.currentRoute.value.fullPath },
      })
    }
  } finally {
    isDashboardLoading.value = false
  }
}

async function refreshAssignableUsers() {
  backendAssignableUsers.value = await serviceLoadAssignableUsers()
}

function getActiveTodoLoadRange() {
  return calendarViewMode.value === 'week'
    ? getTodoWeekRange(selectedDate.value)
    : getTodoMonthRange(currentMonth.value)
}

async function refreshTodos() {
  if (!currentUser.value.id) return
  allEvents.value = await loadTodos(
    currentUser.value,
    assignableUsers.value,
    getActiveTodoLoadRange(),
  )
}

async function syncCalendarFromEmail() {
  if (isSyncingCalendar.value) return

  isSyncingCalendar.value = true
  try {
    await serviceSyncCalendar()
    await refreshTodos()
    showToast('邮箱日程同步成功')
  } catch {
    feedbackStore.error('同步邮箱日程失败')
  } finally {
    isSyncingCalendar.value = false
  }
}

watch(todoLoadRangeKey, () => {
  if (!hasInitializedTodoRange) return
  void refreshTodos()
})

function confirmDiscardPreviewChanges(onConfirm?: () => void) {
  if (!isDayPreviewFormDirty.value) return true
  dayPreviewPanelRef.value?.showDiscardWarning(onConfirm)
  return false
}

function tryShowTodayBubble() {
  if (
    isTodayBubbleManualClosed.value ||
    isTodoOperating.value ||
    calendarViewMode.value !== 'month'
  )
    return

  isTodayBubbleVisible.value = true
  isTodayBubbleAutoHidden.value = false
}

function resetTodayBubbleTimer() {
  clearTodayBubbleTimer()
  todayBubbleTimer = setTimeout(tryShowTodayBubble, 3000)
}

function hideTodayBubbleTemporarily() {
  if (
    isTodayBubbleManualClosed.value ||
    isTodoOperating.value ||
    calendarViewMode.value !== 'month'
  )
    return

  isTodayBubbleVisible.value = false
  isTodayBubbleAutoHidden.value = true
  resetTodayBubbleTimer()
}

function scheduleTodayBubbleAfterPanelClose() {
  clearTodayBubbleTimer()
  clearPanelCloseRestoreTimer()
  if (isTodayBubbleManualClosed.value || calendarViewMode.value !== 'month') return

  panelCloseRestoreTimer = setTimeout(() => {
    if (
      !isDayPreviewOpen.value &&
      !isTodayBubbleManualClosed.value &&
      calendarViewMode.value === 'month'
    ) {
      isTodayBubbleVisible.value = true
      isTodayBubbleAutoHidden.value = false
    }
  }, 1000)
}

function quickCreateTodo(prompt: string, date: string) {
  const createFromPrompt = () => {
    isDayPreviewFormDirty.value = false
    quickCreatePrompt.value = prompt
    presetCreateTime.value = ''
    quickCreateKey.value += 1
    selectDate(date)
    if (date === todayDate.value) {
      isTodayBubbleManualClosed.value = false
    }
    openTodoPanel()
  }

  if (isDayPreviewOpen.value && !confirmDiscardPreviewChanges(createFromPrompt)) return

  createFromPrompt()
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
    await serviceUpdateTodoStatus(id, currentUser.value, status, assignableUsers.value)
    await refreshTodos()
    showToast(status === 'done' ? '已标记完成' : '已撤销完成')
  } catch {
    // 全局拦截器已统一提示错误
  }
}

async function deleteTodo(id: string) {
  isDayPreviewFormDirty.value = false
  try {
    await serviceDeleteTodo(id)
    await refreshTodos()
    closeDayPreview()
    showToast('待办已删除')
  } catch {
    // 全局拦截器已统一提示错误
  }
}

async function openTodoFromNotification(payload: { id: string; date: string }) {
  isDayPreviewFormDirty.value = false
  selectDate(payload.date)
  openTodoPanel()
  await refreshTodos()
}

defineExpose({
  refreshTodos,
  openTodoFromNotification,
})

function changePeriod(delta: number) {
  const applyPeriodChange = () => {
    isDayPreviewFormDirty.value = false
    if (calendarViewMode.value === 'week') {
      const selected = new Date(`${selectedDate.value}T12:00:00`)
      selected.setDate(selected.getDate() + delta * 7)
      selectedDate.value = ymd(selected)
      currentMonth.value = new Date(selected.getFullYear(), selected.getMonth(), 1)
      return
    }

    const selected = new Date(`${selectedDate.value}T12:00:00`)
    const nextMonth = new Date(
      currentMonth.value.getFullYear(),
      currentMonth.value.getMonth() + delta,
      1,
    )
    const nextDay = Math.min(
      selected.getDate(),
      getDaysInMonth(nextMonth.getFullYear(), nextMonth.getMonth()),
    )

    currentMonth.value = nextMonth
    selectedDate.value = ymd(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), nextDay))
  }

  if (isDayPreviewOpen.value && !confirmDiscardPreviewChanges(applyPeriodChange)) return

  applyPeriodChange()
}

function openCampusTool(tool: CampusTool) {
  if (tool.agentKey) {
    openAgentList(tool.agentKey)
    return
  }

  if (tool.isMore) {
    openAgentList()
    return
  }

  showToast(`${tool.name}模拟能力建设中，已打开智能体中心`)
  openAgentList()
}

function openAgentList(agentKey?: string) {
  router.push({
    name: 'AgentList',
    query: agentKey ? { agent: agentKey } : undefined,
  })
}
</script>

<template>
  <div class="calendar-workspace" @click="closeDayPreview">
    <div
      v-if="isDayPreviewOpen"
      class="left-preview-scrim"
      role="presentation"
      @click.stop="closeDayPreview"
    ></div>

    <section
      class="profile-welcome-panel"
      :class="{ 'has-profile-dialog': isProfileDialogOpen }"
      aria-label="个人信息与欢迎区"
    >
      <section class="profile-panel">
        <div class="profile-menu-anchor">
          <button
            class="profile-trigger"
            type="button"
            @click="isProfileDialogOpen = !isProfileDialogOpen"
          >
            <img class="avatar" :src="avatarUrl" alt="用户头像" />
            <span class="profile-copy">
              <strong>{{ greeting }}，{{ userName }}</strong>
            </span>
          </button>

          <div class="profile-task-summary" aria-label="待办摘要">
            <p>
              今日 <strong>{{ profileTaskInsight.todayCount }}</strong> 项待办
              <i></i>
              本周 <strong>{{ profileTaskInsight.weekCount }}</strong> 项待推进
            </p>
            <span>{{ profileTaskInsight.nextText }}</span>
          </div>

          <section
            v-if="isProfileDialogOpen"
            class="profile-dialog"
            role="dialog"
            aria-modal="false"
            aria-label="个人信息"
          >
            <header class="profile-dialog-head">
              <div class="profile-dialog-user">
                <img class="dialog-avatar" :src="avatarUrl" alt="用户头像" />
                <div>
                  <h2>{{ userName }}</h2>
                  <p>{{ userDepartment }}</p>
                </div>
              </div>
              <button
                class="dialog-close"
                type="button"
                aria-label="关闭"
                @click="isProfileDialogOpen = false"
              >
                ×
              </button>
            </header>

            <div class="dialog-section">
              <p class="dialog-label">身份</p>
              <div class="point-grid" aria-label="真实登录身份">
                <span>
                  <strong>{{ currentUser.role === 'leader' ? '领导' : '员工' }}</strong>
                  角色
                </span>
                <span>
                  <strong>{{ currentUser.id || '未登录' }}</strong>
                  账号
                </span>
              </div>
            </div>

            <div class="dialog-section">
              <p class="dialog-label">数据</p>
              <div class="point-grid">
                <span v-for="item in pointStats" :key="item.label">
                  <strong>{{ item.value }}</strong>
                  {{ item.label }}
                </span>
              </div>
            </div>
          </section>
        </div>
      </section>

      <section class="welcome-panel">
        <div class="campus-visual">
          <img :src="campusImage" alt="" />

          <button
            v-for="tool in campusTools"
            :key="tool.name"
            class="campus-tool"
            :class="[`tone-${tool.tone}`, `position-${tool.position}`]"
            type="button"
            @click="openCampusTool(tool)"
          >
            <span class="campus-tool-content">
              <span class="campus-tool-icon">
                <component :is="tool.icon" />
              </span>
              <strong>{{ tool.name }}</strong>
            </span>
          </button>
        </div>

        <div class="quick-metrics">
          <article
            v-if="todayMetric"
            class="metric-card"
            :class="[`metric-card-${todayMetric.tone}`, `metric-card-${todayMetric.variant}`]"
          >
            <header class="metric-card-head today-card-head">
              <span class="metric-icon">
                <component :is="todayMetric.icon" />
              </span>
              <div class="today-card-headline">
                <span class="today-card-title">{{ todayMetric.label }}</span>
                <strong class="today-pending-count">
                  <em>{{ todayMetric.pending }}</em
                  >项待处理
                </strong>
              </div>
            </header>

            <div class="today-card-body">
              <p class="today-meta">
                <span>共 {{ todayMetric.value }} 项</span>
                <span>已完成 {{ todayMetric.completed }}</span>
              </p>
              <div class="today-next-event">
                <template v-if="nextTodayEvent">
                  <span class="today-next-label">下一项</span>
                  <span class="today-next-time">{{ formatEventTime(nextTodayEvent) }}</span>
                  <span class="today-next-title">{{ nextTodayEvent.title }}</span>
                </template>
                <span v-else class="today-next-empty">今天暂无待处理事项</span>
              </div>
              <div class="today-progress-track">
                <span :style="{ width: `${todayMetric.progress}%` }"></span>
              </div>
            </div>
          </article>

          <article
            v-if="periodMetric"
            class="metric-card period-metric-card"
            :class="[`metric-card-${periodMetric.tone}`, `metric-card-${periodMetric.variant}`]"
          >
            <header class="metric-card-head period-card-head">
              <span class="metric-icon">
                <component :is="periodMetric.icon" />
              </span>
              <div class="metric-title">
                <span>{{ periodMetric.label }}</span>
                <strong
                  ><em>{{ periodMetric.value }}</em
                  >{{ periodMetric.unit }}</strong
                >
              </div>
              <div class="metric-period-switch" aria-label="任务周期">
                <button
                  type="button"
                  :class="{ active: taskMetricMode === 'week' }"
                  @click="taskMetricMode = 'week'"
                >
                  周
                </button>
                <button
                  type="button"
                  :class="{ active: taskMetricMode === 'month' }"
                  @click="taskMetricMode = 'month'"
                >
                  月
                </button>
              </div>
            </header>

            <template v-if="taskMetricMode === 'week'">
              <div class="week-progress period-week-progress">
                <span :style="{ width: `${periodMetric.progress}%` }"></span>
              </div>
              <div class="metric-status-grid period-status-grid">
                <span v-for="item in periodMetric.statusItems" :key="item.label">
                  <strong>{{ item.value }}</strong>
                  {{ item.label }}
                </span>
              </div>
            </template>

            <template v-else>
              <div class="month-card-body">
                <p>{{ periodMetric.detail }}</p>
                <div class="month-heatmap" aria-label="本月任务分布">
                  <span
                    v-for="cell in periodMetric.heatCells"
                    :key="cell.key"
                    :class="[`heat-${cell.intensity}`, { 'is-today': cell.isToday }]"
                    :title="`${cell.label}日 ${cell.intensity} 项`"
                  ></span>
                </div>
              </div>
            </template>
          </article>

          <article class="metric-card trend-metric-card">
            <header class="trend-card-head">
              <span class="metric-icon metric-icon-violet">
                <IconTrendingUp />
              </span>
              <div class="trend-title">
                <span>趋势</span>
                <strong>{{ trendTotal }}<em>项</em></strong>
              </div>
              <div class="trend-switch" aria-label="统计周期">
                <button
                  type="button"
                  :class="{ active: trendStatMode === 'week' }"
                  @click="trendStatMode = 'week'"
                >
                  周
                </button>
                <button
                  type="button"
                  :class="{ active: trendStatMode === 'month' }"
                  @click="trendStatMode = 'month'"
                >
                  月
                </button>
              </div>
            </header>

            <p class="trend-insight">{{ trendInsight }}</p>
            <svg
              class="trend-chart"
              viewBox="0 0 210 82"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <line v-for="y in [18, 42, 66]" :key="y" x1="0" :y1="y" x2="210" :y2="y" />
              <polygon :points="trendAreaPoints" />
              <polyline :points="trendLinePoints" />
              <circle
                v-for="point in trendChartPoints"
                :key="`${point.label}-${point.x}`"
                :cx="point.x"
                :cy="point.y"
                r="3"
              />
            </svg>
            <div class="trend-labels">
              <span v-for="point in trendChartPoints" :key="point.label">{{ point.label }}</span>
            </div>
          </article>
        </div>
      </section>
    </section>

    <div
      v-if="isProfileDialogOpen"
      class="profile-dialog-mask"
      role="presentation"
      @click="isProfileDialogOpen = false"
    ></div>

    <section class="layout-column left-column" aria-label="日历与待办" @click.stop>
      <Transition name="day-preview-float">
        <aside
          v-if="isDayPreviewOpen"
          class="day-preview-popover"
          aria-label="当天待办详情"
          @click.stop
          @pointerdown.stop
        >
          <DayPreviewPanel
            ref="dayPreviewPanelRef"
            :date="selectedDate"
            :date-label="selectedDateLabel"
            :events="selectedEvents"
            :special-days="selectedSpecialDays"
            :current-user="currentUser"
            :assignable-users="assignableUsers"
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

      <div class="panel calendar-panel">
        <CalendarMonth
          v-model:view-mode="calendarViewMode"
          :days="visibleCalendarDays"
          :selected-date="selectedDate"
          :month-label="monthLabel"
          :week-label="weekLabel"
          :today-date="todayDate"
          :today-events="todayEvents"
          :show-today-bubble="shouldShowTodayBubble"
          :is-syncing-calendar="isSyncingCalendar"
          @select="toggleDayPreview"
          @calendar-interaction="hideTodayBubbleTemporarily"
          @close-today-bubble="closeTodayBubble"
          @quick-create-todo="quickCreateTodo"
          @sync-calendar="syncCalendarFromEmail"
          @open-agent-center="openAgentList"
          @previous-period="changePeriod(-1)"
          @next-period="changePeriod(1)"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.calendar-workspace {
  position: relative;
  isolation: isolate;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding: 5px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-template-rows: minmax(370px, 1.5fr) minmax(240px, 1fr);
  gap: 8px 18px;
  overflow: hidden;
}

.left-preview-scrim {
  position: absolute;
  z-index: 80;
  top: 22px;
  left: 22px;
  bottom: 22px;
  width: calc((100% - 62px) / 2);
  border-radius: 24px;
  background: rgba(248, 250, 252, 0.22);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28);
}

.layout-column {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel,
.profile-welcome-panel,
.welcome-panel,
.profile-panel {
  min-width: 0;
  border: 1px solid rgba(226, 232, 240, 0.82);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 18px 46px -34px rgba(15, 23, 42, 0.36);
  backdrop-filter: blur(16px);
}

.left-column {
  position: relative;
  grid-column: 3 / 5;
  grid-row: 1 / 3;
  min-height: 0;
}

.calendar-panel {
  min-height: 0;
  flex: 1 1 auto;
}

.calendar-panel,
.agent-panel {
  overflow: hidden;
}

.calendar-panel :deep(.calendar-board) {
  height: 100%;
  border: 0;
  border-radius: 18px;
  background: transparent;
  box-shadow: none;
}

.calendar-panel :deep(.month-grid) {
  gap: 8px;
}

.calendar-panel :deep(.day-cell) {
  padding: 8px;
}

.day-preview-popover {
  position: absolute;
  z-index: 999;
  top: calc(50% - 24px);
  right: calc(100% + 16px);
  width: min(550px, calc(50vw - 42px));
  height: min(682px, calc(100% - 32px));
  flex: 0 0 auto;
  box-sizing: border-box;
  border: 1px solid rgba(226, 232, 240, 0.92);
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 28px 72px -36px rgba(15, 23, 42, 0.58);
  padding: 24px;
  overflow: hidden;
  backdrop-filter: blur(18px);
  transform: translateY(-50%);
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
  transform: translate(12px, -50%);
}

.profile-welcome-panel {
  position: relative;
  isolation: isolate;
  grid-column: 1 / 3;
  grid-row: 1 / 3;
  min-height: 0;
  padding: 22px 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-x: clip;
  overflow-y: visible;
  border: 1px solid rgba(226, 232, 240, 0.58);
  border-radius: 24px;
  background: radial-gradient(circle at 18% 14%, rgba(219, 234, 254, 0.52), transparent 34%),
    radial-gradient(circle at 80% 18%, rgba(237, 233, 254, 0.46), transparent 32%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.9), rgba(248, 251, 255, 0.74));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 20px 54px -46px rgba(30, 41, 59, 0.34);
  backdrop-filter: blur(18px);
}

.profile-welcome-panel::before {
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  pointer-events: none;
  content: '';
  background: radial-gradient(
      ellipse 58% 42% at 0% 0%,
      rgba(255, 255, 255, 0.96) 0%,
      rgba(255, 255, 255, 0.72) 34%,
      rgba(255, 255, 255, 0) 76%
    ),
    linear-gradient(
      135deg,
      rgba(235, 244, 255, 0.74) 0%,
      rgba(235, 244, 255, 0.32) 24%,
      rgba(235, 244, 255, 0) 52%
    );
}

.profile-welcome-panel.has-profile-dialog {
  z-index: 1100;
}

.profile-welcome-panel .profile-panel,
.profile-welcome-panel .welcome-panel {
  border: 0;
  box-shadow: none;
  backdrop-filter: none;
}

.profile-welcome-panel .profile-panel {
  border-radius: 0;
  background: transparent;
  flex: 0 0 auto;
}

.profile-welcome-panel .welcome-panel {
  position: relative;
  z-index: 1;
  border-radius: 0;
}

.welcome-panel {
  min-height: 0;
  flex: 1 1 auto;
  padding: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) 168px;
  gap: 12px;
  background: transparent;
  color: #111827;
}

.eyebrow {
  margin: 0 0 7px;
  color: #64748b;
  font-size: 12px;
  font-weight: 850;
}

.welcome-panel .eyebrow {
  color: #6b7280;
}

h2,
h3,
p {
  margin: 0;
}

.campus-visual {
  container-type: inline-size;
  position: relative;
  grid-row: 1;
  align-self: stretch;
  min-height: 0;
  overflow: visible;
  border-radius: 0;
}

.campus-visual::before,
.campus-visual::after {
  position: absolute;
  content: '';
  pointer-events: none;
}



.campus-visual::after {
  z-index: 3;
  inset: auto -10% -46px;
  height: 40%;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0), rgba(249, 251, 255, 0.98) 58%),
    radial-gradient(ellipse at center, rgba(255, 255, 255, 0.94), transparent 74%);
}

.campus-visual img {
  position: absolute;
  z-index: 1;
  left: 50%;
  bottom: -7%;
  width: min(148%, 1040px);
  max-width: none;
  height: auto;
  max-height: 114%;
  object-fit: contain;
  transform: translateX(-50%);
  filter: drop-shadow(0 28px 30px rgba(15, 23, 42, 0.08))
    drop-shadow(0 0 24px rgba(37, 99, 235, 0.06));
  -webkit-mask-image: linear-gradient(180deg, transparent 0%, #000 12%, #000 78%, transparent 98%),
    radial-gradient(ellipse 86% 74% at 50% 54%, #000 56%, rgba(0, 0, 0, 0.74) 72%, transparent 96%);
  mask-image: linear-gradient(180deg, transparent 0%, #000 12%, #000 78%, transparent 98%),
    radial-gradient(ellipse 86% 74% at 50% 54%, #000 56%, rgba(0, 0, 0, 0.74) 72%, transparent 96%);
  -webkit-mask-composite: source-in;
  mask-composite: intersect;
}

/* 仅当容器够宽、1040px 上限开始生效时，才改为按 148% 随容器缩放 */
@container (min-width: 704px) {
  .campus-visual img {
    width: 148%;
  }
}

.campus-tool {
  --stem-h: 58px;
  --stem-x: 50%;
  position: absolute;
  z-index: 4;
  min-width: 118px;
  min-height: 48px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #10172c;
  padding: 0;
  display: inline-flex;
  align-items: center;
  font: inherit;
  font-size: 13px;
  font-weight: 900;
  white-space: nowrap;
  cursor: pointer;
}

.campus-tool-content {
  box-sizing: border-box;
  width: 100%;
  min-width: 118px;
  min-height: 48px;
  border: 1px solid rgba(226, 232, 240, 0.68);
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.82);
  padding: 8px 14px 8px 9px;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    0 14px 30px -27px rgba(15, 23, 42, 0.28);
  transform-origin: center;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.campus-tool::after,
.campus-tool::before {
  content: '';
  position: absolute;
  left: var(--stem-x);
  pointer-events: none;
  transform: translateX(-50%);
}

.campus-tool::after {
  top: 100%;
  width: 1.5px;
  height: var(--stem-h);
  background: linear-gradient(180deg, rgba(59, 130, 246, 0.12), rgba(59, 130, 246, 0.68));
}

.campus-tool::before {
  top: calc(100% + var(--stem-h));
  width: 9px;
  height: 9px;
  border: 3px solid rgba(255, 255, 255, 0.88);
  border-radius: 999px;
  background: #3b82f6;
  box-shadow: 0 0 0 5px rgba(59, 130, 246, 0.12);
}

.position-interview::after,
.position-code::after,
.position-workshop::after {
  top: auto;
  bottom: 100%;
  background: linear-gradient(0deg, rgba(59, 130, 246, 0.12), rgba(59, 130, 246, 0.68));
}

.position-interview::before,
.position-code::before,
.position-workshop::before {
  top: auto;
  bottom: calc(100% + var(--stem-h));
}

.campus-tool:hover .campus-tool-content {
  transform: scale(1.06);
  border-color: rgba(147, 197, 253, 0.9);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.98),
    0 18px 38px -24px rgba(37, 99, 235, 0.4);
}

.campus-tool-icon {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28);
}

.campus-tool-icon svg {
  width: 16px;
  height: 16px;
}

.tone-blue .campus-tool-icon,
.metric-card-blue .metric-icon {
  background: linear-gradient(145deg, #1d7cff, #155eef);
}

.tone-green .campus-tool-icon,
.metric-card-green .metric-icon {
  background: linear-gradient(145deg, #19c785, #059669);
}

.tone-violet .campus-tool-icon,
.metric-card-violet .metric-icon {
  background: linear-gradient(145deg, #8b5cf6, #6d4df2);
}

.tone-orange .campus-tool-icon {
  background: linear-gradient(145deg, #fb923c, #f97316);
}

.tone-sky .campus-tool-icon {
  background: linear-gradient(145deg, #38bdf8, #0ea5e9);
}

.tone-cyan .campus-tool-icon {
  background: linear-gradient(145deg, #2dd4bf, #06b6d4);
}

.tone-slate .campus-tool-icon {
  background: linear-gradient(145deg, #64748b, #334155);
}

.position-image {
  --stem-h: 68px;
  --stem-x: 46%;
  left: 9%;
  top: 21%;
}

.position-qa {
  --stem-h: 62px;
  left: 33%;
  top: 10%;
}

.position-meeting {
  --stem-h: 62px;
  left: 56%;
  top: 8%;
}

.position-ppt {
  --stem-h: 74px;
  right: 4%;
  top: 20%;
}

.position-interview,
.position-code,
.position-workshop,
.position-more {
  --stem-h: 40px;
}

.position-interview {
  left: 21%;
  bottom: 13%;
}

.position-code {
  left: 48%;
  bottom: 29%;
}

.position-workshop {
  right: 3%;
  bottom: 43%;
}

.position-more {
  left: 26%;
  bottom: 60%;
}

.quick-metrics {
  position: relative;
  z-index: 5;
  grid-column: 1 / -1;
  grid-row: 2;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.metric-card {
  --metric-accent: #2563eb;
  --metric-accent-dark: #1d4ed8;
  --metric-soft: rgba(219, 234, 254, 0.58);
  position: relative;
  min-height: 168px;
  box-sizing: border-box;
  border: 1px solid rgba(226, 232, 240, 0.68);
  border-radius: 18px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(248, 251, 255, 0.78)),
    rgba(255, 255, 255, 0.7);
  padding: 12px;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
  overflow: hidden;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.88),
    0 18px 34px -34px rgba(15, 23, 42, 0.26);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.metric-card::after {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  content: '';
  background:
    linear-gradient(135deg, var(--metric-soft), transparent 42%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.2), transparent 58%);
  opacity: 0.72;
}

.metric-card:hover {
  border-color: color-mix(in srgb, var(--metric-accent) 28%, rgba(226, 232, 240, 0.78));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.94),
    0 22px 40px -32px rgba(15, 23, 42, 0.34);
  transform: translateY(-2px);
}

.metric-card > * {
  position: relative;
  z-index: 1;
}

.metric-card-green {
  --metric-accent: #10b981;
  --metric-accent-dark: #047857;
  --metric-soft: rgba(209, 250, 229, 0.58);
}

.metric-card-violet,
.trend-metric-card {
  --metric-accent: #7c3aed;
  --metric-accent-dark: #6d28d9;
  --metric-soft: rgba(237, 233, 254, 0.62);
}

.period-metric-card {
  grid-column: auto;
}

.metric-card-head {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.period-card-head {
  position: relative;
  padding-right: 0;
  align-items: center;
}

.metric-icon {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  background: linear-gradient(145deg, var(--metric-accent), var(--metric-accent-dark));
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.24),
    0 12px 22px -17px rgba(15, 23, 42, 0.44);
}

.metric-icon svg {
  width: 15px;
  height: 15px;
}

.metric-title {
  min-width: 0;
  flex: 1 1 auto;
}

.period-metric-card .metric-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.metric-title > span,
.trend-title > span {
  display: block;
  overflow: hidden;
  color: #334155;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.1;
}

.metric-title strong,
.trend-title strong {
  display: block;
  margin-top: 7px;
  margin-bottom: 0;
  color: #0f172a;
  font-size: 13px;
  line-height: 1;
  font-weight: 950;
  white-space: nowrap;
}

.period-metric-card .metric-title strong {
  margin-top: 0;
}

.metric-title strong em,
.trend-title strong em {
  margin-right: 4px;
  color: var(--metric-accent);
  font-style: normal;
  font-size: 24px;
  font-weight: 950;
}

.metric-period-switch {
  position: absolute;
  top: 38px;
  right: 0;
  flex: 0 0 auto;
  padding: 2px;
  border-radius: 999px;
  background: rgba(241, 245, 249, 0.9);
  display: inline-flex;
  gap: 2px;
}

.metric-period-switch button {
  width: 24px;
  height: 22px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #64748b;
  font: inherit;
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
}

.metric-period-switch button.active {
  background: #ffffff;
  color: var(--metric-accent);
  box-shadow: 0 6px 14px -12px rgba(15, 23, 42, 0.4);
}

.metric-icon-violet {
  background: linear-gradient(145deg, #8b5cf6, #6d28d9);
}

.metric-card p {
  margin-top: 0;
  color: #64748b;
  font-size: 11px;
  font-weight: 850;
  line-height: 1.3;
}

.metric-card-today {
  display: flex;
  flex-direction: column;
}

.today-card-headline {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.today-card-title {
  overflow: hidden;
  color: #334155;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.1;
}

.today-pending-count {
  margin: 0;
  flex: 0 0 auto;
  color: #0f172a;
  font-size: 13px;
  line-height: 1;
  font-weight: 950;
  white-space: nowrap;
}

.today-pending-count em {
  margin-right: 2px;
  color: var(--metric-accent);
  font-style: normal;
  font-size: 24px;
  font-weight: 950;
}

.today-card-body {
  margin-top: auto;
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.today-meta {
  margin: 0;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: #94a3b8;
  font-size: 10px;
  font-weight: 800;
}

.today-progress-track {
  height: 5px;
  border-radius: 999px;
  background: rgba(226, 232, 240, 0.88);
  overflow: hidden;
}

.today-progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--metric-accent), #60a5fa);
  transition: width 0.28s ease;
}

.today-next-event {
  min-width: 0;
  min-height: 36px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 10px;
  border-radius: 10px;
  background: rgba(239, 246, 255, 0.72);
  border: 1px solid rgba(147, 197, 253, 0.28);
}

.today-next-label {
  flex: 0 0 auto;
  color: #94a3b8;
  font-size: 10px;
  font-weight: 850;
}

.today-next-time {
  flex: 0 0 auto;
  color: var(--metric-accent);
  font-size: 11px;
  font-weight: 950;
}

.today-next-title {
  min-width: 0;
  overflow: hidden;
  color: #475569;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 850;
}

.today-next-empty {
  color: #94a3b8;
  font-size: 10px;
  font-weight: 800;
}

.week-progress {
  height: 8px;
  margin-top: 14px;
  border-radius: 999px;
  background: rgba(226, 232, 240, 0.86);
  overflow: hidden;
}

.period-week-progress {
  margin-top: 34px;
}

.week-progress span {
  display: block;
  width: 0;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--metric-accent), #22c55e);
  transition: width 0.24s ease;
}

.metric-status-grid {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
}

.metric-status-grid span {
  min-width: 0;
  min-height: 38px;
  box-sizing: border-box;
  border: 1px solid rgba(226, 232, 240, 0.68);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.58);
  color: #64748b;
  padding: 6px 1px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  text-align: center;
  font-size: 9px;
  font-weight: 850;
  line-height: 1;
  white-space: nowrap;
}

.metric-status-grid strong {
  color: var(--metric-accent-dark);
  font-size: 15px;
  font-weight: 950;
  line-height: 1;
}

.month-card-body {
  margin-top: 9px;
}

.period-metric-card .month-card-body {
  margin-top: 34px;
}

.month-card-body p {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.month-heatmap {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px 3px;
}

.month-heatmap span {
  height: 7px;
  border-radius: 3px;
  background: #e2e8f0;
  outline: 0 solid transparent;
}

.month-heatmap .heat-1 {
  background: rgba(124, 58, 237, 0.32);
}

.month-heatmap .heat-2 {
  background: rgba(124, 58, 237, 0.48);
}

.month-heatmap .heat-3 {
  background: rgba(124, 58, 237, 0.66);
}

.month-heatmap .heat-4 {
  background: rgba(124, 58, 237, 0.86);
}

.month-heatmap .is-today {
  outline: 1px solid #7c3aed;
  outline-offset: 1px;
}

.trend-metric-card {
  padding: 12px 10px 9px;
}

.trend-card-head {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 7px;
  min-height: 37px;
}

.trend-title {
  min-width: 0;
  flex: 1 1 auto;
}

.trend-title strong {
  color: #0f172a;
}

.trend-title strong em {
  margin-left: 1px;
  color: #0f172a;
  font-size: 13px;
  font-style: normal;
}

.trend-switch {
  position: absolute;
  top: 0;
  right: 0;
  flex: 0 0 auto;
  padding: 2px;
  border-radius: 999px;
  background: rgba(241, 245, 249, 0.9);
  display: inline-flex;
  gap: 2px;
}

.trend-switch button {
  width: 24px;
  height: 20px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #64748b;
  font: inherit;
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
}

.trend-switch button.active {
  background: #ffffff;
  color: var(--metric-accent);
  box-shadow: 0 6px 14px -12px rgba(15, 23, 42, 0.4);
}

.trend-insight {
  margin-top: 7px;
  overflow: hidden;
  color: #64748b;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  font-weight: 850;
}

.trend-chart {
  width: 100%;
  height: 52px;
  margin-top: 5px;
  overflow: visible;
  display: block;
}

.trend-chart line {
  stroke: rgba(203, 213, 225, 0.58);
  stroke-width: 1;
}

.trend-chart polygon {
  fill: rgba(124, 58, 237, 0.1);
}

.trend-chart polyline {
  fill: none;
  stroke: var(--metric-accent);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.trend-chart circle {
  fill: #ffffff;
  stroke: var(--metric-accent);
  stroke-width: 2;
}

.trend-labels {
  margin-top: -7px;
  display: flex;
  justify-content: space-between;
  color: #94a3b8;
  font-size: 9px;
  font-weight: 850;
}

.agent-panel {
  grid-column: 1 / 3;
  grid-row: 2;
  border-radius: 22px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.82), rgba(241, 245, 249, 0.56)),
    rgba(255, 255, 255, 0.68);
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.section-head h2 {
  color: #111827;
  font-size: 20px;
  line-height: 1.15;
}

.section-head > span,
.section-actions > span {
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4338ca;
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 850;
  white-space: nowrap;
}

.section-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.section-actions button {
  min-height: 28px;
  border: 1px solid #e5edf6;
  border-radius: 999px;
  background: #ffffff;
  color: #475569;
  padding: 0 11px;
  font: inherit;
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
}

.section-actions button:hover {
  border-color: #111827;
  background: #111827;
  color: #ffffff;
}

.agent-list {
  min-height: 0;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding-right: 2px;
  align-content: start;
}

.agent-list::-webkit-scrollbar,
.day-preview-popover::-webkit-scrollbar {
  width: 0;
}

.agent-card {
  position: relative;
  min-height: 108px;
  box-sizing: border-box;
  border: 1px solid rgba(226, 232, 240, 0.82);
  border-radius: 16px;
  background: linear-gradient(140deg, rgba(255, 255, 255, 0.92), rgba(248, 250, 252, 0.64)),
    rgba(255, 255, 255, 0.72);
  padding: 15px 14px 14px;
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr);
  grid-template-rows: auto auto;
  align-items: start;
  gap: 8px 12px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.74),
    0 16px 30px -30px rgba(15, 23, 42, 0.4);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.agent-card:hover {
  transform: translateY(-2px);
  border-color: rgba(147, 197, 253, 0.72);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.86),
    0 20px 34px -28px rgba(37, 99, 235, 0.36);
}

.agent-icon {
  width: 46px;
  height: 46px;
  border-radius: 15px;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 900;
  box-shadow: 0 14px 24px -18px rgba(15, 23, 42, 0.42);
}

.agent-main {
  min-width: 0;
}

.agent-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.agent-title h3 {
  min-width: 0;
  overflow: hidden;
  color: #111827;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  line-height: 1.25;
}

.agent-main p,
.profile-top p {
  margin-top: 6px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.45;
}

.agent-main p {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.agent-badge {
  grid-column: 2;
  width: fit-content;
  min-height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(241, 245, 249, 0.84);
  color: #475569;
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 850;
  align-self: end;
}

.agent-menu {
  position: absolute;
  top: 13px;
  right: 10px;
  width: 24px;
  height: 28px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #94a3b8;
  font: inherit;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease;
}

.agent-menu:hover {
  background: rgba(241, 245, 249, 0.86);
  color: #334155;
}

.profile-panel {
  position: relative;
  z-index: 25;
  grid-column: 1;
  grid-row: 1;
  align-self: start;
  top: auto;
  left: auto;
  padding: 0;
  background: transparent;
}

.profile-welcome-panel.has-profile-dialog .profile-panel {
  z-index: 1110;
}

.profile-menu-anchor {
  position: relative;
  width: min(100%, 520px);
  max-width: 100%;
}

.profile-trigger {
  width: fit-content;
  max-width: 100%;
  border: 0;
  border-radius: 18px;
  background: transparent;
  padding: 0;
  color: inherit;
  font: inherit;
  display: inline-flex;
  align-items: center;
  gap: 13px;
  text-align: left;
  cursor: pointer;
}

.profile-trigger:focus-visible {
  outline: 2px solid rgba(37, 99, 235, 0.36);
  outline-offset: 6px;
}

.profile-task-summary {
  max-width: min(100%, 520px);
  color: #64748b;
  transform: translate(10px, 20px);
}

.profile-task-summary p {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  color: #475569;
  font-size: 13px;
  font-weight: 850;
  line-height: 1.35;
}

.profile-task-summary strong {
  color: #2563eb;
  font-size: 15px;
  font-weight: 950;
  line-height: 1;
}

.profile-task-summary i {
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: #cbd5e1;
}

.profile-task-summary span {
  display: -webkit-box;
  max-width: 100%;
  margin-top: 5px;
  overflow: hidden;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.avatar {
  width: 42px;
  height: 42px;
  border: 1px solid rgba(226, 232, 240, 0.76);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.42);
  object-fit: cover;
  flex: 0 0 auto;
}

.profile-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.profile-copy strong {
  color: #111827;
  font-size: clamp(18px, 1.28vw, 22px);
  font-weight: 900;
  line-height: 1.08;
  letter-spacing: 0;
}

.role-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.role-switch button {
  min-height: 44px;
  border: 1px solid #e5edf6;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.4);
  color: #64748b;
  font: inherit;
  font-size: 14px;
  font-weight: 850;
  cursor: pointer;
}

.role-switch button.active {
  border-color: #111827;
  background: #111827;
  color: #ffffff;
}

.point-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.point-grid span {
  min-height: 86px;
  border: 1px solid rgba(226, 232, 240, 0.88);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.34);
  padding: 13px 8px;
  color: #64748b;
  display: flex;
  flex-direction: column;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
  text-align: center;
}

.point-grid strong {
  margin-bottom: 7px;
  color: #0f172a;
  font-size: 27px;
  line-height: 1;
}

.profile-dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 1090;
  background: transparent;
}

.profile-dialog {
  position: absolute;
  top: calc(100% + 14px);
  left: 0;
  z-index: 1111;
  width: min(390px, calc(100vw - 44px));
  border: 1px solid rgba(226, 232, 240, 0.92);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 26px 70px -36px rgba(15, 23, 42, 0.58);
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.profile-dialog-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
}

.profile-dialog-user {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 13px;
}

.dialog-avatar {
  width: 58px;
  height: 58px;
  border-radius: 18px;
  background: #dbeafe;
  object-fit: cover;
  flex: 0 0 auto;
}

.profile-dialog-user h2 {
  color: #111827;
  font-size: 22px;
  line-height: 1.15;
}

.profile-dialog-user p {
  margin-top: 6px;
  color: #64748b;
  font-size: 12px;
  font-weight: 750;
}

.dialog-close {
  width: 32px;
  height: 32px;
  border: 1px solid #e5edf6;
  border-radius: 999px;
  background: #ffffff;
  color: #64748b;
  font: inherit;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.dialog-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dialog-label {
  color: #64748b;
  font-size: 12px;
  font-weight: 900;
}

@media (max-width: 1120px) {
  .calendar-workspace {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: auto;
    overflow: auto;
  }

  .profile-welcome-panel,
  .left-column {
    grid-column: 1 / -1;
    grid-row: auto;
  }

  .profile-welcome-panel {
    min-height: 720px;
  }
}

@media (max-width: 900px) {
  .calendar-workspace {
    display: flex;
    flex-direction: column;
    grid-template-columns: 1fr;
    padding: 16px;
  }

  .left-column,
  .profile-welcome-panel {
    display: flex;
    flex-direction: column;
  }

  .calendar-panel {
    min-height: 540px;
  }

  .left-preview-scrim {
    display: none;
  }

  .day-preview-popover {
    position: relative;
    top: auto;
    right: auto;
    width: 100%;
    height: 462px;
    margin-bottom: 0;
    border-radius: 18px;
    transform: none;
  }

  .profile-welcome-panel {
    min-height: 680px;
  }
}

@media (max-width: 620px) {
  .calendar-workspace {
    padding: 12px;
    gap: 12px;
    overflow-x: hidden;
  }

  .layout-column {
    gap: 12px;
  }

  .welcome-panel,
  .profile-panel,
  .day-preview-popover {
    padding: 14px;
    border-radius: 16px;
  }

  .profile-welcome-panel {
    height: auto;
    min-height: auto;
    padding: 14px 12px;
    overflow: visible;
    overflow-x: clip;
  }

  .profile-panel {
    position: relative;
    top: auto;
    left: auto;
    padding: 0 0 12px;
  }

  .welcome-panel {
    min-height: 0;
    display: grid;
    grid-template-rows: 390px auto;
    gap: 14px;
  }

  .section-head {
    flex-direction: row;
    align-items: center;
  }

  .campus-visual {
    width: 100%;
    min-height: 390px;
    padding-top: 0;
    overflow: hidden;
  }

  .campus-visual img {
    left: 50%;
    right: auto;
    bottom: 12px;
    width: 760px;
    max-height: 340px;
    transform: translateX(-48%);
  }

  .campus-visual::before {
    inset: 12px 8px 14px;
  }

  .campus-visual::after {
    inset: auto -8% -2px;
    width: auto;
  }

  .campus-tool {
    min-width: 112px;
    min-height: 46px;
    font-size: 12px;
  }

  .campus-tool-content {
    min-width: 112px;
    min-height: 46px;
    border-radius: 14px;
    padding: 8px 12px 8px 9px;
    gap: 8px;
  }

  .campus-tool-icon {
    width: 28px;
    height: 28px;
    border-radius: 9px;
  }

  .campus-tool-icon svg {
    width: 15px;
    height: 15px;
  }

  .position-image {
    left: 1%;
    top: 30%;
  }

  .position-qa {
    left: 21%;
    top: 12%;
  }

  .position-meeting {
    left: 48%;
    top: 7%;
  }

  .position-ppt {
    right: 1%;
    top: 24%;
  }

  .position-interview {
    left: 3%;
    bottom: 10%;
  }

  .position-code {
    left: 36%;
    bottom: 7%;
  }

  .position-workshop {
    right: 1%;
    bottom: 10%;
  }

  .quick-metrics {
    grid-template-columns: 1fr;
  }

  .metric-card {
    min-height: 136px;
    padding: 14px;
  }

  .period-metric-card {
    grid-column: auto;
  }

  .metric-status-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .month-heatmap span {
    height: 8px;
  }

  .calendar-panel {
    min-height: 500px;
  }

  .agent-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .agent-card {
    min-height: 132px;
    grid-template-columns: 42px minmax(0, 1fr);
    padding: 14px 12px;
  }

  .agent-icon {
    width: 42px;
    height: 42px;
  }

  .agent-title h3 {
    font-size: 14px;
  }

  .agent-main p {
    -webkit-line-clamp: 3;
  }

  .agent-badge {
    grid-column: 2;
    width: fit-content;
  }

  .point-grid {
    grid-template-columns: 1fr;
  }
}
</style>
