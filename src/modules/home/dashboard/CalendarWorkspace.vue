<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import girlImage from '@/assets/girl.png'
import campusImage from '@/assets/modelone.png'
import { useUserStore } from '@/stores/user.store'
import CalendarMonth from './CalendarMonth.vue'
import DayPreviewPanel from './DayPreviewPanel.vue'
import type { CalendarDay, CalendarEvent, CalendarEventStatus, CalendarSpecialDay, CalendarTodoDraft, CalendarTodoUpdate } from './types'
import { createTodo as mockCreateTodo, listTodos, mockInitialTodos, mockUsers, updateTodo as mockUpdateTodo, updateTodoStatus as mockUpdateTodoStatus } from './todoMock'

const selectedDate = ref('2026-05-08')
const currentMonth = ref(new Date(2026, 4, 1))
const currentUserId = ref('leader-zhang')
const allEvents = ref<CalendarEvent[]>(mockInitialTodos)
const isProfileDialogOpen = ref(false)
const isDayPreviewOpen = ref(false)
const calendarViewMode = ref<'month' | 'week'>('month')
const userStore = useUserStore()
const router = useRouter()

const agents = [
  {
    name: '力宝百问',
    desc: '制度、流程与知识库问答',
    badge: '知识',
    status: '在线',
    accent: '#2563eb',
  },
  {
    name: '会议纪要',
    desc: '录音整理、待办提取和摘要',
    badge: '效率',
    status: '可用',
    accent: '#059669',
  },
  {
    name: '智能PPT',
    desc: '汇报结构、页面文案和初稿生成',
    badge: '创作',
    status: '推荐',
    accent: '#7c3aed',
  },
  {
    name: '图文分析',
    desc: '素材识别、卖点提炼与复盘',
    badge: '分析',
    status: '可用',
    accent: '#d97706',
  },
  {
    name: '编码助手',
    desc: '提升编码能力，获得构建项目所需的资源与建议',
    badge: '开发',
    status: '可用',
    accent: '#06b6d4',
  },
  {
    name: '学习辅导',
    desc: '掌握新概念，温习知识点，获得个性化学习建议',
    badge: '学习',
    status: '可用',
    accent: '#60a5fa',
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

const eventMap = computed(() => {
  const map = new Map<string, CalendarEvent[]>()
  for (const event of events.value) {
    const list = map.get(event.date) ?? []
    list.push(event)
    map.set(event.date, list)
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.time.localeCompare(b.time))
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

const currentUser = computed(() => mockUsers.find((user) => user.id === currentUserId.value) ?? mockUsers[0])
const assignableUsers = computed(() => {
  if (currentUser.value.role === 'leader') {
    const teamIds = currentUser.value.teamMemberIds ?? []
    return mockUsers.filter((user) => user.id === currentUser.value.id || teamIds.includes(user.id))
  }

  return [currentUser.value]
})
const events = computed(() => listTodos(allEvents.value, currentUser.value))

const days = computed<CalendarDay[]>(() => {
  const result: CalendarDay[] = []
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  const start = new Date(year, month, 1)
  const offset = (start.getDay() + 6) % 7
  const totalDays = getDaysInMonth(year, month)
  const visibleDays = offset + totalDays > 35 ? 42 : 35
  const cursor = new Date(year, month, 1 - offset)

  for (let i = 0; i < visibleDays; i += 1) {
    const date = ymd(cursor)
    result.push({
      date,
      day: cursor.getDate(),
      inMonth: cursor.getFullYear() === year && cursor.getMonth() === month,
      isToday: date === '2026-05-08',
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
      isToday: date === '2026-05-08',
      specialDays: specialDayMap.value.get(date) ?? [],
      events: eventMap.value.get(date) ?? [],
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return result
})

const monthLabel = computed(() => `${currentMonth.value.getFullYear()} 年 ${currentMonth.value.getMonth() + 1} 月`)
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
const visibleCalendarDays = computed(() => (calendarViewMode.value === 'week' ? weekDays.value : days.value))
const selectedEvents = computed(() => eventMap.value.get(selectedDate.value) ?? [])
const selectedSpecialDays = computed(() => specialDayMap.value.get(selectedDate.value) ?? [])
const todayEvents = computed(() => eventMap.value.get('2026-05-08') ?? [])
const todayPendingEvents = computed(() => todayEvents.value.filter((event) => event.status !== 'done'))
const todayUrgentCount = computed(
  () => todayEvents.value.filter((event) => event.priority === 'urgent' && event.status !== 'done').length,
)
const nextTodayEvent = computed(() => todayPendingEvents.value[todayPendingEvents.value.length - 1])
const urgentCount = computed(() => events.value.filter((event) => event.priority === 'urgent' && event.status !== 'done').length)
const completedCount = computed(() => events.value.filter((event) => event.status === 'done').length)
const userName = computed(() => currentUser.value.name)
const userDepartment = computed(() => `${currentUser.value.department ?? 'AI平台'} · ${currentUser.value.role === 'leader' ? '领导' : '员工'}`)
const avatarUrl = computed(() => currentUser.value.avatar ?? userStore.profile?.avatar ?? girlImage)
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
})
const timeLabel = computed(() =>
  new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date()),
)
const dateLabel = computed(() =>
  new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date()),
)
const dataUpdateLabel = computed(() => `数据更新于 ${timeLabel.value}`)
const weekTaskCompleted = computed(() => Math.max(completedCount.value, 5))
const weekTaskProgress = computed(() => Math.round((weekTaskCompleted.value / Math.max(events.value.length, 1)) * 100))

const selectedDateLabel = computed(() => {
  const date = new Date(`${selectedDate.value}T12:00:00`)
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
  return `${date.getMonth() + 1}月${date.getDate()}日 ${weekday}`
})

function selectDate(date: string) {
  selectedDate.value = date
  const nextDate = new Date(`${date}T12:00:00`)
  if (
    nextDate.getFullYear() !== currentMonth.value.getFullYear() ||
    nextDate.getMonth() !== currentMonth.value.getMonth()
  ) {
    currentMonth.value = new Date(nextDate.getFullYear(), nextDate.getMonth(), 1)
  }
}

function openDayPreview(date: string) {
  selectDate(date)
  isDayPreviewOpen.value = true
}

function createTodo(payload: CalendarTodoDraft) {
  allEvents.value = mockCreateTodo(allEvents.value, currentUser.value, payload)
  selectDate(payload.date)
  isDayPreviewOpen.value = true
}

function updateTodo(payload: CalendarTodoUpdate) {
  allEvents.value = mockUpdateTodo(allEvents.value, currentUser.value, payload)
  selectDate(payload.date)
  isDayPreviewOpen.value = true
}

function updateTodoStatus(id: string, status: CalendarEventStatus) {
  allEvents.value = mockUpdateTodoStatus(allEvents.value, currentUser.value, id, status)
}

function changePeriod(delta: number) {
  if (calendarViewMode.value === 'week') {
    const selected = new Date(`${selectedDate.value}T12:00:00`)
    selected.setDate(selected.getDate() + delta * 7)
    selectedDate.value = ymd(selected)
    currentMonth.value = new Date(selected.getFullYear(), selected.getMonth(), 1)
    return
  }

  const selected = new Date(`${selectedDate.value}T12:00:00`)
  const nextMonth = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() + delta, 1)
  const nextDay = Math.min(selected.getDate(), getDaysInMonth(nextMonth.getFullYear(), nextMonth.getMonth()))

  currentMonth.value = nextMonth
  selectedDate.value = ymd(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), nextDay))
}

function openAgentList() {
  router.push({ name: 'AgentList' })
}
</script>

<template>
  <div class="calendar-workspace">
    <section class="profile-welcome-panel" aria-label="个人信息与欢迎区">
      <section class="profile-panel">
        <div class="profile-menu-anchor">
          <button class="profile-trigger" type="button" @click="isProfileDialogOpen = !isProfileDialogOpen">
            <img class="avatar" :src="avatarUrl" alt="用户头像" />
            <span class="profile-copy">
              <strong>{{ userName }}</strong>
              <span>{{ userDepartment }}</span>
            </span>
          </button>

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
              <button class="dialog-close" type="button" aria-label="关闭" @click="isProfileDialogOpen = false">×</button>
            </header>

            <div class="dialog-section">
              <p class="dialog-label">身份</p>
              <div class="role-switch" aria-label="角色切换">
                <button
                  v-for="user in mockUsers"
                  :key="user.id"
                  type="button"
                  :class="{ active: user.id === currentUserId }"
                  @click="currentUserId = user.id"
                >
                  {{ user.role === 'leader' ? '领导' : '员工' }}
                </button>
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
        <div class="time-block">
          <span>{{ dateLabel }}</span>
          <strong>{{ timeLabel }}</strong>
        </div>

        <div class="welcome-main">
          <h1>{{ greeting }}，{{ userName }}</h1>
          <p>
            今日 {{ todayPendingEvents.length }} 项待办，{{ todayUrgentCount }} 项高优先级，<br />
            {{ nextTodayEvent?.time ?? '16:00' }} 需完成 PPT 初稿，<br />
            AI 已为你整理重点。
          </p>
          <span class="data-update">
            {{ dataUpdateLabel }}
            <i aria-hidden="true">↻</i>
          </span>
        </div>

        <div class="campus-visual" aria-hidden="true">
          <img :src="campusImage" alt="" />
          <span class="campus-pin pin-office"><b></b>办公楼</span>
          <span class="campus-pin pin-production"><b></b>生产区</span>
          <span class="campus-pin pin-meeting"><b></b>会议中心</span>
          <span class="campus-pin pin-check"><b></b>巡检点</span>
        </div>

        <div class="quick-metrics">
          <article class="metric-card metric-card-today">
            <span>今日待办</span>
            <strong><em>{{ todayPendingEvents.length }}</em>项</strong>
            <p>已完成 {{ todayEvents.length - todayPendingEvents.length }} 项</p>
            <div class="metric-ring" style="--progress: 0deg">
              <b>0%</b>
            </div>
          </article>

          <article class="metric-card metric-card-week">
            <span>本周任务</span>
            <strong><em>{{ events.length }}</em>项</strong>
            <p>
              已完成 {{ weekTaskCompleted }} 项<br />
              较上周 <i>+14% ↑</i>
            </p>
            <div class="metric-ring" :style="{ '--progress': `${weekTaskProgress * 3.6}deg` }">
              <b>{{ weekTaskProgress }}%</b>
            </div>
          </article>

          <article class="metric-card metric-card-urgent">
            <span>高优先级</span>
            <strong><em>{{ todayUrgentCount }}</em>项</strong>
            <p>即将到期 {{ todayUrgentCount }} 项</p>
            <div class="urgent-symbol" aria-hidden="true">
              <span>!</span>
            </div>
            <i class="urgent-spark" aria-hidden="true"></i>
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

    <section class="panel agent-panel" aria-label="智能体">
      <header class="section-head">
        <div>
          <h2>常用智能体</h2>
        </div>
        <div class="section-actions">
          <span>{{ agents.length }} 个</span>
          <button type="button" @click="openAgentList">查看更多</button>
        </div>
      </header>

      <div class="agent-list">
        <article v-for="agent in agents" :key="agent.name" class="agent-card">
          <div class="agent-icon" :style="{ background: agent.accent }">{{ agent.name.slice(0, 1) }}</div>
          <div class="agent-main">
            <div class="agent-title">
              <h3>{{ agent.name }}</h3>
              <span>{{ agent.status }}</span>
            </div>
            <p>{{ agent.desc }}</p>
          </div>
          <span class="agent-badge">{{ agent.badge }}</span>
          <button class="agent-menu" type="button" :aria-label="`${agent.name} 更多操作`">⋮</button>
        </article>
      </div>
    </section>

    <section class="layout-column left-column" aria-label="日历与待办">
      <div class="panel calendar-panel">
        <CalendarMonth
          v-model:view-mode="calendarViewMode"
          :days="visibleCalendarDays"
          :selected-date="selectedDate"
          :month-label="monthLabel"
          :week-label="weekLabel"
          @select="openDayPreview"
          @previous-period="changePeriod(-1)"
          @next-period="changePeriod(1)"
        />
      </div>
    </section>

    <n-modal v-model:show="isDayPreviewOpen" :mask-closable="true" :auto-focus="false">
      <div class="day-preview-dialog">
        <DayPreviewPanel
          :date="selectedDate"
          :date-label="selectedDateLabel"
          :events="selectedEvents"
          :special-days="selectedSpecialDays"
          :current-user="currentUser"
          :assignable-users="assignableUsers"
          show-close
          @create-todo="createTodo"
          @update-todo="updateTodo"
          @update-status="updateTodoStatus"
          @close="isDayPreviewOpen = false"
        />
      </div>
    </n-modal>
  </div>
</template>

<style scoped>
.calendar-workspace {
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding: 22px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(560px, 2fr);
  grid-template-rows: minmax(370px, 1.5fr) minmax(240px, 1fr);
  gap: 8px 18px;
  overflow: hidden;
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
  grid-column: 3;
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

.day-preview-dialog {
  width: min(680px, calc(100vw - 32px));
  max-height: min(760px, calc(100vh - 48px));
  box-sizing: border-box;
  border: 1px solid rgba(226, 232, 240, 0.92);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 30px 80px -34px rgba(15, 23, 42, 0.62);
  padding: 22px;
  overflow: auto;
}

.profile-welcome-panel {
  position: relative;
  isolation: isolate;
  grid-column: 1 / 3;
  grid-row: 1;
  min-height: 0;
  padding: 22px 20px 16px;
  display: block;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
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
}

.profile-welcome-panel .welcome-panel {
  position: relative;
  z-index: 1;
  border-radius: 0;
}

.welcome-panel {
  height: 100%;
  padding: 0;
  display: grid;
  grid-template-columns: minmax(205px, 0.82fr) minmax(240px, 1.18fr);
  grid-template-rows: minmax(214px, 1fr) 124px;
  gap: 16px 14px;
  background: transparent;
  color: #111827;
}

.time-block {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-start;
  gap: 4px;
}

.time-block span {
  color: #667085;
  font-size: 12px;
  font-weight: 850;
  line-height: 1;
}

.time-block strong {
  color: #0f172a;
  font-size: clamp(44px, 3.9vw, 58px);
  line-height: 0.9;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
}

.welcome-main {
  grid-column: 1;
  grid-row: 1;
  align-self: end;
  max-width: 260px;
  padding: 118px 0 0 6px;
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

.welcome-main h1 {
  margin: 0;
  color: #0f172a;
  font-size: clamp(22px, 1.9vw, 30px);
  line-height: 1.08;
  font-weight: 900;
  letter-spacing: 0;
}

.welcome-main p {
  margin-top: 10px;
  color: #64748b;
  font-size: 14px;
  font-weight: 850;
  line-height: 1.45;
}

.data-update {
  margin-top: 18px;
  color: #94a3b8;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  font-weight: 850;
}

.data-update i {
  color: #64748b;
  font-style: normal;
  font-size: 15px;
  line-height: 1;
}

.campus-visual {
  position: relative;
  grid-column: 2;
  grid-row: 1;
  align-self: stretch;
  min-height: 0;
  padding-top: 42px;
}

.campus-visual img {
  position: absolute;
  right: -22px;
  bottom: -10px;
  width: min(124%, 590px);
  max-height: 310px;
  object-fit: contain;
  filter: drop-shadow(0 26px 30px rgba(37, 99, 235, 0.12));
}

.campus-pin {
  position: absolute;
  z-index: 2;
  min-height: 27px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 12px 24px -20px rgba(15, 23, 42, 0.48);
  padding: 0 11px 0 9px;
  color: #334155;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}

.campus-pin b {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: currentColor;
  box-shadow: inset 0 0 0 4px rgba(255, 255, 255, 0.68);
}

.pin-office {
  top: 94px;
  left: 4%;
  color: #2563eb;
}

.pin-production {
  top: 48px;
  left: 50%;
  color: #059669;
}

.pin-meeting {
  right: 8%;
  bottom: 68px;
  color: #f97316;
}

.pin-check {
  left: 40%;
  bottom: 6px;
  color: #7c3aed;
}

.quick-metrics {
  grid-column: 1 / -1;
  grid-row: 2;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.metric-card {
  position: relative;
  min-height: 106px;
  box-sizing: border-box;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.76);
  padding: 13px 18px;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
  overflow: hidden;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.74),
    0 16px 32px -34px rgba(15, 23, 42, 0.32);
}

.metric-card strong {
  display: block;
  margin-top: 10px;
  margin-bottom: 5px;
  color: #0f172a;
  font-size: 14px;
  line-height: 1;
  font-weight: 900;
}

.metric-card strong em {
  margin-right: 4px;
  color: #0f172a;
  font-style: normal;
  font-size: 28px;
  font-weight: 950;
}

.metric-card-today strong em {
  color: #2563eb;
}

.metric-card-urgent strong em {
  color: #ef4444;
}

.metric-card > span {
  display: block;
  color: #334155;
  font-size: 14px;
  font-weight: 900;
}

.metric-card p {
  margin-top: 0;
  color: #64748b;
  font-size: 12px;
  font-weight: 850;
  line-height: 1.35;
}

.metric-card p i {
  color: #10b981;
  font-style: normal;
  font-weight: 950;
}

.metric-ring {
  position: absolute;
  right: 28px;
  top: 50%;
  width: 58px;
  height: 58px;
  border-radius: 999px;
  background: conic-gradient(#059669 var(--progress), #e5e7eb 0);
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.metric-ring::before {
  content: '';
  position: absolute;
  inset: 8px;
  border-radius: inherit;
  background: #ffffff;
}

.metric-ring b {
  position: relative;
  color: #0f172a;
  font-size: 14px;
  font-weight: 950;
}

.metric-card-today .metric-ring {
  background: conic-gradient(#2563eb var(--progress), #e5e7eb 0);
}

.urgent-symbol {
  position: absolute;
  right: 34px;
  top: 50%;
  width: 58px;
  height: 58px;
  border-radius: 999px;
  border: 7px solid rgba(239, 68, 68, 0.13);
  color: #ef4444;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transform: translateY(-56%);
}

.urgent-symbol span {
  width: 0;
  height: 0;
  border-left: 13px solid transparent;
  border-right: 13px solid transparent;
  border-bottom: 23px solid #ef4444;
  color: #ffffff;
  display: inline-flex;
  align-items: flex-end;
  justify-content: center;
  font-size: 15px;
  font-weight: 950;
  line-height: 18px;
  padding-bottom: 2px;
  box-sizing: border-box;
}

.urgent-symbol span::before {
  content: '!';
  position: absolute;
  transform: translateY(21px);
  font-weight: 950;
}

.urgent-spark {
  position: absolute;
  right: 24px;
  bottom: 15px;
  width: 54px;
  height: 16px;
  background:
    linear-gradient(145deg, transparent 0 17%, #ef4444 18% 24%, transparent 25% 39%, #ef4444 40% 46%, transparent 47% 62%, #ef4444 63% 69%, transparent 70%),
    linear-gradient(35deg, transparent 0 18%, #ef4444 19% 25%, transparent 26%);
  opacity: 0.9;
}

.agent-panel {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.agent-panel {
  grid-column: 1 / 3;
  grid-row: 2;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.68);
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
.day-preview-dialog::-webkit-scrollbar {
  width: 0;
}

.agent-card {
  position: relative;
  min-height: 118px;
  box-sizing: border-box;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.68);
  padding: 18px 14px 14px;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  grid-template-rows: auto auto;
  align-items: start;
  gap: 8px 12px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.64);
}

.agent-icon {
  width: 42px;
  height: 42px;
  border-radius: 13px;
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
  display: block;
  padding-right: 32px;
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

.agent-title span {
  position: absolute;
  top: 18px;
  right: 38px;
  min-height: 19px;
  padding: 0 7px;
  border-radius: 999px;
  background: #dcfce7;
  color: #166534;
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-weight: 850;
  white-space: nowrap;
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
  background: #dcfce7;
  color: #166534;
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
  color: #111827;
  font: inherit;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.profile-panel {
  position: absolute;
  z-index: 25;
  top: 22px;
  left: 28px;
  padding: 0;
  background: transparent;
}

.profile-menu-anchor {
  position: relative;
  width: fit-content;
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
  gap: 12px;
  text-align: left;
  cursor: pointer;
}

.profile-trigger:focus-visible {
  outline: 2px solid rgba(37, 99, 235, 0.36);
  outline-offset: 6px;
}

.avatar {
  width: 50px;
  height: 50px;
  border: 1px solid rgba(226, 232, 240, 0.76);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.42);
  object-fit: cover;
  flex: 0 0 auto;
}

.profile-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.profile-copy strong {
  color: #111827;
  font-size: 21px;
  font-weight: 900;
  line-height: 1.15;
}

.profile-copy span {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.35;
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
  z-index: 22;
  background: transparent;
}

.profile-dialog {
  position: absolute;
  top: calc(100% + 14px);
  left: 0;
  z-index: 30;
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

  .agent-panel {
    grid-row: auto;
  }

  .agent-panel {
    grid-column: 1 / -1;
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

  .agent-panel {
    grid-column: auto;
    grid-row: auto;
  }

  .calendar-panel {
    min-height: 540px;
  }

  .agent-panel {
    max-height: none;
    overflow: visible;
  }
}

@media (max-width: 620px) {
  .calendar-workspace {
    padding: 12px;
    gap: 12px;
  }

  .layout-column {
    gap: 12px;
  }

  .welcome-panel,
  .profile-panel,
  .agent-panel,
  .day-preview-dialog {
    padding: 14px;
    border-radius: 16px;
  }

  .time-block,
  .section-head {
    flex-direction: column;
  }

  .welcome-main {
    max-width: 100%;
  }

  .calendar-panel {
    min-height: 500px;
  }

  .agent-card {
    grid-template-columns: 38px minmax(0, 1fr);
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
