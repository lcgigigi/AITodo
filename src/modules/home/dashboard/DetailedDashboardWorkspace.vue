<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Component } from 'vue'
import IconAlarmClock from '~icons/lucide/alarm-clock'
import IconArrowUpRight from '~icons/lucide/arrow-up-right'
import IconCheck from '~icons/lucide/check'
import IconChevronDown from '~icons/lucide/chevron-down'
import IconChevronLeft from '~icons/lucide/chevron-left'
import IconChevronRight from '~icons/lucide/chevron-right'
import IconCircle from '~icons/lucide/circle'
import IconSendHorizontal from '~icons/lucide/send-horizontal'
import { routeConfig } from '@/config/route.config'
import { useFeedbackStore } from '@/stores/feedback.store'
import { useRouter } from 'vue-router'
import { dashboardTools, navigateDashboardTool, type DashboardToolTarget } from './dashboardTools'
import type { CalendarEvent, CalendarTodoDraft } from './types'
import { formatEventTime, ymd } from './todoDisplay'
import {
  createTodo as serviceCreateTodo,
  getTodoMonthRange,
  loadTodoDetail,
  parseTodoText,
  updateTodoStatus as serviceUpdateTodoStatus,
} from './todo.service'
import { useDashboardTodos } from './useDashboardTodos'

type DetailMode = 'simple' | 'detail'
type DetailFilter = 'all' | 'pending' | 'done' | 'overdue'
type DetailTone = 'blue' | 'green' | 'orange' | 'violet' | 'cyan' | 'slate'

type FilterItem = {
  value: DetailFilter
  label: string
  icon?: Component
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
const taskDetails = ref<Record<string, CalendarEvent>>({})
const activeFilter = ref<DetailFilter>('all')
const activeTaskId = ref('')
const detailLoadingId = ref('')
const quickCreateText = ref('')
const isCreating = ref(false)
const {
  assignableUsers,
  currentUser,
  eventMap,
  isLoading,
  loadError,
  refreshTodos: refreshDashboardTodos,
  initializeDashboardTodos,
} = useDashboardTodos({
  getLoadRange: () => getTodoMonthRange(currentMonth.value),
  loadErrorFallback: '加载待办数据失败',
  onUnauthorized: redirectToLogin,
})

const filters: FilterItem[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待处理' },
  { value: 'done', label: '已完成' },
  { value: 'overdue', label: '逾期', icon: IconAlarmClock },
]

const selectedDateEvents = computed(() => eventMap.value.get(selectedDate.value) ?? [])
const pendingEvents = computed(() =>
  selectedDateEvents.value.filter((event) => event.status !== 'done' && !isRejectedEvent(event)),
)
const doneCount = computed(
  () => selectedDateEvents.value.filter((event) => event.status === 'done').length,
)
const overdueCount = computed(
  () => selectedDateEvents.value.filter((event) => isOverdueEvent(event)).length,
)
const selectedDateLabel = computed(() => formatDateTitle(selectedDate.value))
const selectedDateShortLabel = computed(() => formatDateShortTitle(selectedDate.value))
const mainTitle = computed(() => (selectedDate.value === todayDate.value ? '今日待办' : '当日待办'))
const filteredTasks = computed(() => {
  if (activeFilter.value === 'pending') return pendingEvents.value
  if (activeFilter.value === 'done') {
    return selectedDateEvents.value.filter((event) => event.status === 'done')
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
  overdue: overdueCount.value,
}))

const monthDays = computed(() => buildMonthDays())
const scheduleEvents = computed(() => selectedDateEvents.value)

onMounted(() => {
  void initializeDetailData()
})

async function initializeDetailData() {
  const initialized = await initializeDashboardTodos()
  if (!initialized) return

  taskDetails.value = {}
  ensureSelectedDateInLoadedMonth()
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

async function refreshTodos() {
  await refreshDashboardTodos()
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
    <aside class="detail-left-panel" aria-label="快捷入口">
      <nav class="detail-tool-panel" aria-label="AI工具">
        <button
          v-for="tool in dashboardTools"
          :key="tool.name"
          type="button"
          class="detail-tool-item side-content-card"
          :class="`tone-${tool.tone}`"
          @click="openDetailTool(tool)"
        >
          <span class="detail-tool-icon" aria-hidden="true">
            <component :is="tool.icon" />
          </span>
          <span class="detail-tool-name">{{ tool.name }}</span>
          <span class="detail-tool-go" aria-hidden="true">
            <IconArrowUpRight />
          </span>
        </button>
      </nav>
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
                  <span v-if="task.status === 'done'" class="task-done-text">已完成</span>
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
        <div class="detail-side-toolbar">
          <div class="mode-segment-wrapper">
            <div class="mode-segment" role="group" aria-label="首页模式">
              <button type="button" @click="emit('switch-mode', 'simple')">总览模式</button>
              <button type="button" class="active">工作模式</button>
            </div>
          </div>

          <div class="view-control-cluster" aria-label="日历视图">
            <button type="button" class="calendar-menu-btn" aria-label="展开日历视图选项">
              <IconChevronDown aria-hidden="true" />
            </button>
            <div class="calendar-range-segment" role="group" aria-label="日历范围">
              <button type="button" class="active" aria-pressed="true">月</button>
              <button type="button" aria-pressed="false" disabled>周</button>
            </div>
          </div>
        </div>

        <section class="calendar-card side-content-card" aria-label="月历">
          <header class="calendar-header-mock">
            <div class="calendar-month-group">
              <h2 @click="goToday" title="回到今天">{{ monthLabel(currentMonth) }}</h2>
              <button
                type="button"
                aria-label="上个月"
                @click="changeMonth(-1)"
                class="month-nav-btn"
              >
                <IconChevronLeft aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="下个月"
                @click="changeMonth(1)"
                class="month-nav-btn"
              >
                <IconChevronRight aria-hidden="true" />
              </button>
            </div>
            <div class="calendar-action-group">
              <button type="button" class="today-chip" @click="goToday">今天</button>
              <button type="button" class="today-ring-btn" aria-label="回到今天" @click="goToday">
                <IconCircle aria-hidden="true" />
              </button>
            </div>
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

          <footer v-if="scheduleEvents.length" class="schedule-footer">
            <button type="button" @click="activeFilter = 'all'">
              查看全部日程（{{ scheduleEvents.length }}）<IconChevronRight aria-hidden="true" />
            </button>
          </footer>
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
  padding: clamp(12px, 1.2vw, 20px) 0;
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
  grid-template-columns: minmax(0, 1fr) minmax(456px, 43%);
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
  gap: 16px;
  min-height: 0;
}

.detail-tool-panel {
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
  padding: 0 2px 6px;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: auto;
  align-content: start;
  gap: 16px;
  overflow: auto;
  scrollbar-width: none;
}

.detail-tool-panel::-webkit-scrollbar {
  display: none;
}

.detail-tool-item {
  position: relative;
  overflow: hidden;
  min-width: 0;
  aspect-ratio: 1;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 24px;
  background: radial-gradient(
      circle at 22% 20%,
      rgba(255, 255, 255, 0.96),
      rgba(255, 255, 255, 0) 34%
    ),
    linear-gradient(145deg, rgba(255, 255, 255, 0.66), rgba(238, 246, 255, 0.46)),
    rgba(248, 252, 255, 0.42);
  color: #243656;
  padding: 18px 12px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font: inherit;
  font-size: 15px;
  font-weight: 900;
  line-height: 1.2;
  text-align: center;
  white-space: normal;
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 20px 36px -30px rgba(18, 38, 72, 0.46);
  backdrop-filter: blur(18px) saturate(1.12);
  -webkit-backdrop-filter: blur(18px) saturate(1.12);
  transition:
    background 0.18s ease,
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.detail-tool-item::before {
  position: absolute;
  right: -22px;
  top: -22px;
  width: 74px;
  height: 74px;
  border-radius: 999px;
  background: var(--tool-glow, rgba(47, 124, 255, 0.16));
  opacity: 0.84;
  content: '';
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.detail-tool-item::after {
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 13px;
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, var(--tool-accent, #2f7cff), transparent);
  opacity: 0.16;
  content: '';
}

.detail-tool-item:hover,
.detail-tool-item:focus-visible {
  border-color: rgba(255, 255, 255, 0.96);
  background: radial-gradient(circle at 22% 20%, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0) 36%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.82), rgba(238, 246, 255, 0.58)),
    rgba(248, 252, 255, 0.5);
  transform: translateY(-4px) rotate(var(--hover-tilt, -0.8deg));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 22px 38px -26px rgba(18, 38, 72, 0.58);
  outline: none;
}

.detail-tool-item:hover::before,
.detail-tool-item:focus-visible::before {
  opacity: 1;
  transform: scale(1.18);
}

.detail-tool-icon {
  position: relative;
  z-index: 1;
  width: 46px;
  height: 46px;
  border-radius: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.68),
    0 14px 26px -22px currentColor;
}

.detail-tool-icon svg {
  width: 22px;
  height: 22px;
  stroke-width: 2.3;
}

.detail-tool-name {
  position: relative;
  z-index: 1;
  max-width: 100%;
  color: #1b2b4c;
  font-size: 16px;
  font-weight: 900;
  line-height: 1.2;
}

.detail-tool-go {
  position: absolute;
  z-index: 1;
  right: 12px;
  top: 12px;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.54);
  color: rgba(80, 96, 125, 0.74);
  display: grid;
  place-items: center;
  opacity: 0;
  transform: translate(-4px, 4px);
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.detail-tool-go svg {
  width: 14px;
  height: 14px;
  stroke-width: 2.6;
}

.detail-tool-item:hover .detail-tool-go,
.detail-tool-item:focus-visible .detail-tool-go {
  opacity: 1;
  transform: translate(0, 0);
}

.detail-tool-item:nth-child(2n) {
  --hover-tilt: 0.8deg;
}

.detail-tool-item:nth-child(3n) {
  --hover-tilt: -1.1deg;
}

.tone-orange .detail-tool-icon {
  background: #ffe5d7;
  color: #ff7a3d;
}

.tone-orange.detail-tool-item {
  --tool-accent: #ff7a3d;
  --tool-glow: rgba(255, 122, 61, 0.2);
}

.tone-blue .detail-tool-icon {
  background: #dbeafe;
  color: #2f7cff;
}

.tone-blue.detail-tool-item {
  --tool-accent: #2f7cff;
  --tool-glow: rgba(47, 124, 255, 0.2);
}

.tone-green .detail-tool-icon {
  background: #d9f8e7;
  color: #20bb77;
}

.tone-green.detail-tool-item {
  --tool-accent: #20bb77;
  --tool-glow: rgba(32, 187, 119, 0.2);
}

.tone-violet .detail-tool-icon,
.tone-purple .detail-tool-icon {
  background: #eadfff;
  color: #8b5cf6;
}

.tone-violet.detail-tool-item,
.tone-purple.detail-tool-item {
  --tool-accent: #8b5cf6;
  --tool-glow: rgba(139, 92, 246, 0.18);
}

.tone-cyan .detail-tool-icon {
  background: #d7f7ff;
  color: #09b6d7;
}

.tone-cyan.detail-tool-item {
  --tool-accent: #09b6d7;
  --tool-glow: rgba(9, 182, 215, 0.2);
}

.tone-sky .detail-tool-icon {
  background: #dff3ff;
  color: #26a4e8;
}

.tone-sky.detail-tool-item {
  --tool-accent: #26a4e8;
  --tool-glow: rgba(38, 164, 232, 0.2);
}

.tone-slate .detail-tool-icon {
  background: #e7edf5;
  color: #70819a;
}

.tone-slate.detail-tool-item {
  --tool-accent: #70819a;
  --tool-glow: rgba(112, 129, 154, 0.16);
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
  gap: 16px;
  min-height: 0;
  min-width: 0;
  padding: 18px 18px 18px 8px;
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
  flex: 0 0 clamp(390px, 40vh, 520px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 24px 26px 26px;
  border-radius: 24px;
  background: linear-gradient(142deg, rgba(255, 255, 255, 0.64), rgba(239, 247, 255, 0.42)),
    rgba(249, 252, 255, 0.56);
  border-color: rgba(255, 255, 255, 0.72);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.86),
    0 18px 38px -30px rgba(20, 48, 92, 0.36);
}

.schedule-card {
  flex: 1;
  min-height: 0;
  padding: 24px 26px 22px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 24px;
  background: linear-gradient(142deg, rgba(255, 255, 255, 0.62), rgba(239, 247, 255, 0.42)),
    rgba(249, 252, 255, 0.54);
  border-color: rgba(255, 255, 255, 0.7);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.84),
    0 18px 38px -30px rgba(20, 48, 92, 0.32);
}

.detail-side-toolbar {
  flex: 0 0 auto;
  min-height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.mode-segment-wrapper {
  width: min(288px, 50%);
  flex: 0 1 288px;
}
.mode-segment {
  display: flex;
  width: 100%;
  min-width: 0;
  background: rgba(238, 246, 255, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.68);
  border-radius: 999px;
  padding: 5px;
  backdrop-filter: blur(18px) saturate(1.12);
  -webkit-backdrop-filter: blur(18px) saturate(1.12);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.76),
    0 14px 28px -24px rgba(20, 48, 92, 0.38);
}
.mode-segment button {
  flex: 1;
  min-width: 0;
  height: 38px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #5f7192;
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
  transition:
    background 160ms ease,
    color 160ms ease,
    box-shadow 160ms ease;
}
.mode-segment button.active {
  background: linear-gradient(180deg, #3e8aff, #2575f5);
  color: white;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.32),
    0 9px 18px -10px rgba(37, 117, 245, 0.7);
}

.mode-segment button:focus-visible,
.calendar-menu-btn:focus-visible,
.calendar-range-segment button:focus-visible,
.month-nav-btn:focus-visible,
.today-chip:focus-visible,
.today-ring-btn:focus-visible,
.all-schedule-btn:focus-visible,
.schedule-footer button:focus-visible {
  outline: 2px solid rgba(47, 124, 255, 0.65);
  outline-offset: 2px;
}

.view-control-cluster {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.calendar-menu-btn {
  width: 46px;
  height: 40px;
  border: 1px solid rgba(255, 255, 255, 0.66);
  border-radius: 16px;
  background: rgba(238, 246, 255, 0.56);
  color: #5f7192;
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(16px) saturate(1.1);
  -webkit-backdrop-filter: blur(16px) saturate(1.1);
}

.calendar-menu-btn svg {
  width: 17px;
  height: 17px;
}

.calendar-range-segment {
  width: 140px;
  height: 40px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.66);
  border-radius: 17px;
  background: rgba(238, 246, 255, 0.56);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(16px) saturate(1.1);
  -webkit-backdrop-filter: blur(16px) saturate(1.1);
}

.calendar-range-segment button {
  flex: 1;
  height: 30px;
  border: none;
  border-radius: 11px;
  background: transparent;
  color: #6a7b98;
  font: inherit;
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
}

.calendar-range-segment button.active {
  background: linear-gradient(180deg, #3e8aff, #2575f5);
  color: #fff;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.32),
    0 8px 16px -10px rgba(37, 117, 245, 0.72);
}

.calendar-range-segment button:disabled {
  cursor: default;
  opacity: 1;
}

.calendar-header-mock {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 20px;
}

.calendar-month-group {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.calendar-header-mock h2 {
  margin: 0;
  color: #142142;
  font-size: 19px;
  font-weight: 900;
  white-space: nowrap;
  cursor: pointer;
}
.month-nav-btn {
  border: none;
  background: transparent;
  color: #273b65;
  cursor: pointer;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
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
  width: 19px;
  height: 19px;
  stroke-width: 2.4;
}

.calendar-action-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.today-chip,
.today-ring-btn {
  height: 36px;
  border: 1px solid rgba(199, 216, 241, 0.78);
  background: rgba(248, 251, 255, 0.62);
  color: #2f7cff;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.74);
}

.today-chip {
  min-width: 58px;
  border-radius: 12px;
  padding: 0 12px;
  font-size: 14px;
}

.today-ring-btn {
  width: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: #6980a1;
}

.today-ring-btn svg {
  width: 17px;
  height: 17px;
  stroke-width: 2.6;
}

.calendar-placeholder-wrapper {
  flex: 1;
  min-height: 0;
  border-radius: 14px;
  padding: 0;
  background: transparent;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: 44px repeat(6, minmax(0, 1fr));
  height: 100%;
  column-gap: 0;
  row-gap: 0;
  text-align: center;
}
.week-label {
  min-width: 0;
  height: 44px;
  border-bottom: 1px solid rgba(166, 186, 214, 0.24);
  color: #687999;
  display: grid;
  place-items: center;
  font-size: 15px;
  font-weight: 900;
}
.month-day {
  position: relative;
  min-width: 0;
  min-height: 0;
  border: none;
  background: transparent;
  border-radius: 14px;
  color: #162442;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font: inherit;
  transition:
    color 160ms ease,
    background 160ms ease,
    transform 160ms ease;
}

.month-day:hover {
  background: rgba(47, 124, 255, 0.08);
}

.month-day strong {
  position: relative;
  z-index: 1;
  width: 38px;
  height: 38px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-size: 16px;
  font-weight: 900;
  line-height: 1;
  transition:
    background 160ms ease,
    color 160ms ease,
    box-shadow 160ms ease;
}
.month-day.muted {
  color: #a9b6c9;
}
.month-day.today:not(.selected) strong {
  color: var(--detail-blue);
  box-shadow: inset 0 0 0 1px rgba(47, 124, 255, 0.24);
}

.month-day.selected {
  color: white;
}

.month-day.selected strong {
  width: 50px;
  height: 50px;
  color: #fff;
  background: linear-gradient(180deg, #4c8dff, #2879ff);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.35),
    0 10px 22px -12px rgba(40, 121, 255, 0.82);
}
.day-dots {
  position: relative;
  z-index: 2;
  min-height: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 0;
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
}

.month-day.selected .day-dots i {
  background: rgba(255, 255, 255, 0.86);
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

.side-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  margin-bottom: 0;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(166, 186, 214, 0.2);
}

.schedule-title-area {
  display: flex;
  align-items: baseline;
  gap: 18px;
  min-width: 0;
}
.schedule-title-area h2 {
  margin: 0;
  color: #142142;
  font-size: 18px;
  font-weight: 900;
  white-space: nowrap;
}
.schedule-title-area p {
  margin: 0;
  color: #6d7e9b;
  font-size: 14px;
  font-weight: 800;
  white-space: nowrap;
}

.all-schedule-btn {
  flex: 0 0 auto;
  border: none;
  background: transparent;
  border-radius: 12px;
  padding: 6px 0 6px 10px;
  font: inherit;
  font-size: 14px;
  font-weight: 800;
  color: var(--detail-blue);
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.all-schedule-btn svg {
  width: 17px;
  height: 17px;
  stroke-width: 2.5;
}

.schedule-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  display: flex;
  flex-direction: column;
  padding-top: 6px;
}
.schedule-list::-webkit-scrollbar {
  display: none;
}

.schedule-item {
  position: relative;
  display: grid;
  grid-template-columns: 24px 72px minmax(0, 1fr) auto;
  gap: 14px;
  min-height: 78px;
  padding: 18px 0;
  cursor: pointer;
  align-items: center;
  border-bottom: 1px solid rgba(166, 186, 214, 0.18);
  transition:
    background 160ms ease,
    transform 160ms ease;
}

.schedule-item:hover {
  background: rgba(47, 124, 255, 0.05);
}
.schedule-item::after {
  content: '';
  position: absolute;
  left: 11px;
  top: 44px;
  bottom: -18px;
  width: 2px;
  background: linear-gradient(180deg, rgba(47, 124, 255, 0.34), rgba(47, 124, 255, 0.08));
}
.schedule-item:last-child::after {
  display: none;
}

.schedule-dot {
  position: relative;
  z-index: 1;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--detail-blue);
  border: 3px solid rgba(235, 244, 255, 0.98);
  box-shadow: 0 0 0 1px rgba(47, 124, 255, 0.22);
  justify-self: center;
}

.schedule-item time {
  color: #172440;
  font-size: 16px;
  font-weight: 900;
  white-space: nowrap;
}

.schedule-info {
  min-width: 0;
}

.schedule-info strong {
  display: block;
  overflow: hidden;
  color: #172440;
  font-size: 16px;
  font-weight: 900;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.schedule-info p {
  margin: 7px 0 0;
  overflow: hidden;
  color: #76869f;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.schedule-item > span {
  align-self: center;
  border-radius: 8px;
  padding: 5px 9px;
  font-size: 13px;
  font-weight: 900;
  white-space: nowrap;
}

.schedule-empty {
  margin-top: 18px;
  color: #233454;
  font-size: 15px;
  font-weight: 800;
}

.schedule-footer {
  flex: 0 0 auto;
  display: flex;
  justify-content: center;
  padding-top: 16px;
  border-top: 1px solid rgba(166, 186, 214, 0.18);
}

.schedule-footer button {
  border: none;
  border-radius: 14px;
  background: transparent;
  color: var(--detail-blue);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font: inherit;
  font-size: 16px;
  font-weight: 900;
  cursor: pointer;
}

.schedule-footer svg {
  width: 18px;
  height: 18px;
  stroke-width: 2.5;
}

@media (max-width: 1440px) {
  .detail-workspace {
    grid-template-columns: minmax(216px, 264px) minmax(0, 1fr);
  }

  .detail-board {
    grid-template-columns: minmax(0, 1fr) minmax(420px, 42%);
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

@media (max-width: 900px) {
  .detail-workspace {
    width: calc(100% - 28px);
  }
}
</style>
