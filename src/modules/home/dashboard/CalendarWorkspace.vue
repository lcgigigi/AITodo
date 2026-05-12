<script setup lang="ts">
import { computed, ref } from 'vue'
import boyImage from '@/assets/boy.png'
import CalendarMonth from './CalendarMonth.vue'
import DayPreviewPanel from './DayPreviewPanel.vue'
import type { CalendarDay, CalendarEvent, CalendarSpecialDay } from './types'

const selectedDate = ref('2026-05-08')
const screenOrigin = { x: 33, y: 36 }
const featureEntrances = [
  { name: '力宝百问1', x: 18, y: 8 },
  { name: '力宝百问2', x: 50, y: 8 },
  { name: '力宝百问3', x: 82, y: 8 },
  { name: '力宝百问4', x: 18, y: 19 },
  { name: '力宝百问5', x: 50, y: 19 },
  { name: '力宝百问6', x: 82, y: 19 },
]

const events: CalendarEvent[] = [
  {
    id: 'evt-0504-approval',
    date: '2026-05-04',
    time: '10:00',
    title: '请假申请审批',
    type: 'approval',
    owner: '人事流程',
    status: 'todo',
  },
  {
    id: 'evt-0505-ai',
    date: '2026-05-05',
    time: '15:30',
    title: '图文素材分析',
    type: 'ai',
    owner: '市场组',
    status: 'done',
    source: '图文分析',
  },
  {
    id: 'evt-0506-meeting',
    date: '2026-05-06',
    time: '09:30',
    title: '周会纪要整理',
    type: 'meeting',
    owner: '项目组',
    status: 'todo',
    source: '会议纪要',
  },
  {
    id: 'evt-0508-meeting',
    date: '2026-05-08',
    time: '09:30',
    title: '产品方案同步会',
    type: 'meeting',
    owner: '产品团队',
    status: 'todo',
    source: '会议纪要',
  },
  {
    id: 'evt-0508-task',
    date: '2026-05-08',
    time: '11:00',
    title: '补充首页日历需求',
    type: 'task',
    owner: '刘畅',
    status: 'urgent',
  },
  {
    id: 'evt-0508-ai',
    date: '2026-05-08',
    time: '16:00',
    title: '生成汇报 PPT 初稿',
    type: 'ai',
    owner: '运营组',
    status: 'todo',
    source: '智能PPT',
  },
  {
    id: 'evt-0511-task',
    date: '2026-05-11',
    time: '14:00',
    title: '制度问答验收',
    type: 'task',
    owner: '知识库',
    status: 'todo',
    source: '力宝百问',
  },
  {
    id: 'evt-0514-ai',
    date: '2026-05-14',
    time: '10:30',
    title: '智能体脚本评审',
    type: 'ai',
    owner: '智体工坊',
    status: 'todo',
  },
  {
    id: 'evt-0517-approval',
    date: '2026-05-17',
    time: '18:00',
    title: '考勤异常确认',
    type: 'approval',
    owner: '行政',
    status: 'urgent',
  },
  {
    id: 'evt-0521-meeting',
    date: '2026-05-21',
    time: '13:30',
    title: '季度复盘材料会',
    type: 'meeting',
    owner: '管理层',
    status: 'todo',
    source: '智能PPT',
  },
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

const eventMap = computed(() => {
  const map = new Map<string, CalendarEvent[]>()
  for (const event of events) {
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
    const list = map.get(item.date) ?? []
    list.push(item)
    map.set(item.date, list)
  }
  return map
})

const days = computed<CalendarDay[]>(() => {
  const result: CalendarDay[] = []
  const start = new Date(2026, 4, 1)
  const offset = (start.getDay() + 6) % 7
  const cursor = new Date(2026, 4, 1 - offset)

  for (let i = 0; i < 35; i += 1) {
    const date = ymd(cursor)
    result.push({
      date,
      day: cursor.getDate(),
      inMonth: cursor.getMonth() === 4,
      isToday: date === '2026-05-08',
      specialDays: specialDayMap.value.get(date) ?? [],
      events: eventMap.value.get(date) ?? [],
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return result
})

const selectedEvents = computed(() => eventMap.value.get(selectedDate.value) ?? [])
const selectedSpecialDays = computed(() => specialDayMap.value.get(selectedDate.value) ?? [])

const selectedDateLabel = computed(() => {
  const date = new Date(`${selectedDate.value}T12:00:00`)
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
  return `${date.getMonth() + 1}月${date.getDate()}日 ${weekday}`
})

function selectDate(date: string) {
  selectedDate.value = date
}
</script>

<template>
  <div class="calendar-workspace">
    <div class="calendar-column">
      <CalendarMonth :days="days" :selected-date="selectedDate" @select="selectDate" />
    </div>

    <aside class="side-column">
      <section class="profile-card">
        <img
          class="avatar"
          src="https://api.dicebear.com/7.x/notionists/svg?seed=Shakir&backgroundColor=93C5FD"
          alt="Avatar"
        />
        <div>
          <div class="hello">你好，同学</div>
          <div class="profile-meta">今天也可以从日程开始</div>
        </div>
      </section>
      <DayPreviewPanel
        :date-label="selectedDateLabel"
        :events="selectedEvents"
        :special-days="selectedSpecialDays"
      />
      <div class="illustration-cluster" aria-label="功能入口">
        <img class="side-illustration" :src="boyImage" alt="" aria-hidden="true" />
        <svg class="feature-lines" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true">
          <line
            v-for="entry in featureEntrances"
            :key="`line-${entry.name}`"
            :x1="screenOrigin.x"
            :y1="screenOrigin.y * 1.5"
            :x2="entry.x"
            :y2="entry.y * 1.5"
          />
        </svg>
        <span
          class="screen-origin"
          :style="{ left: `${screenOrigin.x}%`, top: `${screenOrigin.y}%` }"
          aria-hidden="true"
        ></span>
        <button
          v-for="entry in featureEntrances"
          :key="entry.name"
          class="feature-entry"
          :style="{ left: `${entry.x}%`, top: `${entry.y}%` }"
          type="button"
        >
          {{ entry.name }}
        </button>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.calendar-workspace {
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding: 18px 24px 20px;
  display: grid;
  grid-template-columns: minmax(570px, 0.96fr) minmax(360px, 450px);
  gap: 20px;
  overflow: hidden;
}

.calendar-column,
.side-column {
  min-height: 0;
}

.side-column {
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-right: 2px;
}

.side-column::-webkit-scrollbar {
  width: 0;
}

.profile-card {
  padding: 16px;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 14px 34px -26px rgba(15, 23, 42, 0.32);
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  background: #dbeafe;
  object-fit: cover;
  flex: 0 0 auto;
}

.hello {
  color: #111827;
  font-size: 15px;
  font-weight: 800;
}

.profile-meta {
  margin-top: 4px;
  color: #6b7280;
  font-size: 12px;
  line-height: 1.35;
}

.illustration-cluster {
  position: relative;
  width: clamp(300px, 92%, 390px);
  aspect-ratio: 2 / 3;
  align-self: flex-end;
  margin-top: auto;
  margin-right: -10px;
  flex: 0 1 auto;
}

.side-illustration {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center bottom;
  filter: drop-shadow(0 18px 22px rgba(15, 23, 42, 0.08));
  pointer-events: none;
  user-select: none;
}

.screen-origin {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: rgba(217, 119, 6, 0.34);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.feature-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.feature-lines line {
  stroke: rgba(217, 119, 6, 0.3);
  stroke-width: 0.35;
  stroke-linecap: round;
  stroke-dasharray: 2 3;
}

.feature-entry {
  position: absolute;
  transform: translate(-50%, -50%);
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(217, 119, 6, 0.18);
  border-radius: 999px;
  background: rgba(255, 251, 235, 0.92);
  color: #7c2d12;
  font: inherit;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  box-shadow: 0 8px 18px -16px rgba(120, 53, 15, 0.42);
  cursor: pointer;
  white-space: nowrap;
  z-index: 1;
}

@media (max-width: 1180px) {
  .calendar-workspace {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .side-column {
    overflow: visible;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }

  .illustration-cluster {
    grid-column: 2;
    justify-self: end;
    width: min(300px, 92%);
    margin-top: 0;
  }
}

@media (max-width: 760px) {
  .calendar-workspace {
    padding: 16px;
  }

  .side-column {
    grid-template-columns: 1fr;
  }

  .illustration-cluster {
    grid-column: auto;
    justify-self: end;
    width: min(290px, 100%);
  }
}
</style>
