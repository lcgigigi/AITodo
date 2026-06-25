<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as echarts from 'echarts'
import IconCalendarDays from '~icons/lucide/calendar-days'
import IconCalendarRange from '~icons/lucide/calendar-range'
import IconChevronLeft from '~icons/lucide/chevron-left'
import IconChevronRight from '~icons/lucide/chevron-right'
import IconClipboardList from '~icons/lucide/clipboard-list'
import IconSquareCheck from '~icons/lucide/square-check'
import IconPresentation from '~icons/lucide/presentation'
import IconSendHorizontal from '~icons/lucide/send-horizontal'
import { routeConfig } from '@/config/route.config'
import { useFeedbackStore } from '@/stores/feedback.store'
import DayPreviewPanel from './DayPreviewPanel.vue'
import type {
  CalendarDay,
  CalendarEventStatus,
  CalendarSpecialDay,
  CalendarTodoDraft,
  CalendarTodoUpdate,
} from './types'
import { dateRange } from './todoDisplay'
import {
  createTodo as serviceCreateTodo,
  deleteTodo as serviceDeleteTodo,
  getTodoMonthRange,
  getTodoWeekRange,
  loadTodoDetail,
  updateTodo as serviceUpdateTodo,
  updateTodoStatus as serviceUpdateTodoStatus,
} from './todo.service'
import { useDashboardTodos } from './useDashboardTodos'

type TodoStatusFilter = 'all' | 'pending' | 'done'
type TodoTypeFilter = 'all' | 'task' | 'meeting'

type DayPreviewPanelExpose = {
  showDiscardWarning: (onConfirm?: () => void) => void
  openEventDetailById: (id: string) => boolean
  applyStatusFilter: (filter: TodoStatusFilter) => void
  applyTypeFilter: (filter: TodoTypeFilter) => void
}

const now = ref(new Date())
const selectedDate = ref(ymd(now.value))
const currentMonth = ref(new Date(now.value.getFullYear(), now.value.getMonth(), 1))
const isDayPreviewOpen = ref(false)
const quickCreatePrompt = ref('')
const homeQuickTodoText = ref('')
const quickCreateKey = ref(0)
const presetCreateTime = ref('')
const presetCreateKey = ref(0)
const isDayPreviewFormDirty = ref(false)
const dayPreviewPanelRef = ref<DayPreviewPanelExpose | null>(null)
const trendChartRef = ref<HTMLElement | null>(null)
const calendarViewMode = ref<'month' | 'week'>('month')
const trendStatMode = ref<'week' | 'month'>('week')
const route = useRoute()
const router = useRouter()
const feedbackStore = useFeedbackStore()
let clockTimer: ReturnType<typeof setInterval> | undefined
let trendChart: echarts.ECharts | undefined
let trendChartResizeObserver: ResizeObserver | undefined
let isConsumingDesktopTodoText = false

const trendChartTextStyle = {
  color: '#64748b',
  fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", Arial, sans-serif',
}

const {
  allEvents,
  assignableUsers,
  currentUser,
  eventMap,
  events,
  initializeDashboardTodos,
  refreshTodos,
} = useDashboardTodos({
  getLoadRange: getActiveTodoLoadRange,
  onUnauthorized: redirectToLogin,
})

onMounted(async () => {
  clockTimer = setInterval(() => {
    now.value = new Date()
  }, 60_000)
  void initializeDashboardData()
  await nextTick()
  renderTrendChart()
  trendChartResizeObserver = new ResizeObserver(() => {
    trendChart?.resize()
  })
  if (trendChartRef.value) trendChartResizeObserver.observe(trendChartRef.value)
})

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
  disposeTrendChart()
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

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getMonthGridCellCount(year: number, month: number) {
  const start = new Date(year, month, 1)
  const offset = (start.getDay() + 6) % 7
  const dayCount = getDaysInMonth(year, month)
  const rowCount = Math.ceil((offset + dayCount) / 7)
  return rowCount * 7
}

function completedEventCountByDate(date: string) {
  return events.value.filter(
    (event) => event.status === 'done' && dateRange(event.date, event.endDate).includes(date),
  ).length
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
const canSubmitHomeQuickTodo = computed(() => Boolean(homeQuickTodoText.value.trim()))

const days = computed<CalendarDay[]>(() => {
  const result: CalendarDay[] = []
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  const start = new Date(year, month, 1)
  const offset = (start.getDay() + 6) % 7
  const cursor = new Date(year, month, 1 - offset)
  const cellCount = getMonthGridCellCount(year, month)

  for (let i = 0; i < cellCount; i += 1) {
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

const selectedEvents = computed(() => eventMap.value.get(selectedDate.value) ?? [])
const selectedSpecialDays = computed(() => specialDayMap.value.get(selectedDate.value) ?? [])
const todayEvents = computed(() => eventMap.value.get(todayDate.value) ?? [])
const todayPendingEvents = computed(() =>
  todayEvents.value.filter((event) => event.status !== 'done'),
)
const todayMeetingCount = computed(
  () => todayEvents.value.filter((event) => event.type === 'meeting').length,
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
const todoLoadRangeKey = computed(() => {
  const range =
    calendarViewMode.value === 'week'
      ? getTodoWeekRange(selectedDate.value)
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
      isSelected: date === selectedDate.value,
    }
  }),
)
const homeDateLabel = computed(() => {
  const date = new Date(`${selectedDate.value}T12:00:00`)
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日 ${weekday}`
})
const todayCompletionSummary = computed(() =>
  todayEvents.value.length
    ? `${todayCompletedCount.value} / ${todayEvents.value.length} 已完成`
    : '0 / 0 已完成',
)
const todayTaskProgress = computed(() =>
  todayEvents.value.length
    ? Math.round((todayCompletedCount.value / todayEvents.value.length) * 100)
    : 0,
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
function createTrendChartOption(): echarts.EChartsOption {
  const series = trendSeries.value
  const accent = '#7c3aed'

  return {
    animationDuration: 500,
    grid: { top: 8, right: 6, bottom: 14, left: 4 },
    tooltip: {
      trigger: 'axis',
      confine: true,
      formatter: (params: unknown) => {
        const item = (Array.isArray(params) ? params[0] : params) as { name: string; value: number }
        return `${item.name}<br/>${Number(item.value)} 项`
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: series.map((item) => item.label),
      axisLine: { lineStyle: { color: 'rgba(203, 213, 225, 0.58)' } },
      axisTick: { show: false },
      axisLabel: {
        ...trendChartTextStyle,
        color: '#94a3b8',
        fontSize: 9,
        fontWeight: 850,
        margin: 4,
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      splitNumber: 3,
      axisLabel: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: 'rgba(203, 213, 225, 0.58)' } },
    },
    series: [
      {
        name: '完成待办',
        type: 'line',
        data: series.map((item) => item.value),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2.5, color: accent },
        itemStyle: { color: accent, borderColor: '#ffffff', borderWidth: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(124, 58, 237, 0.18)' },
            { offset: 1, color: 'rgba(124, 58, 237, 0.02)' },
          ]),
        },
      },
    ],
  }
}

function renderTrendChart() {
  const el = trendChartRef.value
  if (!el) return

  trendChart = echarts.getInstanceByDom(el) ?? echarts.init(el, undefined, { renderer: 'canvas' })
  trendChart.setOption(createTrendChartOption(), true)
}

function disposeTrendChart() {
  trendChartResizeObserver?.disconnect()
  trendChartResizeObserver = undefined
  trendChart?.dispose()
  trendChart = undefined
}

watch(
  () => [trendSeries.value, trendStatMode.value, allEvents.value.length] as const,
  async () => {
    await nextTick()
    renderTrendChart()
  },
  { deep: true },
)

const selectedDateLabel = computed(() => {
  const date = new Date(`${selectedDate.value}T12:00:00`)
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekday}`
})

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

function changeHomeWeek(delta: number) {
  const nextDate = new Date(`${selectedDate.value}T12:00:00`)
  nextDate.setDate(nextDate.getDate() + delta * 7)
  selectDate(ymd(nextDate))
}

function openDayPreviewWithStatusFilter(date: string, filter: TodoStatusFilter) {
  const applyFilter = () => {
    void nextTick(() => {
      dayPreviewPanelRef.value?.applyStatusFilter(filter)
    })
  }

  const openSelectedDay = () => {
    isDayPreviewFormDirty.value = false
    quickCreatePrompt.value = ''
    presetCreateTime.value = ''
    selectDate(date, calendarViewMode.value === 'week')
    openTodoPanel()
    applyFilter()
  }

  if (isDayPreviewOpen.value && selectedDate.value === date) {
    const switchFilter = () => {
      isDayPreviewFormDirty.value = false
      applyFilter()
    }

    if (!confirmDiscardPreviewChanges(switchFilter)) return

    switchFilter()
    return
  }

  if (isDayPreviewOpen.value && !confirmDiscardPreviewChanges(openSelectedDay)) return

  openSelectedDay()
}

function openDayPreviewWithTypeFilter(date: string, filter: TodoTypeFilter) {
  const applyFilter = () => {
    void nextTick(() => {
      dayPreviewPanelRef.value?.applyTypeFilter(filter)
    })
  }

  const openSelectedDay = () => {
    isDayPreviewFormDirty.value = false
    quickCreatePrompt.value = ''
    presetCreateTime.value = ''
    selectDate(date, calendarViewMode.value === 'week')
    openTodoPanel()
    applyFilter()
  }

  if (isDayPreviewOpen.value && selectedDate.value === date) {
    const switchFilter = () => {
      isDayPreviewFormDirty.value = false
      applyFilter()
    }

    if (!confirmDiscardPreviewChanges(switchFilter)) return

    switchFilter()
    return
  }

  if (isDayPreviewOpen.value && !confirmDiscardPreviewChanges(openSelectedDay)) return

  openSelectedDay()
}

function closeDayPreview() {
  const closePreview = () => {
    isDayPreviewOpen.value = false
    isDayPreviewFormDirty.value = false
  }

  if (!confirmDiscardPreviewChanges(closePreview)) return

  closePreview()
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
    ? getTodoWeekRange(selectedDate.value)
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

  if (quickCreateTodo(prompt, todayDate.value)) {
    homeQuickTodoText.value = ''
  }
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
    <div
      v-if="isDayPreviewOpen"
      class="left-preview-scrim"
      role="presentation"
      @click.stop="closeDayPreview"
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

      <section class="home-main-panel" aria-label="今日待办">
        <div class="home-main-head">
          <div class="home-title-metrics">
            <div class="home-summary-grid" aria-label="今日待办统计">
              <button
                type="button"
                class="home-summary-card meeting-card"
                aria-label="查看今日会议"
                @click.stop="openDayPreviewWithTypeFilter(todayDate, 'meeting')"
              >
                <IconPresentation class="home-summary-icon" aria-hidden="true" />
                <span class="home-summary-label">会议</span>
                <strong class="home-summary-value">{{ todayMeetingCount }}</strong>
              </button>
              <button
                type="button"
                class="home-summary-card pending-card"
                aria-label="查看今日待处理待办"
                @click.stop="openDayPreviewWithStatusFilter(todayDate, 'pending')"
              >
                <IconClipboardList class="home-summary-icon" aria-hidden="true" />
                <span class="home-summary-label">待处理</span>
                <strong class="home-summary-value">{{ todayPendingEvents.length }}</strong>
              </button>
              <button
                type="button"
                class="home-summary-card completed-card"
                aria-label="查看今日已完成待办"
                @click.stop="openDayPreviewWithStatusFilter(todayDate, 'done')"
              >
                <IconSquareCheck class="home-summary-icon" aria-hidden="true" />
                <span class="home-summary-label">已完成</span>
                <strong class="home-summary-value">{{ todayCompletedCount }}</strong>
              </button>
              <button
                type="button"
                class="home-summary-card all-card"
                aria-label="查看今日全部待办"
                @click.stop="openDayPreviewWithStatusFilter(todayDate, 'all')"
              >
                <IconCalendarRange class="home-summary-icon" aria-hidden="true" />
                <span class="home-summary-label">全部</span>
                <strong class="home-summary-value">{{ todayEvents.length }}</strong>
              </button>
            </div>
          </div>

          <section class="home-week-card" aria-label="本周日期">
            <header class="home-week-head">
              <div>
                <IconCalendarDays aria-hidden="true" />
                <strong>{{ homeDateLabel }}</strong>
              </div>
              <div class="home-week-actions" aria-label="切换周">
                <button type="button" aria-label="上一周" @click.stop="changeHomeWeek(-1)">
                  <IconChevronLeft aria-hidden="true" />
                </button>
                <button type="button" aria-label="下一周" @click.stop="changeHomeWeek(1)">
                  <IconChevronRight aria-hidden="true" />
                </button>
              </div>
            </header>
            <div class="home-week-strip">
              <button
                v-for="day in homeWeekDays"
                :key="day.date"
                type="button"
                :class="{ active: day.isSelected, 'is-today': day.isToday }"
                @click.stop="selectDate(day.date)"
              >
                <strong>{{ day.day }}</strong>
                <span>{{ day.weekday }}</span>
              </button>
            </div>
          </section>
        </div>

        <form class="home-main-quick-create" @submit.prevent.stop="submitHomeQuickTodo">
          <input
            id="home-quick-todo"
            v-model="homeQuickTodoText"
            type="text"
            autocomplete="off"
            aria-label="一句话新增"
            placeholder="一句话新增待办..."
          />
          <button type="submit" :disabled="!canSubmitHomeQuickTodo" aria-label="解析并新增待办">
            <IconSendHorizontal aria-hidden="true" />
          </button>
        </form>
      </section>

      <section class="floating-stats" aria-label="效率统计">
        <article class="home-stat-card completion-stat-card">
          <h2>今日完成率</h2>
          <div class="completion-stat-body">
            <div
              class="completion-donut"
              :style="{ '--completion': `${todayTaskProgress * 3.6}deg` }"
              aria-label="今日完成率"
            >
              <div>
                <strong>{{ todayTaskProgress }}%</strong>
                <span>{{ todayCompletionSummary }}</span>
              </div>
            </div>
            <div class="completion-copy">
              <strong
                >待处理 <em>{{ todayPendingEvents.length }}</em> 项</strong
              >
              <span>任务总数 {{ todayEvents.length }} 项</span>
            </div>
          </div>
        </article>

        <article class="home-stat-card trend-stat-card">
          <header>
            <h2>本周趋势</h2>
            <button
              type="button"
              @click.stop="trendStatMode = trendStatMode === 'week' ? 'month' : 'week'"
            >
              {{ trendStatMode === 'week' ? '本周' : '本月' }}
            </button>
          </header>
          <div ref="trendChartRef" class="home-trend-chart" aria-label="完成趋势"></div>
        </article>
      </section>
    </section>
  </div>
</template>

<style scoped>
.calendar-workspace {
  --home-module-height: clamp(190px, 19.6vh, 224px);
  --home-glass-border: rgba(255, 255, 255, 0.66);
  --home-glass-bg: linear-gradient(145deg, rgba(255, 255, 255, 0.5), rgba(242, 248, 255, 0.34)),
    rgba(248, 252, 255, 0.4);
  --home-glass-shadow: 0 16px 36px -32px rgba(8, 30, 64, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.78);
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

.left-preview-scrim {
  position: fixed;
  inset: 0;
  z-index: 80;
  width: auto;
  border-radius: 0;
  background: rgba(15, 23, 42, 0.12);
  box-shadow: none;
  pointer-events: auto;
}

.left-column {
  position: absolute;
  inset: 0;
  display: block;
  min-height: 0;
  pointer-events: none;
}

.home-main-panel,
.floating-stats,
.day-preview-popover {
  pointer-events: auto;
}

.home-main-panel {
  position: absolute;
  right: clamp(32px, 2.4vw, 48px);
  bottom: clamp(24px, 3.2vh, 40px);
  width: clamp(640px, 38vw, 800px);
  height: var(--home-module-height);
  box-sizing: border-box;
  border: 1px solid var(--home-glass-border);
  border-radius: 20px;
  background: var(--home-glass-bg);
  padding: 14px 16px;
  display: grid;
  grid-template-rows: minmax(0, 1fr) 36px;
  gap: 10px;
  overflow: hidden;
  box-shadow: var(--home-glass-shadow);
  backdrop-filter: blur(25px) saturate(1.16);
  -webkit-backdrop-filter: blur(25px) saturate(1.16);
}

.home-stat-card h2 {
  margin: 0;
  color: var(--home-ink);
  letter-spacing: 0;
}

.home-main-head {
  min-height: 0;
  height: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1.26fr) minmax(280px, 0.9fr);
  gap: 10px;
}

.home-title-metrics {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.home-summary-grid {
  flex: 1 1 auto;
  min-height: 0;
  border: 1px solid rgba(255, 255, 255, 0.54);
  border-radius: 14px;
  background: rgba(229, 241, 250, 0.72);
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  overflow: hidden;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.66);
}

.home-summary-card {
  min-width: 0;
  border: 0;
  border-right: 1px solid rgba(196, 212, 228, 0.66);
  background: transparent;
  color: var(--home-ink);
  padding: 6px 4px 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  font: inherit;
  cursor: pointer;
  transition:
    background 0.18s ease,
    transform 0.18s ease;
}

.home-summary-card:last-child {
  border-right: 0;
}

.home-summary-card:hover {
  background: rgba(255, 255, 255, 0.28);
  transform: translateY(-1px);
}

.home-summary-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
}

.home-summary-label {
  color: #56657d;
  font-size: 11px;
  line-height: 1;
  font-weight: 900;
  white-space: nowrap;
}

.home-summary-value {
  color: var(--home-ink);
  font-size: clamp(14px, 1.05vw, 16px);
  line-height: 1;
  font-weight: 950;
}

.meeting-card .home-summary-icon {
  color: #438bff;
}

.pending-card .home-summary-icon {
  color: #ff8a4c;
}

.completed-card .home-summary-icon {
  color: #28c879;
}

.all-card .home-summary-icon {
  color: #6d7c93;
}

.home-week-card {
  min-width: 0;
  min-height: 0;
  border: 1px solid rgba(255, 255, 255, 0.58);
  border-radius: 14px;
  background: rgba(226, 239, 249, 0.72);
  padding: 8px 10px 6px;
  display: grid;
  grid-template-rows: 22px minmax(0, 1fr);
  gap: 6px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.66);
}

.home-week-head,
.home-week-head > div,
.home-week-actions {
  display: flex;
  align-items: center;
}

.home-week-head {
  justify-content: space-between;
  gap: 12px;
}

.home-week-head > div:first-child {
  min-width: 0;
  gap: 6px;
}

.home-week-head svg {
  width: 16px;
  height: 16px;
  color: #438bff;
  flex: 0 0 auto;
}

.home-week-head strong {
  overflow: hidden;
  color: var(--home-ink);
  font-size: 13px;
  line-height: 1;
  font-weight: 950;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-week-actions {
  gap: 6px;
}

.home-week-actions button {
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 999px;
  background: rgba(210, 226, 240, 0.82);
  color: #6d7c93;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.home-week-actions button svg {
  width: 13px;
  height: 13px;
  color: currentColor;
}

.home-week-strip {
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  align-items: stretch;
  gap: 4px;
}

.home-week-strip button {
  min-width: 0;
  min-height: 0;
  height: 100%;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #8b99ae;
  padding: 3px 2px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font: inherit;
  cursor: pointer;
}

.home-week-strip button strong {
  width: 20px;
  height: 20px;
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
  color: #9aa6b8;
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
}

.home-week-strip button.active strong {
  background: #438bff;
  color: #ffffff;
  box-shadow: 0 9px 18px -10px rgba(67, 139, 255, 0.84);
}

.home-main-quick-create {
  min-height: 0;
  height: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 14px;
  background: rgba(232, 242, 251, 0.74);
  padding: 4px 6px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.home-main-quick-create input {
  min-width: 0;
  height: 32px;
  border: 0;
  outline: 0;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 999px;
  color: #26334f;
  padding: 0 14px;
  font: inherit;
  font-size: 13px;
  font-weight: 850;
}

.home-main-quick-create input::placeholder {
  color: #7c8ba3;
}

.home-main-quick-create button {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 10px;
  background: rgba(208, 226, 247, 0.86);
  color: #438bff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.home-main-quick-create button:disabled {
  color: rgba(67, 139, 255, 0.44);
  cursor: not-allowed;
}

.home-main-quick-create button svg {
  width: 18px;
  height: 18px;
}

.floating-stats {
  position: absolute;
  right: calc(clamp(32px, 2.4vw, 48px) + clamp(640px, 38vw, 800px) + 16px);
  bottom: clamp(24px, 3.2vh, 40px);
  width: clamp(620px, 35.5vw, 720px);
  height: var(--home-module-height);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.home-stat-card {
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.66);
  border-radius: 20px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.5), rgba(242, 248, 255, 0.34)),
    rgba(248, 252, 255, 0.4);
  padding: 20px 22px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.78),
    0 16px 36px -32px rgba(8, 30, 64, 0.34);
  backdrop-filter: blur(22px) saturate(1.12);
  -webkit-backdrop-filter: blur(22px) saturate(1.12);
}

.home-stat-card h2 {
  font-size: 19px;
  line-height: 1;
  font-weight: 950;
}

.completion-stat-body {
  height: calc(100% - 25px);
  min-height: 0;
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  align-items: center;
  gap: 26px;
}

.completion-donut {
  width: 116px;
  height: 116px;
  border-radius: 999px;
  background: conic-gradient(#438bff var(--completion), rgba(205, 218, 234, 0.8) 0);
  padding: 10px;
  box-sizing: border-box;
}

.completion-donut > div {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: rgba(231, 242, 251, 0.96);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
}

.completion-donut strong {
  color: #438bff;
  font-size: 29px;
  line-height: 1;
  font-weight: 950;
}

.completion-donut span {
  color: #3e4d66;
  font-size: 11px;
  line-height: 1;
  font-weight: 950;
}

.completion-copy {
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: #31405a;
  font-size: 15px;
  font-weight: 950;
}

.completion-copy em {
  color: #27bd74;
  font-style: normal;
}

.trend-stat-card {
  display: grid;
  grid-template-rows: 30px minmax(0, 1fr);
}

.trend-stat-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.trend-stat-card header button {
  height: 30px;
  border: 1px solid rgba(255, 255, 255, 0.58);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.3);
  color: #53627a;
  padding: 0 12px;
  font: inherit;
  font-size: 12px;
  font-weight: 950;
  cursor: pointer;
}

.home-trend-chart {
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.day-preview-popover {
  position: absolute;
  z-index: 999;
  top: calc(50% + 28px);
  right: calc(clamp(32px, 2.4vw, 48px) + clamp(640px, 38vw, 800px) + 22px);
  width: min(530px, calc(100vw - 870px));
  height: min(680px, calc(100% - 96px));
  min-width: 460px;
  box-sizing: border-box;
  border: 1px solid rgba(226, 232, 240, 0.92);
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.96);
  padding: 24px;
  overflow: hidden;
  box-shadow: 0 28px 72px -36px rgba(15, 23, 42, 0.58);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
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

@media (max-width: 1280px) {
  .home-main-panel {
    width: min(720px, calc(100vw - 64px));
  }

  .floating-stats {
    width: min(620px, calc(100vw - 64px));
    right: calc(32px + min(720px, calc(100vw - 64px)) + 16px);
  }
}

@media (max-width: 1120px) {
  .calendar-workspace {
    overflow: auto;
    padding: 16px;
  }

  .left-column {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 16px;
    pointer-events: auto;
  }

  .home-main-panel,
  .floating-stats {
    position: relative;
    top: auto;
    right: auto;
    bottom: auto;
    left: auto;
    width: 100%;
  }

  .home-main-panel {
    min-height: 0;
    height: 230px;
  }

  .floating-stats {
    height: 230px;
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
    grid-template-rows: auto 36px;
    padding: 16px;
  }

  .home-main-head {
    grid-template-columns: 1fr;
    height: auto;
    max-height: none;
  }

  .home-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .home-summary-card:nth-child(2) {
    border-right: 0;
  }

  .home-summary-card:nth-child(-n + 2) {
    border-bottom: 1px solid rgba(196, 212, 228, 0.66);
  }

  .floating-stats {
    height: auto;
    grid-template-columns: 1fr;
  }

  .home-stat-card {
    min-height: 210px;
  }
}
</style>
