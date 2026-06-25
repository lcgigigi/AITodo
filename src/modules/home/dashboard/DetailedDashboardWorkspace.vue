<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Component } from 'vue'
import IconAlarmClock from '~icons/lucide/alarm-clock'
import IconBox from '~icons/lucide/box'
import IconCheck from '~icons/lucide/check'
import IconChevronLeft from '~icons/lucide/chevron-left'
import IconChevronRight from '~icons/lucide/chevron-right'
import IconCode from '~icons/lucide/code'
import IconCompass from '~icons/lucide/compass'
import IconFileText from '~icons/lucide/file-text'
import IconFlag from '~icons/lucide/flag'
import IconImage from '~icons/lucide/image'
import IconMessageCircle from '~icons/lucide/message-circle'
import IconPresentation from '~icons/lucide/presentation'
import IconSendHorizontal from '~icons/lucide/send-horizontal'
import IconUsers from '~icons/lucide/users'
import { routeConfig } from '@/config/route.config'
import { useFeedbackStore } from '@/stores/feedback.store'
import { useUserStore } from '@/stores/user.store'
import { useRouter } from 'vue-router'
import type { CalendarEvent, CalendarTodoDraft, CalendarUser } from './types'
import { dateRange, formatEventTime, ymd } from './todoDisplay'
import {
  createTodo as serviceCreateTodo,
  getTodoMonthRange,
  listTodos,
  loadAssignableUsers,
  loadCurrentUser,
  loadTodoDetail,
  loadTodos,
  parseTodoText,
  updateTodoStatus as serviceUpdateTodoStatus,
} from './todo.service'

type DetailMode = 'simple' | 'detail'
type DetailFilter = 'all' | 'pending' | 'done' | 'urgent' | 'overdue'
type DetailTone = 'blue' | 'green' | 'orange' | 'violet' | 'cyan' | 'slate'

type FilterItem = {
  value: DetailFilter
  label: string
  icon?: Component
}

type DetailTool = {
  name: string
  icon: Component
  tone: string
  routeName?: string
  agentKey?: string
  isMore?: boolean
}

type MonthDay = {
  key: string
  day: number
  inMonth: boolean
  isToday: boolean
  isSelected: boolean
  dots: DetailTone[]
}

type TrendPoint = {
  key: string
  label: string
  value: number
  x: number
  y: number
}

const emit = defineEmits<{
  'switch-mode': [mode: DetailMode]
}>()

const router = useRouter()
const userStore = useUserStore()
const feedbackStore = useFeedbackStore()

const now = ref(new Date())
const todayDate = computed(() => ymd(now.value))
const currentMonth = ref(new Date(now.value.getFullYear(), now.value.getMonth(), 1))
const selectedDate = ref(todayDate.value)
const allEvents = ref<CalendarEvent[]>([])
const backendAssignableUsers = ref<CalendarUser[]>([])
const taskDetails = ref<Record<string, CalendarEvent>>({})
const activeFilter = ref<DetailFilter>('all')
const activeTaskId = ref('')
const detailLoadingId = ref('')
const quickCreateText = ref('')
const isLoading = ref(false)
const isCreating = ref(false)
const loadError = ref('')

const filters: FilterItem[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待处理' },
  { value: 'done', label: '已完成' },
  { value: 'urgent', label: '高优先级', icon: IconFlag },
  { value: 'overdue', label: '逾期', icon: IconAlarmClock },
]

const detailTools: DetailTool[] = [
  { name: '图文分析', icon: IconImage, tone: 'orange', agentKey: 'image-analysis' },
  { name: '办事咨询', icon: IconMessageCircle, tone: 'blue', routeName: 'LeaderBoard' },
  { name: '会议纪要', icon: IconFileText, tone: 'green', agentKey: 'meeting-notes' },
  { name: 'PPT创作', icon: IconPresentation, tone: 'violet', agentKey: 'ppt-creator' },
  { name: '智体工坊', icon: IconBox, tone: 'purple', agentKey: 'agent-workshop' },
  { name: '代码辅助', icon: IconCode, tone: 'cyan', agentKey: 'code-assistant' },
  { name: '面试中心', icon: IconUsers, tone: 'sky', agentKey: 'interview-center' },
  { name: '更多工具', icon: IconCompass, tone: 'slate', isMore: true },
]

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

  return map
})

const selectedDateEvents = computed(() => eventMap.value.get(selectedDate.value) ?? [])
const pendingEvents = computed(() =>
  selectedDateEvents.value.filter((event) => event.status !== 'done' && !isRejectedEvent(event)),
)
const doneCount = computed(
  () => selectedDateEvents.value.filter((event) => event.status === 'done').length,
)
const urgentCount = computed(
  () => selectedDateEvents.value.filter((event) => event.priority === 'urgent').length,
)
const overdueCount = computed(
  () => selectedDateEvents.value.filter((event) => isOverdueEvent(event)).length,
)
const completionRate = computed(() =>
  selectedDateEvents.value.length
    ? Math.round((doneCount.value / selectedDateEvents.value.length) * 100)
    : 0,
)
const selectedDateLabel = computed(() => formatDateTitle(selectedDate.value))
const selectedDateShortLabel = computed(() => formatDateShortTitle(selectedDate.value))
const mainTitle = computed(() => (selectedDate.value === todayDate.value ? '今日待办' : '当日待办'))
const filteredTasks = computed(() => {
  if (activeFilter.value === 'pending') return pendingEvents.value
  if (activeFilter.value === 'done') {
    return selectedDateEvents.value.filter((event) => event.status === 'done')
  }
  if (activeFilter.value === 'urgent') {
    return selectedDateEvents.value.filter((event) => event.priority === 'urgent')
  }
  if (activeFilter.value === 'overdue') {
    return selectedDateEvents.value.filter((event) => isOverdueEvent(event))
  }
  return selectedDateEvents.value
})

const filterCounts = computed<Record<DetailFilter, number>>(() => ({
  all: selectedDateEvents.value.length,
  pending: pendingEvents.value.length,
  done: doneCount.value,
  urgent: urgentCount.value,
  overdue: overdueCount.value,
}))

const monthDays = computed(() => buildMonthDays())
const scheduleEvents = computed(() => selectedDateEvents.value)
const trendPoints = computed(() => buildTrendPoints())
const trendPolyline = computed(() =>
  trendPoints.value.map((point) => `${point.x},${point.y}`).join(' '),
)

onMounted(() => {
  void initializeDetailData()
})

async function initializeDetailData() {
  isLoading.value = true
  loadError.value = ''

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

    backendAssignableUsers.value = await loadAssignableUsers()
    await refreshTodos()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '加载待办数据失败'
  } finally {
    isLoading.value = false
  }
}

function openAgentCenter(agentKey?: string) {
  void router.push({
    name: 'AgentCenter',
    query: agentKey ? { agent: agentKey } : undefined,
  })
}

function openDetailTool(tool: DetailTool) {
  if (tool.routeName) {
    void router.push({ name: tool.routeName })
    return
  }

  if (tool.agentKey) {
    openAgentCenter(tool.agentKey)
    return
  }

  if (tool.isMore) {
    openAgentCenter()
  }
}

async function refreshTodos() {
  if (!currentUser.value.id) return

  const range = getTodoMonthRange(currentMonth.value)
  allEvents.value = await loadTodos(currentUser.value, assignableUsers.value, range)
  taskDetails.value = {}
  ensureSelectedDateInLoadedMonth()
}

function ensureSelectedDateInLoadedMonth() {
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

async function changeMonth(delta: number) {
  currentMonth.value = new Date(
    currentMonth.value.getFullYear(),
    currentMonth.value.getMonth() + delta,
    1,
  )
  await refreshTodos()
}

async function goToday() {
  now.value = new Date()
  selectedDate.value = todayDate.value
  currentMonth.value = new Date(now.value.getFullYear(), now.value.getMonth(), 1)
  await refreshTodos()
}

function selectCalendarDate(date: string) {
  selectedDate.value = date
  activeTaskId.value = ''
  activeFilter.value = 'all'
}

async function expandTask(task: CalendarEvent) {
  activeTaskId.value = activeTaskId.value === task.id ? '' : task.id
  if (activeTaskId.value) {
    await loadTaskDetail(task)
  }
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
    feedbackStore.success(nextStatus === 'done' ? '已标记完成' : '已撤销完成')
  } catch {
    // 全局拦截器已统一提示错误。
  }
}

async function submitQuickCreate() {
  const title = quickCreateText.value.trim()
  if (!title || isCreating.value || !currentUser.value.id) return

  isCreating.value = true

  try {
    const fallback: CalendarTodoDraft = {
      date: selectedDate.value,
      title,
      owner: currentUser.value.name,
      assigneeId: currentUser.value.id,
      assigneeName: currentUser.value.name,
      source: '',
      type: 1,
    }
    const parsed = await parseTodoText(title, currentUser.value, assignableUsers.value, fallback)
    await serviceCreateTodo({
      date: parsed.date,
      endDate: parsed.endDate,
      time: parsed.time,
      endTime: parsed.endTime,
      title: parsed.title || title,
      owner: parsed.owner,
      assigneeId: parsed.assigneeId,
      assigneeName: parsed.assigneeName,
      source: parsed.source,
      type: parsed.type,
    })
    quickCreateText.value = ''
    if (parsed.date) {
      const parsedDate = new Date(`${parsed.date}T12:00:00`)
      currentMonth.value = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1)
      selectedDate.value = parsed.date
    }
    await refreshTodos()
    feedbackStore.success('待办已创建')
  } catch {
    // 全局拦截器已统一提示错误。
  } finally {
    isCreating.value = false
  }
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

function buildTrendPoints(): TrendPoint[] {
  const weekDates = getWeekDates(selectedDate.value)
  const counts = weekDates.map((date) => completedEventCountByDate(date))
  const maxCount = Math.max(...counts, 1)
  const labels = weekDates.map((date) => {
    const value = new Date(`${date}T12:00:00`)
    return ['日', '一', '二', '三', '四', '五', '六'][value.getDay()]
  })

  return weekDates.map((date, index) => {
    const x = 16 + index * 29
    const y = 104 - (counts[index] / maxCount) * 58
    return {
      key: date,
      label: labels[index],
      value: counts[index],
      x,
      y,
    }
  })
}

function getWeekDates(anchorDate: string) {
  const start = new Date(`${anchorDate}T12:00:00`)
  const offset = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - offset)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return ymd(date)
  })
}

function completedEventCountByDate(date: string) {
  return (eventMap.value.get(date) ?? []).filter((event) => event.status === 'done').length
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

function isOverdueEvent(event: CalendarEvent) {
  if (event.status === 'done' || isRejectedEvent(event)) return false

  const endDate = event.endDate || event.date
  if (endDate < todayDate.value) return true
  if (endDate > todayDate.value) return false

  const endTime = event.endTime || event.time
  if (!endTime) return false

  const [hour = '0', minute = '0'] = endTime.split(':')
  const deadline = new Date(`${endDate}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00`)
  return deadline.getTime() < now.value.getTime()
}

function getTaskTone(event: CalendarEvent): DetailTone {
  if (event.type === 'meeting') return 'blue'
  if (event.type === 'approval') return 'green'
  if (event.type === 'ai') return 'cyan'
  if (event.priority === 'urgent') return 'orange'
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

function formatDateShortTitle(date: string) {
  const value = new Date(`${date}T12:00:00`)
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][value.getDay()]
  return `${value.getMonth() + 1} 月 ${value.getDate()} 日 ${weekday}`
}

function monthLabel(date: Date) {
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`
}
</script>

<template>
  <section class="detail-workspace" aria-label="首页详细模式">
    <!-- Left Column -->
    <aside class="detail-left-panel" aria-label="快捷入口和统计">
      <nav class="detail-tool-panel" aria-label="AI工具">
        <button
          v-for="tool in detailTools"
          :key="tool.name"
          type="button"
          class="detail-tool-item side-content-card"
          :class="`tone-${tool.tone}`"
          @click="openDetailTool(tool)"
        >
          <span class="detail-tool-icon" aria-hidden="true">
            <component :is="tool.icon" />
          </span>
          <span>{{ tool.name }}</span>
        </button>
      </nav>
      <div class="floating-stats">
        <article class="mini-stat completion-card side-content-card">
          <h2>今日完成率</h2>
          <div
            class="completion-ring"
            :style="{ '--completion': `${completionRate * 3.6}deg` }"
            aria-label="当日完成率"
          >
            <div>
              <strong>{{ completionRate }}%</strong>
              <span>{{ doneCount }}/{{ selectedDateEvents.length }} 已完成</span>
            </div>
          </div>
        </article>

        <article class="mini-stat trend-card side-content-card">
          <header>
            <h2>本周趋势</h2>
          </header>
          <svg class="trend-svg" viewBox="0 0 210 128" role="img" aria-label="本周完成趋势">
            <polyline v-if="trendPolyline" :points="trendPolyline" />
            <g>
              <circle v-for="point in trendPoints" :key="point.key" :cx="point.x" :cy="point.y" />
            </g>
          </svg>
        </article>
      </div>
    </aside>

    <!-- 中右一体 -->
    <section class="detail-board" aria-label="待办与日历">
      <main class="detail-main-panel" aria-label="当日待办清单">
        <div class="detail-main-body side-content-card">
          <header class="detail-main-header">
            <h1>{{ mainTitle }}</h1>
            <p class="subtitle">
              {{ selectedDateLabel }}
              <span class="divider">|</span>
              任务总数 <span class="num">{{ filterCounts.all }}</span>
              <span class="divider">|</span>
              已完成 <span class="num">{{ filterCounts.done }}</span>
              <span class="divider">|</span>
              待处理 <span class="num">{{ filterCounts.pending }}</span>
              <span class="divider">|</span>
              <span class="text-urgent"
                >高优先级 <span class="num">{{ filterCounts.urgent }}</span></span
              >
            </p>
          </header>

          <p v-if="loadError" class="detail-state is-error">{{ loadError }}</p>
          <p v-else-if="isLoading" class="detail-state">正在加载真实待办数据...</p>

          <div class="filter-row" role="group" aria-label="待办筛选">
            <button
              v-for="filter in filters"
              :key="filter.value"
              type="button"
              class="filter-pill"
              :class="{
                active: activeFilter === filter.value,
                'is-urgent': filter.value === 'urgent',
              }"
              :aria-pressed="activeFilter === filter.value"
              @click="activeFilter = filter.value"
            >
              <span>{{ filter.label }} ({{ filterCounts[filter.value] }})</span>
            </button>
          </div>

          <div class="task-list" aria-label="待办列表">
            <article v-if="!isLoading && !filteredTasks.length" class="task-empty">
              当前日期暂无待办
            </article>

            <article
              v-for="task in filteredTasks"
              :key="task.id"
              class="task-row"
              :class="{ expanded: activeTaskId === task.id, done: task.status === 'done' }"
            >
              <div class="task-summary" @click="expandTask(task)">
                <button
                  type="button"
                  class="task-check"
                  :class="{ checked: task.status === 'done' }"
                  :aria-label="task.status === 'done' ? '撤销完成' : '标记完成'"
                  :disabled="task.completable === false"
                  @click.stop="toggleTaskStatus(task)"
                >
                  <IconCheck v-if="task.status === 'done'" aria-hidden="true" />
                </button>

                <time class="task-time">{{ formatEventTime(task) }}</time>

                <div class="task-info">
                  <div class="task-title-row">
                    <strong>{{ task.title }}</strong>
                    <span class="task-tag" :class="`tone-${getTaskTone(task)}`">{{
                      getTaskTypeLabel(task)
                    }}</span>
                  </div>
                  <div class="task-subtitle">
                    {{ getProjectText(task) }}
                  </div>
                </div>

                <div class="task-right">
                  <span v-if="task.priority === 'urgent'" class="task-priority-text">高优先级</span>
                  <span v-else-if="task.status === 'done'" class="task-done-text">已完成</span>
                </div>
              </div>

              <div v-if="activeTaskId === task.id" class="task-detail">
                <p v-if="detailLoadingId === task.id" class="detail-loading">正在加载详情...</p>
                <dl v-else>
                  <div>
                    <dt>项目：</dt>
                    <dd>{{ getProjectText(task) }}</dd>
                  </div>
                  <div>
                    <dt>协作人：</dt>
                    <dd>{{ getAssigneeText(task) }}</dd>
                  </div>
                  <div>
                    <dt>截止时间：</dt>
                    <dd>{{ formatEventTime(getTaskDetail(task)) }}</dd>
                  </div>
                  <div>
                    <dt>描述：</dt>
                    <dd>{{ getDescriptionText(task) }}</dd>
                  </div>
                </dl>
              </div>
            </article>
          </div>
        </div>

        <form class="quick-create side-content-card" @submit.prevent="submitQuickCreate">
          <input
            v-model="quickCreateText"
            type="text"
            autocomplete="off"
            aria-label="一句话新增待办"
            placeholder="+ 一句话新增待办，AI 自动识别时间与任务类型..."
          />
          <button
            type="submit"
            :disabled="!quickCreateText.trim() || isCreating"
            aria-label="解析并新增待办"
          >
            <IconSendHorizontal aria-hidden="true" />
          </button>
        </form>
      </main>

      <aside class="detail-side-panel" aria-label="日历和日程">
        <div class="mode-segment-wrapper">
          <div class="mode-segment" role="group" aria-label="首页模式">
            <button type="button" @click="emit('switch-mode', 'simple')">总览模式</button>
            <button type="button" class="active">工作模式</button>
          </div>
        </div>

        <section class="calendar-card side-content-card" aria-label="月历">
          <header class="calendar-header-mock">
            <button
              type="button"
              aria-label="上个月"
              @click="changeMonth(-1)"
              class="month-nav-btn"
            >
              <IconChevronLeft aria-hidden="true" />
            </button>
            <h2 @click="goToday" style="cursor: pointer" title="回到今天">
              {{ monthLabel(currentMonth) }}
            </h2>
            <button type="button" aria-label="下个月" @click="changeMonth(1)" class="month-nav-btn">
              <IconChevronRight aria-hidden="true" />
            </button>
          </header>

          <div class="calendar-placeholder-wrapper">
            <div class="calendar-grid" :aria-label="`${monthLabel(currentMonth)}日历`">
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

        <section class="schedule-card side-content-card" aria-label="当日日程">
          <header class="side-card-header">
            <div class="schedule-title-area">
              <h2>当日日程</h2>
              <p>{{ selectedDateShortLabel }}</p>
            </div>
            <button type="button" class="all-schedule-btn" @click="activeFilter = 'all'">
              全部日程 <IconChevronRight aria-hidden="true" />
            </button>
          </header>

          <div class="schedule-list">
            <article v-if="!scheduleEvents.length" class="schedule-empty">当前日期暂无日程</article>
            <article
              v-for="task in scheduleEvents"
              :key="`schedule-${task.id}`"
              class="schedule-item"
              @click="expandTask(task)"
            >
              <div class="schedule-dot"></div>
              <time>{{ formatEventTime(task) }}</time>
              <div class="schedule-info">
                <strong>{{ task.title }}</strong>
                <p>{{ getProjectText(task) }} · {{ getAssigneeText(task) }}</p>
              </div>
              <span :class="`tone-${getTaskTone(task)}`">{{ getTaskTypeLabel(task) }}</span>
            </article>
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
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding: clamp(12px, 1.2vw, 20px) clamp(6px, 0.6vw, 12px);
  display: grid;
  grid-template-columns: minmax(264px, 336px) minmax(0, 1fr);
  gap: clamp(16px, 1.4vw, 24px);
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
  grid-template-columns: minmax(0, 1fr) minmax(403px, 490px);
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
  gap: 12px;
  padding: 14px;
  min-height: 0;
  min-width: 0;
  box-sizing: border-box;
  background: transparent;
}

.detail-main-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 20px 22px 18px;
  box-sizing: border-box;
}

.detail-left-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.detail-tool-panel {
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
  padding: 14px;
  border: 1px solid var(--home-glass-border);
  border-radius: var(--home-glass-radius);
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.38), rgba(242, 248, 255, 0.24)),
    rgba(248, 252, 255, 0.32);
  box-shadow: var(--home-glass-shadow);
  backdrop-filter: var(--home-glass-blur);
  -webkit-backdrop-filter: var(--home-glass-blur);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: auto;
  align-content: start;
  gap: 12px;
  overflow: auto;
  scrollbar-width: none;
}

.detail-tool-panel::-webkit-scrollbar {
  display: none;
}

.detail-tool-item {
  min-width: 0;
  aspect-ratio: 1;
  border: 1px solid var(--content-card-border);
  border-radius: 16px;
  background: var(--content-card-bg);
  color: #243656;
  padding: 14px 10px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font: inherit;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.2;
  text-align: center;
  white-space: normal;
  cursor: pointer;
  box-shadow: var(--content-card-shadow);
  backdrop-filter: var(--content-card-blur);
  -webkit-backdrop-filter: var(--content-card-blur);
  transition:
    background 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.detail-tool-item:hover,
.detail-tool-item:focus-visible {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.62), rgba(248, 250, 252, 0.46));
  transform: translateY(-1px);
  box-shadow: 0 14px 32px -20px rgba(15, 23, 42, 0.16);
  outline: none;
}

.detail-tool-icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.34);
}

.detail-tool-icon svg {
  width: 16px;
  height: 16px;
}

.tone-orange .detail-tool-icon {
  background: #ffe5d7;
  color: #ff7a3d;
}

.tone-blue .detail-tool-icon {
  background: #dbeafe;
  color: #2f7cff;
}

.tone-green .detail-tool-icon {
  background: #d9f8e7;
  color: #20bb77;
}

.tone-violet .detail-tool-icon,
.tone-purple .detail-tool-icon {
  background: #eadfff;
  color: #8b5cf6;
}

.tone-cyan .detail-tool-icon {
  background: #d7f7ff;
  color: #09b6d7;
}

.tone-sky .detail-tool-icon {
  background: #dff3ff;
  color: #26a4e8;
}

.tone-slate .detail-tool-icon {
  background: #e7edf5;
  color: #70819a;
}

.floating-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  height: 160px;
}

.mini-stat {
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.mini-stat h2 {
  margin: 0 0 12px;
  color: #172340;
  font-size: 15px;
  font-weight: 900;
}

.completion-ring {
  --completion: 0deg;
  width: 76px;
  height: 76px;
  margin: 0 auto;
  border-radius: 50%;
  background: conic-gradient(var(--detail-blue) var(--completion), rgba(189, 210, 232, 0.4) 0);
  display: grid;
  place-items: center;
  position: relative;
}

.completion-ring::before {
  width: 56px;
  height: 56px;
  border-radius: inherit;
  background: rgba(255, 255, 255, 0.48);
  content: '';
}

.completion-ring > div {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.completion-ring strong {
  color: var(--detail-blue);
  font-size: 22px;
  line-height: 1;
  font-weight: 900;
}

.completion-ring span {
  margin-top: 4px;
  color: #60708d;
  font-size: 10px;
  font-weight: 800;
}

.trend-card .trend-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.trend-svg polyline {
  fill: none;
  stroke: var(--detail-blue);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.trend-svg circle {
  r: 4;
  fill: #ffffff;
  stroke: var(--detail-blue);
  stroke-width: 2.5;
}

.detail-main-header {
  margin-bottom: 20px;
}

.detail-main-header h1 {
  margin: 0 0 8px;
  color: #101936;
  font-size: 24px;
  font-weight: 900;
}

.subtitle {
  margin: 0;
  color: #60708d;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.subtitle .divider {
  color: #c0cbe0;
}

.subtitle .num {
  color: #101936;
  font-weight: 800;
}

.text-urgent {
  color: #ef4444;
}
.text-urgent .num {
  color: #ef4444;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.filter-pill {
  height: 32px;
  border: 1px solid rgba(255, 255, 255, 0.48);
  border-radius: 999px;
  background: rgba(241, 245, 249, 0.38);
  backdrop-filter: blur(12px) saturate(1.08);
  -webkit-backdrop-filter: blur(12px) saturate(1.08);
  color: #60708d;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-pill:hover {
  background: rgba(248, 250, 252, 0.52);
}

.filter-pill.active {
  background: var(--detail-blue);
  color: white;
  box-shadow: 0 4px 12px rgba(47, 124, 255, 0.3);
}

.filter-pill.is-urgent {
  color: #ef4444;
}

.filter-pill.active.is-urgent {
  background: #ef4444;
  color: white;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.task-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 4px;
  scrollbar-width: none;
}
.task-list::-webkit-scrollbar {
  display: none;
}

.task-row {
  border: 1px solid rgba(255, 255, 255, 0.52);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.28);
  backdrop-filter: blur(14px) saturate(1.08);
  -webkit-backdrop-filter: blur(14px) saturate(1.08);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.42);
  transition: all 0.2s;
}
.task-row:hover {
  border-color: rgba(191, 219, 254, 0.72);
  background: rgba(255, 255, 255, 0.42);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.52),
    0 4px 14px -10px rgba(59, 130, 246, 0.14);
}
.task-row.expanded {
  border-color: rgba(147, 197, 253, 0.78);
  background: rgba(255, 255, 255, 0.38);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.56),
    0 8px 24px -16px rgba(31, 111, 255, 0.16);
}
.task-row.done {
  border-color: rgba(187, 247, 208, 0.58);
  background: rgba(255, 255, 255, 0.24);
  opacity: 0.92;
}

.task-summary {
  display: flex;
  align-items: center;
  padding: 16px;
  gap: 16px;
  cursor: pointer;
}

.task-check {
  width: 20px;
  height: 20px;
  border: 2px solid #c0cbe0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.42);
  color: white;
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
}
.task-check.checked {
  background: var(--detail-blue);
  border-color: var(--detail-blue);
}
.task-check svg {
  width: 14px;
  height: 14px;
}

.task-time {
  font-size: 18px;
  font-weight: 900;
  color: #101936;
  min-width: 60px;
}

.task-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.task-title-row strong {
  font-size: 15px;
  font-weight: 900;
  color: #101936;
}

.task-tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 800;
}

.task-tag.tone-blue,
.schedule-item > span.tone-blue {
  background: #e0f2fe;
  color: #2563eb;
}
.task-tag.tone-green,
.schedule-item > span.tone-green {
  background: #d1fae5;
  color: #059669;
}
.task-tag.tone-orange,
.schedule-item > span.tone-orange {
  background: #ffedd5;
  color: #ea580c;
}
.task-tag.tone-violet,
.schedule-item > span.tone-violet {
  background: #ede9fe;
  color: #7c3aed;
}
.task-tag.tone-cyan,
.schedule-item > span.tone-cyan {
  background: #cffafe;
  color: #0891b2;
}
.task-tag.tone-slate,
.schedule-item > span.tone-slate {
  background: #f1f5f9;
  color: #475569;
}

.task-subtitle {
  font-size: 13px;
  color: #60708d;
}

.task-right {
  display: flex;
  align-items: center;
}

.task-priority-text {
  color: #ef4444;
  font-size: 13px;
  font-weight: 900;
}
.task-done-text {
  color: #10b981;
  font-size: 13px;
  font-weight: 900;
}

.task-detail {
  margin: 0 12px 12px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.42);
  background: rgba(236, 241, 247, 0.42);
  backdrop-filter: blur(12px) saturate(1.06);
  -webkit-backdrop-filter: blur(12px) saturate(1.06);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.38);
}
.task-detail dl {
  margin: 0;
  display: grid;
  gap: 8px;
}
.task-detail div {
  display: flex;
  gap: 12px;
  font-size: 13px;
}
.task-detail dt {
  color: #60708d;
  min-width: 70px;
}
.task-detail dd {
  margin: 0;
  color: #101936;
  font-weight: 600;
}

.quick-create {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  border-radius: 16px;
  padding: 10px 12px 10px 18px;
  box-sizing: border-box;
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
.quick-create button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--detail-blue);
  color: white;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.quick-create button:disabled {
  opacity: 0.5;
}
.quick-create button svg {
  width: 18px;
  height: 18px;
}

.detail-side-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  min-width: 0;
  padding: 14px;
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
  padding: 16px;
  flex: 0 0 auto;
}

.schedule-card {
  flex: 1;
  min-height: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.mode-segment-wrapper {
  flex: 0 0 auto;
  margin-bottom: 0;
}
.mode-segment {
  display: flex;
  background: rgba(255, 255, 255, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.48);
  border-radius: 999px;
  padding: 4px;
  backdrop-filter: blur(12px) saturate(1.06);
  -webkit-backdrop-filter: blur(12px) saturate(1.06);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.42);
}
.mode-segment button {
  flex: 1;
  height: 36px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #60708d;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
}
.mode-segment button.active {
  background: var(--detail-blue);
  color: white;
  box-shadow: 0 4px 12px rgba(47, 124, 255, 0.3);
}

.calendar-header-mock {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 16px;
}
.calendar-header-mock h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 900;
  color: #101936;
}
.month-nav-btn {
  border: none;
  background: transparent;
  color: #60708d;
  cursor: pointer;
  display: grid;
  place-items: center;
  padding: 4px;
  border-radius: 4px;
}
.month-nav-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}
.month-nav-btn svg {
  width: 16px;
  height: 16px;
}

.calendar-placeholder-wrapper {
  border-radius: 12px;
  padding: 4px 0 0;
  background: transparent;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  text-align: center;
}
.week-label {
  font-size: 12px;
  color: #60708d;
  font-weight: 800;
  margin-bottom: 8px;
}
.month-day {
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 800;
  color: #101936;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.month-day.muted {
  color: #a0aec0;
}
.month-day.today {
  background: var(--detail-blue);
  color: white;
}
.day-dots {
  display: flex;
  gap: 2px;
  margin-top: 2px;
}
.day-dots i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
}

.side-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}
.schedule-title-area h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 900;
  color: #101936;
}
.schedule-title-area p {
  margin: 4px 0 0;
  font-size: 13px;
  color: #60708d;
  font-weight: 800;
}

.all-schedule-btn {
  border: 1px solid rgba(255, 255, 255, 0.58);
  background: rgba(255, 255, 255, 0.3);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 800;
  color: var(--detail-blue);
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.all-schedule-btn svg {
  width: 14px;
  height: 14px;
}

.schedule-list {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: none;
  display: flex;
  flex-direction: column;
}
.schedule-list::-webkit-scrollbar {
  display: none;
}

.schedule-item {
  position: relative;
  display: grid;
  grid-template-columns: 20px 44px 1fr auto;
  gap: 8px;
  padding: 16px 0;
  cursor: pointer;
  align-items: start;
}
.schedule-item::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 36px;
  bottom: -16px;
  width: 2px;
  background: rgba(0, 0, 0, 0.05);
}
.schedule-item:last-child::after {
  display: none;
}

.schedule-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: white;
  border: 2px solid var(--detail-blue);
  margin-top: 4px;
}

.schedule-item time {
  font-size: 13px;
  font-weight: 900;
  color: #101936;
}

.schedule-info strong {
  display: block;
  font-size: 14px;
  font-weight: 900;
  color: #101936;
}
.schedule-info p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #60708d;
}

@media (max-width: 1440px) {
  .detail-workspace {
    grid-template-columns: minmax(216px, 264px) minmax(0, 1fr);
  }

  .detail-board {
    grid-template-columns: minmax(0, 1fr) minmax(374px, 432px);
  }
}

@media (max-width: 1180px) {
  .detail-workspace {
    grid-template-columns: minmax(0, 1fr);
  }
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
</style>
