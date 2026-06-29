<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import IconBell from '~icons/lucide/bell'
import IconCheck from '~icons/lucide/check'
import IconChevronRight from '~icons/lucide/chevron-right'
import IconPlus from '~icons/lucide/plus'
import IconPresentation from '~icons/lucide/presentation'
import IconSendHorizontal from '~icons/lucide/send-horizontal'
import IconSquareCheck from '~icons/lucide/square-check'
import { routeConfig } from '@/config/route.config'
import AppStateBlock from '@/shared/components/state/AppStateBlock.vue'
import { useFeedbackStore } from '@/stores/feedback.store'
import DayPreviewPanel from './DayPreviewPanel.vue'
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
  updateTodoStatus as serviceUpdateTodoStatus,
} from './todo.service'
import { useDashboardTodos } from './useDashboardTodos'
import { useDashboardGlassSettings } from './useDashboardGlassSettings'

type TodoStatusFilter = 'all' | 'pending' | 'done'
type TodoTypeFilter = 'all' | 'task' | 'meeting'

type DayPreviewPanelExpose = {
  showDiscardWarning: (onConfirm?: () => void) => void
  openCreateForm: () => void
  openEventDetailById: (id: string) => boolean
  applyStatusFilter: (filter: TodoStatusFilter) => void
  applyTypeFilter: (filter: TodoTypeFilter) => void
}

const emit = defineEmits<{
  (event: 'switch-mode', mode: 'detail'): void
}>()

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
const calendarViewMode = ref<'month' | 'week'>('month')
const route = useRoute()
const router = useRouter()
const feedbackStore = useFeedbackStore()
const { glassStyle } = useDashboardGlassSettings()
let clockTimer: ReturnType<typeof setInterval> | undefined
let isConsumingDesktopTodoText = false

const { assignableUsers, currentUser, eventMap, initializeDashboardTodos, refreshTodos } =
  useDashboardTodos({
    getLoadRange: getActiveTodoLoadRange,
    onUnauthorized: redirectToLogin,
  })

onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = new Date()
  }, 60_000)
  void initializeDashboardData()
})

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
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
const canSubmitHomeQuickTodo = computed(() => Boolean(homeQuickTodoText.value.trim()))
const todayPreviewTasks = computed(() => [...todayEvents.value].sort(compareEvents))

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
const homeFooterDateLabel = computed(() => {
  const date = new Date(`${selectedDate.value}T12:00:00`)
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
  return `${date.getMonth() + 1}月${date.getDate()}日 ${weekday}`
})
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

function formatHomeTodoMeta(event: CalendarEvent) {
  if (event.status === 'done') return '已完成'
  if (isAllDayEvent(event)) return '今天'
  return formatEventTime(event)
}

function openTodayAddTodo() {
  const openCreate = () => {
    isDayPreviewFormDirty.value = false
    quickCreatePrompt.value = ''
    presetCreateTime.value = ''
    selectDate(todayDate.value)
    openTodoPanel()
    void nextTick(() => {
      dayPreviewPanelRef.value?.openCreateForm()
    })
  }

  if (isDayPreviewOpen.value && !confirmDiscardPreviewChanges(openCreate)) return

  openCreate()
}

function openTodayTask(event: CalendarEvent) {
  const openDetail = () => {
    isDayPreviewFormDirty.value = false
    quickCreatePrompt.value = ''
    presetCreateTime.value = ''
    selectDate(todayDate.value)
    openTodoPanel()
    void nextTick(() => {
      dayPreviewPanelRef.value?.openEventDetailById(event.id)
    })
  }

  if (isDayPreviewOpen.value && !confirmDiscardPreviewChanges(openDetail)) return

  openDetail()
}

async function toggleTodayTaskStatus(event: CalendarEvent) {
  if (event.completable === false) {
    showToast('当前待办不可由你完成', 'info')
    return
  }

  const nextStatus: CalendarEventStatus = event.status === 'done' ? 'todo' : 'done'
  await updateTodoStatus(event.id, nextStatus)
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

      <section
        class="home-main-panel"
        :style="glassStyle"
        aria-label="今日待办"
        data-tour-target="today-panel"
      >
        <header class="home-todo-calendar-header">
          <div class="home-todo-calendar-card">
            <div class="home-todo-calendar-left">
              <strong>{{ homeFooterDateLabel }}</strong>
              <div class="home-week-strip" aria-label="本周日期">
                <button
                  v-for="day in homeWeekDays"
                  :key="day.date"
                  type="button"
                  :class="{ active: day.isSelected, 'is-today': day.isToday }"
                  @click.stop="openDayPreviewWithStatusFilter(day.date, 'all')"
                >
                  <strong>{{ day.day }}</strong>
                  <span>{{ day.weekday }}</span>
                </button>
              </div>
            </div>
            <div class="home-todo-calendar-actions">
              <button
                type="button"
                class="home-todo-add-btn"
                data-tour-target="add-todo"
                @click.stop="openTodayAddTodo"
              >
                <IconPlus aria-hidden="true" />
                <span>新增待办</span>
              </button>
              <button
                type="button"
                class="home-todo-view-all"
                data-tour-target="detail-mode"
                @click.stop="emit('switch-mode', 'detail')"
              >
                <span>查看全部</span>
                <IconChevronRight aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        <div class="home-todo-body">
          <div class="home-todo-stats" aria-label="今日待办统计">
            <button
              type="button"
              class="home-todo-stat pending-stat"
              aria-label="查看今日待处理待办"
              @click.stop="openDayPreviewWithStatusFilter(todayDate, 'pending')"
            >
              <span class="home-todo-stat-icon" aria-hidden="true">
                <IconBell />
              </span>
              <span class="home-todo-stat-copy">
                <span>待处理</span>
                <strong>{{ todayPendingEvents.length }}</strong>
              </span>
            </button>
            <button
              type="button"
              class="home-todo-stat done-stat"
              aria-label="查看今日已完成待办"
              @click.stop="openDayPreviewWithStatusFilter(todayDate, 'done')"
            >
              <span class="home-todo-stat-icon" aria-hidden="true">
                <IconSquareCheck />
              </span>
              <span class="home-todo-stat-copy">
                <span>已完成</span>
                <strong>{{ todayCompletedCount }}</strong>
              </span>
            </button>
            <button
              type="button"
              class="home-todo-stat meeting-stat"
              aria-label="查看今日会议"
              @click.stop="openDayPreviewWithTypeFilter(todayDate, 'meeting')"
            >
              <span class="home-todo-stat-icon" aria-hidden="true">
                <IconPresentation />
              </span>
              <span class="home-todo-stat-copy">
                <span>会议</span>
                <strong>{{ todayMeetingCount }}</strong>
              </span>
            </button>
          </div>

          <div class="home-todo-list-shell">
            <div class="home-todo-list" aria-label="今日待办列表">
              <AppStateBlock
                v-if="!todayPreviewTasks.length"
                class="home-todo-empty-state"
                type="empty"
                title="今日暂无待办"
                description="新增待办后会展示在这里。"
                size="sm"
                variant="inline"
              />
              <article
                v-for="task in todayPreviewTasks"
                :key="task.id"
                class="home-todo-item"
                :class="{ 'is-done': task.status === 'done' }"
              >
                <button
                  type="button"
                  class="home-todo-check"
                  :class="{ checked: task.status === 'done' }"
                  :aria-label="task.status === 'done' ? '撤销完成' : '标记完成'"
                  :disabled="task.completable === false"
                  @click.stop="toggleTodayTaskStatus(task)"
                >
                  <IconCheck v-if="task.status === 'done'" aria-hidden="true" />
                </button>
                <button type="button" class="home-todo-item-main" @click.stop="openTodayTask(task)">
                  <span class="home-todo-item-title">{{ task.title }}</span>
                  <time>{{ formatHomeTodoMeta(task) }}</time>
                </button>
              </article>
            </div>

            <form
              class="home-todo-quick-create"
              data-tour-target="quick-create"
              @submit.prevent.stop="submitHomeQuickTodo"
            >
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
          </div>
        </div>
      </section>
    </section>
  </div>
</template>

<style scoped>
.calendar-workspace {
  --home-module-height: clamp(440px, 50vh, 520px);
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
  padding: 10px 10px 6px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.72),
    0 20px 36px -30px rgba(18, 38, 72, 0.4);
  backdrop-filter: blur(var(--glass-blur, 24px)) saturate(var(--glass-saturate, 1.16));
  -webkit-backdrop-filter: blur(var(--glass-blur, 24px)) saturate(var(--glass-saturate, 1.16));
}

.home-todo-calendar-header {
  flex: 0 0 auto;
}

.home-todo-calendar-card {
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.58);
  min-height: 108px;
  padding: 16px 16px 14px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: stretch;
  gap: 14px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.82);
}

.home-todo-calendar-left {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 12px;
}

.home-todo-calendar-left > strong {
  color: var(--home-ink);
  font-size: 15px;
  line-height: 1;
  font-weight: 950;
}

.home-todo-calendar-actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  flex: 0 0 auto;
}

.home-todo-add-btn {
  height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.42);
  border-radius: 12px;
  background: linear-gradient(180deg, #5a9bff 0%, #438bff 100%);
  color: #ffffff;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font: inherit;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
  cursor: pointer;
  box-shadow:
    0 10px 22px -12px rgba(67, 139, 255, 0.88),
    inset 0 1px 0 rgba(255, 255, 255, 0.28);
  transition:
    background 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.home-todo-add-btn:hover {
  background: linear-gradient(180deg, #6aa5ff 0%, #4f93ff 100%);
  transform: translateY(-1px);
  box-shadow:
    0 14px 26px -10px rgba(67, 139, 255, 0.95),
    inset 0 1px 0 rgba(255, 255, 255, 0.34);
}

.home-todo-add-btn svg {
  width: 15px;
  height: 15px;
  stroke-width: 2.5px;
}

.home-todo-body {
  flex: 1 1 auto;
  min-height: 0;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.58);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.82);
}

.home-todo-stats {
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

.home-todo-stat:hover {
  background: rgba(255, 255, 255, 0.92);
  transform: translateY(-1px);
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

.pending-stat .home-todo-stat-icon {
  background: rgba(67, 139, 255, 0.14);
  color: #438bff;
}

.done-stat .home-todo-stat-icon {
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
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.home-todo-list {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
}

.home-todo-quick-create {
  flex: 0 0 auto;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.78);
  padding: 4px 5px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.82);
}

.home-todo-quick-create input {
  min-width: 0;
  height: 32px;
  border: 0;
  outline: 0;
  background: transparent;
  color: #26334f;
  padding: 0 10px;
  font: inherit;
  font-size: 13px;
  font-weight: 850;
}

.home-todo-quick-create input::placeholder {
  color: #8b99ae;
}

.home-todo-quick-create button {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 10px;
  background: rgba(67, 139, 255, 0.14);
  color: #438bff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.18s ease;
}

.home-todo-quick-create button:hover:not(:disabled) {
  background: rgba(67, 139, 255, 0.22);
}

.home-todo-quick-create button:disabled {
  color: rgba(67, 139, 255, 0.4);
  cursor: not-allowed;
}

.home-todo-quick-create button svg {
  width: 16px;
  height: 16px;
}

.home-todo-empty-state {
  flex: 1 1 auto;
  min-height: 0;
}

.home-todo-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  flex: 0 0 33.3333%;
  min-height: 56px;
  box-sizing: border-box;
  padding: 0 2px;
  border-top: 1px solid rgba(196, 212, 228, 0.58);
}

.home-todo-item:first-child {
  border-top: 0;
}

.home-todo-check {
  width: 22px;
  height: 22px;
  border: 2px solid rgba(148, 163, 184, 0.72);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.72);
  color: #ffffff;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background 0.18s ease,
    border-color 0.18s ease;
}

.home-todo-check.checked {
  border-color: #438bff;
  background: #438bff;
}

.home-todo-check:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.home-todo-check svg {
  width: 12px;
  height: 12px;
}

.home-todo-item-main {
  min-width: 0;
  border: 0;
  background: transparent;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.home-todo-item-title {
  min-width: 0;
  overflow: hidden;
  color: #1f2f4d;
  font-size: 15px;
  font-weight: 850;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-todo-item time {
  flex: 0 0 auto;
  color: #8b99ae;
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
}

.home-todo-item.is-done .home-todo-item-title {
  color: #9aa6b8;
  text-decoration: line-through;
}

.home-todo-item.is-done time {
  color: #28c879;
}

.home-week-strip {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  align-items: stretch;
  gap: 4px;
}

.home-week-strip button {
  min-width: 0;
  min-height: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #8b99ae;
  padding: 4px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
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
  color: #9aa6b8;
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
}

.home-week-strip button.active strong {
  background: #438bff;
  color: #ffffff;
  box-shadow: 0 8px 16px -10px rgba(67, 139, 255, 0.84);
}

.home-todo-view-all {
  height: 36px;
  border: 0;
  border-radius: 12px;
  background: rgba(67, 139, 255, 0.12);
  color: #438bff;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font: inherit;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.18s ease,
    transform 0.18s ease;
}

.home-todo-view-all:hover {
  background: rgba(67, 139, 255, 0.18);
  transform: translateY(-1px);
}

.home-todo-view-all svg {
  width: 16px;
  height: 16px;
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
    min-height: 0;
    height: auto;
    min-height: 440px;
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
    min-height: 0;
    padding: 16px;
  }

  .home-todo-stats {
    grid-template-columns: 1fr;
  }

  .home-todo-calendar-card {
    grid-template-columns: 1fr;
  }

  .home-todo-calendar-actions {
    flex-direction: row;
  }

  .home-todo-add-btn,
  .home-todo-view-all {
    flex: 1 1 0;
  }
}
</style>
