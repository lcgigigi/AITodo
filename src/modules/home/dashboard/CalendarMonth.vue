<script setup lang="ts">
import { computed, ref } from 'vue'
import IconChevronLeft from '~icons/lucide/chevron-left'
import IconChevronRight from '~icons/lucide/chevron-right'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CalendarDay, CalendarEvent } from './types'
import { formatEventTime, formatMonthEventTime, isAllDayEvent, isRangeEvent } from './todoDisplay'

type CalendarViewMode = 'month' | 'week'
type MonthRangeDisplayMode = 'daily' | 'bar'
type TimelineSlot = {
  key: string
  label: string
  hour?: number
  isGap?: boolean
}
type MonthRangeSegment = {
  key: string
  event: CalendarEvent
  row: number
  startColumn: number
  endColumn: number
  lane: number
  isStart: boolean
  isEnd: boolean
  showTitle: boolean
}

const props = defineProps<{
  days: CalendarDay[]
  selectedDate: string
  monthLabel: string
  weekLabel: string
  viewMode: CalendarViewMode
  todayDate: string
  todayEvents: CalendarEvent[]
  showTodayBubble: boolean
  isSyncingCalendar?: boolean
}>()

const emit = defineEmits<{
  select: [date: string, time?: string]
  previousPeriod: []
  nextPeriod: []
  calendarInteraction: []
  closeTodayBubble: []
  quickCreateTodo: [prompt: string, date: string]
  syncCalendar: []
  openAgentCenter: []
  'update:viewMode': [mode: CalendarViewMode]
}>()

const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const dateWeekdays = ['日', '一', '二', '三', '四', '五', '六']
const timelineEventLimit = 1
const monthEventLimit = 2
const displayLabel = computed(() => (props.viewMode === 'week' ? props.weekLabel : props.monthLabel))
const periodActionLabel = computed(() => (props.viewMode === 'week' ? '周' : '月'))
const weekTimelineDays = computed(() => props.days)
const todayQuickInput = ref('')
const hasTodayQuickInput = computed(() => Boolean(todayQuickInput.value.trim()))
const headerQuickInput = ref('')
const hasHeaderQuickInput = computed(() => Boolean(headerQuickInput.value.trim()))
const monthRangeDisplayMode = ref<MonthRangeDisplayMode>('daily')
const timelineSlots = computed<TimelineSlot[]>(() => {
  const hours = new Set([9, 10, 11, 16])

  for (const day of weekTimelineDays.value) {
    for (const event of day.events) {
      if (isAllDayEvent(event)) continue
      const hour = eventHour(event.time)
      if (hour >= 0) hours.add(hour)
    }
  }

  return [...hours].sort((a, b) => a - b).reduce<TimelineSlot[]>((slots, hour, index, sortedHours) => {
    const previous = sortedHours[index - 1]
    if (index > 0 && hour - previous > 1) {
      slots.push({ key: `gap-${previous}-${hour}`, label: '...', isGap: true })
    }

    slots.push({ key: String(hour), label: `${String(hour).padStart(2, '0')}:00`, hour })
    return slots
  }, [])
})

const monthRangeSegments = computed<MonthRangeSegment[]>(() => {
  const rangeEvents = new Map<string, CalendarEvent>()

  for (const day of props.days) {
    for (const event of day.events) {
      if (isRangeEvent(event) && !rangeEvents.has(event.id)) {
        rangeEvents.set(event.id, event)
      }
    }
  }

  const lanesByRow: Array<Array<Array<{ start: number; end: number }>>> = Array.from(
    { length: 6 },
    () => [],
  )
  const segments: MonthRangeSegment[] = []

  ;[...rangeEvents.values()]
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
    .forEach((event) => {
      const eventEndDate = event.endDate ?? event.date

      for (let row = 0; row < 6; row += 1) {
        let startColumn = -1
        let endColumn = -1

        for (let column = 0; column < 7; column += 1) {
          const day = props.days[row * 7 + column]
          if (!day || day.date < event.date || day.date > eventEndDate) continue

          if (startColumn < 0) startColumn = column
          endColumn = column
        }

        if (startColumn < 0) continue

        const rowLanes = lanesByRow[row]
        let lane = 0
        while (
          rowLanes[lane]?.some(({ start, end }) => !(endColumn < start || startColumn > end))
        ) {
          lane += 1
        }

        if (!rowLanes[lane]) rowLanes[lane] = []
        rowLanes[lane].push({ start: startColumn, end: endColumn })

        for (let column = startColumn; column <= endColumn; column += 1) {
          const day = props.days[row * 7 + column]
          if (!day) continue

          segments.push({
            key: `${event.id}-${row}-${column}`,
            event,
            row: row + 1,
            startColumn: column + 1,
            endColumn: column + 1,
            lane,
            isStart: day.date === event.date,
            isEnd: day.date === eventEndDate,
            showTitle: column === startColumn,
          })
        }
      }
    })

  return segments
})

const monthRangeLaneCounts = computed(() => {
  const counts = new Map<string, number>()

  for (const segment of monthRangeSegments.value) {
    for (let column = segment.startColumn; column <= segment.endColumn; column += 1) {
      const day = props.days[(segment.row - 1) * 7 + (column - 1)]
      if (!day) continue

      counts.set(day.date, Math.max(counts.get(day.date) ?? 0, segment.lane + 1))
    }
  }

  return counts
})

function weekdayText(date: string) {
  return dateWeekdays[new Date(`${date}T12:00:00`).getDay()]
}

function eventHour(time?: string) {
  const hour = Number.parseInt(time?.slice(0, 2) ?? '', 10)
  return Number.isFinite(hour) ? hour : -1
}

function timelineEvents(day: CalendarDay, slot: TimelineSlot) {
  if (slot.isGap || slot.hour === undefined) return []
  return day.events.filter((event) => !isAllDayEvent(event) && eventHour(event.time) === slot.hour)
}

function allDayEvents(day: CalendarDay) {
  return day.events.filter(isAllDayEvent)
}

function visibleTimelineEvents(day: CalendarDay, slot: TimelineSlot) {
  return timelineEvents(day, slot).slice(0, timelineEventLimit)
}

function hiddenTimelineEventCount(day: CalendarDay, slot: TimelineSlot) {
  return Math.max(timelineEvents(day, slot).length - timelineEventLimit, 0)
}

function monthInlineEvents(day: CalendarDay) {
  if (monthRangeDisplayMode.value === 'daily') return day.events
  return day.events.filter((event) => !isRangeEvent(event))
}

function visibleMonthEvents(day: CalendarDay) {
  return monthInlineEvents(day).slice(0, monthEventLimit)
}

function hiddenMonthEventCount(day: CalendarDay) {
  return Math.max(monthInlineEvents(day).length - monthEventLimit, 0)
}

function monthRangeLaneCount(date: string) {
  if (monthRangeDisplayMode.value === 'daily') return 0
  return monthRangeLaneCounts.value.get(date) ?? 0
}

function toggleMonthRangeDisplayMode() {
  monthRangeDisplayMode.value = monthRangeDisplayMode.value === 'daily' ? 'bar' : 'daily'
}

function shouldOpenBubbleLeft(index: number) {
  return index % 7 >= 4
}

function shouldOpenBubbleUp(index: number) {
  return Math.floor(index / 7) >= 4
}

function selectDay(day: CalendarDay) {
  emit('select', day.date)
}

function timelineSlotTime(slot: TimelineSlot) {
  if (slot.hour === undefined || slot.isGap) return undefined
  return `${String(slot.hour).padStart(2, '0')}:00`
}

function selectTimelineCell(day: CalendarDay, slot: TimelineSlot) {
  emit('select', day.date, timelineSlotTime(slot))
}

function quickCreateToday() {
  const prompt = todayQuickInput.value.trim()
  if (!prompt) return

  emit('quickCreateTodo', prompt, props.todayDate)
  todayQuickInput.value = ''
}

function quickCreateFromHeader() {
  const prompt = headerQuickInput.value.trim()
  if (!prompt) return

  emit('quickCreateTodo', prompt, props.selectedDate)
  headerQuickInput.value = ''
}
</script>

<template>
  <section
    class="calendar-board"
    :class="{ 'is-week-mode': viewMode === 'week' }"
    @pointerdown="emit('calendarInteraction')"
  >
    <header class="calendar-head">
      <div class="calendar-title-line">
        <h2>{{ displayLabel }}</h2>
      </div>
      <div class="calendar-head-main">
        <form
          class="calendar-quick-create"
          :class="{ 'has-value': hasHeaderQuickInput }"
          aria-label="一句话创建待办"
          @submit.prevent="quickCreateFromHeader"
        >
          <Input v-model="headerQuickInput" type="text" placeholder="一句话创建待办..." />
          <Button v-if="hasHeaderQuickInput" type="submit">AI解析</Button>
        </form>
     
      </div>
      <div class="calendar-controls">
        <button
          type="button"
          class="calendar-sync-btn"
          :disabled="isSyncingCalendar"
          aria-label="同步邮箱日程"
          @click="emit('syncCalendar')"
        >
          {{ isSyncingCalendar ? '同步中…' : '同步' }}
        </button>
        <button
          v-if="viewMode === 'month'"
          type="button"
          class="range-style-toggle"
          @click="toggleMonthRangeDisplayMode"
        >
          跨天：{{ monthRangeDisplayMode === 'daily' ? '每日' : '横条' }}
        </button>
        <div class="view-switch" aria-label="日历视图切换">
          <button
            type="button"
            :class="{ active: viewMode === 'month' }"
            @click="emit('update:viewMode', 'month')"
          >
            月
          </button>
          <button
            type="button"
            :class="{ active: viewMode === 'week' }"
            @click="emit('update:viewMode', 'week')"
          >
            周
          </button>
        </div>
        <div class="month-actions" :aria-label="`${periodActionLabel}切换`">
          <button type="button" :aria-label="`上一${periodActionLabel}`" @click="emit('previousPeriod')">
            <IconChevronLeft aria-hidden="true" />
          </button>
          <button type="button" :aria-label="`下一${periodActionLabel}`" @click="emit('nextPeriod')">
            <IconChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>

    <div class="weekdays">
      <span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span>
    </div>

    <div v-if="viewMode === 'week'" class="week-timeline">
      <div class="timeline-grid">
        <span class="timeline-axis-head"></span>
        <button
          v-for="day in weekTimelineDays"
          :key="`head-${day.date}`"
          class="timeline-day-head"
          :class="{ 'is-selected': day.date === selectedDate, 'is-today': day.isToday }"
          type="button"
          @click="emit('select', day.date)"
        >
          <span>周{{ weekdayText(day.date) }}</span>
          <b>{{ day.day }}</b>
        </button>

        <span class="timeline-time timeline-all-day-label">全天</span>
        <button
          v-for="day in weekTimelineDays"
          :key="`all-day-${day.date}`"
          class="timeline-cell timeline-all-day-cell"
          :class="{ 'is-selected': day.date === selectedDate }"
          type="button"
          @click="emit('select', day.date)"
        >
          <span
            v-for="event in allDayEvents(day)"
            :key="event.id"
            class="timeline-event timeline-all-day-event"
            :class="[`type-${event.type}`, { 'is-range': isRangeEvent(event) }]"
          >
            <i></i>
            <time>{{ formatEventTime(event) }}</time>
            <b>{{ event.title }}</b>
          </span>
        </button>

        <template v-for="slot in timelineSlots" :key="slot.key">
          <span class="timeline-time" :class="{ 'is-gap': slot.isGap }">{{ slot.label }}</span>
          <button
            v-for="day in weekTimelineDays"
            :key="`${slot.key}-${day.date}`"
            class="timeline-cell"
            :class="{ 'is-selected': day.date === selectedDate, 'is-gap': slot.isGap }"
            type="button"
            @click="selectTimelineCell(day, slot)"
          >
            <span
              v-for="event in visibleTimelineEvents(day, slot)"
              :key="event.id"
              class="timeline-event"
              :class="`type-${event.type}`"
            >
              <i></i>
              <time>{{ formatEventTime(event) }}</time>
              <b>{{ event.title }}</b>
            </span>
            <span v-if="hiddenTimelineEventCount(day, slot) > 0" class="timeline-more">
              +{{ hiddenTimelineEventCount(day, slot) }}
            </span>
          </button>
        </template>
      </div>
    </div>

    <div v-else class="month-grid">
      <div
        v-for="(day, index) in days"
        :key="day.date"
        class="day-cell"
        :class="{
          'is-muted': !day.inMonth,
          'is-today': day.isToday,
          'is-selected': day.date === selectedDate,
          'has-events': day.events.length > 0,
          'has-range-events': monthRangeLaneCount(day.date) > 0,
          'has-today-bubble': day.isToday && showTodayBubble,
          'is-bubble-left': day.isToday && shouldOpenBubbleLeft(index),
          'is-bubble-up': day.isToday && shouldOpenBubbleUp(index),
        }"
        :style="{ '--range-lanes': monthRangeLaneCount(day.date) }"
      >
        <button class="day-cell-main" type="button" @click="selectDay(day)">
          <span class="day-cell-head">
            <span class="date-stack">
              <span class="day-number">{{ day.day }}</span>
              <span v-if="day.isToday" class="today-label">今天</span>
            </span>
            <span class="special-list">
              <span v-if="day.events.length" class="event-count-dot">{{ day.events.length }}</span>
              <span
                v-for="item in day.specialDays.slice(0, 2)"
                :key="`${item.type}-${item.name}`"
                class="special-tag"
                :class="`special-${item.type}`"
              >
                {{ item.type === 'holiday' ? '休' : item.type === 'workday' ? '班' : item.name }}
              </span>
            </span>
          </span>
          <span class="event-stack">
            <span
              v-for="event in visibleMonthEvents(day)"
              :key="event.id"
              class="month-event"
              :class="[
                `type-${event.type}`,
                `status-${event.status}`,
                { 'is-range': monthRangeDisplayMode === 'daily' && isRangeEvent(event) },
              ]"
              :aria-label="`${formatEventTime(event)} ${event.title}`"
            >
              <i></i>
              <time v-if="!isRangeEvent(event)">{{ formatMonthEventTime(event) }}</time>
              <b>{{ event.title }}</b>
            </span>
            <span
              v-if="hiddenMonthEventCount(day)"
              class="more-count"
              :aria-label="`还有 ${hiddenMonthEventCount(day)} 项待办，点击查看当天详情`"
              :title="`还有 ${hiddenMonthEventCount(day)} 项待办`"
            >
              +{{ hiddenMonthEventCount(day) }}
            </span>
          </span>
        </button>

        <section
          v-if="day.isToday && showTodayBubble"
          class="today-bubble"
          @click.stop
          @pointerdown.stop
        >
          <header>
            <div>
              <strong>今日待办</strong>
              <span>{{ todayDate.split('-').join('/') }}</span>
            </div>
            <button type="button" aria-label="关闭今日待办气泡" @click="emit('closeTodayBubble')">×</button>
          </header>
          <div class="today-bubble-list">
            <button
              v-for="event in todayEvents"
              :key="event.id"
              class="today-bubble-item"
              type="button"
              @click="emit('select', todayDate)"
            >
              <time>{{ formatEventTime(event) }}</time>
              <span>{{ event.title }}</span>
            </button>
            <div v-if="!todayEvents.length" class="today-bubble-empty">
              <p>今日暂无待办</p>
            </div>
          </div>
          <form
            class="today-quick-create"
            :class="{ 'has-value': hasTodayQuickInput }"
            @submit.prevent="quickCreateToday"
          >
            <Input v-model="todayQuickInput" type="text" placeholder="一句话创建待办..." />
            <Button v-if="hasTodayQuickInput" type="submit">AI解析</Button>
          </form>
        </section>
      </div>

      <div v-if="monthRangeDisplayMode === 'bar'" class="month-range-layer" aria-hidden="true">
        <span
          v-for="segment in monthRangeSegments"
          :key="segment.key"
          class="month-range-bar"
          :class="[
            `type-${segment.event.type}`,
            `status-${segment.event.status}`,
            {
              'is-range-start': segment.isStart,
              'is-range-end': segment.isEnd,
            },
          ]"
          :style="{
            gridColumn: `${segment.startColumn} / ${segment.endColumn + 1}`,
            gridRow: `${segment.row}`,
            '--range-lane': segment.lane,
          }"
        >
          <i v-if="segment.showTitle"></i>
          <b v-if="segment.showTitle">{{ segment.event.title }}</b>
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.calendar-board {
  min-height: 0;
  height: 100%;
  box-sizing: border-box;
  padding: 18px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 18px 48px -28px rgba(15, 23, 42, 0.28);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.calendar-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.calendar-title-line {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  flex: 0 0 auto;
}

.eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  color: #6b7280;
}

h2 {
  margin: 0;
  font-size: 22px;
  line-height: 1.1;
  color: #111827;
}

.calendar-head-main {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 auto;
  min-width: 0;
}

.calendar-controls {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
}

.calendar-quick-create {
  position: relative;
  flex: 1 1 auto;
  max-width: 260px;
  min-width: 160px;
  min-height: 34px;
}

.calendar-quick-create input {
  width: 100%;
  height: 34px;
  box-sizing: border-box;
  border: 1px solid #e5edf6;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  color: #111827;
  padding: 0 14px;
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  outline: none;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    padding 0.18s ease;
}

.calendar-quick-create input::placeholder {
  color: #94a3b8;
  font-weight: 800;
}

.calendar-quick-create input:focus {
  border-color: rgba(96, 165, 250, 0.9);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.calendar-quick-create.has-value input {
  padding-right: 82px;
}

.calendar-quick-create button {
  position: absolute;
  top: 4px;
  right: 4px;
  height: 26px;
  border: 0;
  border-radius: 999px;
  background: #2563eb;
  color: #ffffff;
  padding: 0 11px;
  font: inherit;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 10px 20px -16px rgba(37, 99, 235, 0.86);
  transition:
    background 0.18s ease,
    transform 0.18s ease;
}

.calendar-quick-create button:hover {
  background: #1d4ed8;
  transform: translateY(-1px);
}

.calendar-sync-btn {
  flex: 0 0 auto;
  min-height: 34px;
  border: 1px solid #e5edf6;
  border-radius: 999px;
  background: #ffffff;
  color: #475569;
  padding: 0 13px;
  font: inherit;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease,
    opacity 0.18s ease;
}

.calendar-sync-btn:hover:not(:disabled) {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
  box-shadow: 0 12px 20px -20px rgba(37, 99, 235, 0.5);
}

.calendar-sync-btn:disabled {
  opacity: 0.72;
  cursor: default;
}

.range-style-toggle {
  min-height: 30px;
  border: 1px solid #e5edf6;
  border-radius: 999px;
  background: #ffffff;
  color: #475569;
  padding: 0 11px;
  font: inherit;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}

.range-style-toggle:hover {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
  box-shadow: 0 12px 20px -20px rgba(37, 99, 235, 0.5);
}

.view-switch {
  padding: 3px;
  border: 1px solid #e5edf6;
  border-radius: 999px;
  background: #f8fafc;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.view-switch button {
  min-width: 34px;
  height: 26px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #64748b;
  font: inherit;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}

.view-switch button.active {
  background: #111827;
  color: #ffffff;
  box-shadow: 0 10px 18px -16px rgba(15, 23, 42, 0.8);
}

.month-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.month-actions button {
  width: 30px;
  height: 30px;
  border: 1px solid #e5edf6;
  border-radius: 999px;
  background: #ffffff;
  color: #475569;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font: inherit;
  line-height: 0;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease;
}

.month-actions button svg {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
}

.month-actions button:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
  color: #111827;
}

.weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}

.weekdays span {
  color: #9ca3af;
  font-size: 12px;
  font-weight: 800;
  text-align: center;
}

.calendar-board.is-week-mode .weekdays {
  display: none;
}

.calendar-board.is-week-mode {
  justify-content: flex-start;
}

.week-timeline {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.timeline-grid {
  height: 100%;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  border-radius: 14px;
  background: rgba(226, 232, 240, 0.5);
  padding: 3px;
  display: grid;
  grid-template-columns: 54px repeat(7, minmax(0, 1fr));
  grid-auto-rows: minmax(0, 1fr);
  gap: 3px;
  overflow: hidden;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 18px 34px -34px rgba(15, 23, 42, 0.5);
}

.timeline-axis-head,
.timeline-day-head,
.timeline-time,
.timeline-cell {
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
}

.timeline-axis-head,
.timeline-day-head {
  background: rgba(248, 250, 252, 0.9);
  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.78);
}

.timeline-day-head {
  border: 0;
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.86);
  color: #64748b;
  padding: 6px 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font: inherit;
  cursor: pointer;
}

.timeline-day-head span {
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}

.timeline-day-head b {
  width: 21px;
  height: 21px;
  border-radius: 8px;
  color: #111827;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 950;
  line-height: 1;
}

.timeline-day-head.is-today b,
.timeline-day-head.is-selected b {
  background: #111827;
  color: #ffffff;
}

.timeline-day-head.is-selected {
  background: rgba(239, 246, 255, 0.92);
  box-shadow:
    inset 0 0 0 1px rgba(147, 197, 253, 0.45),
    0 10px 20px -20px rgba(37, 99, 235, 0.56);
}

.timeline-time {
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.62);
  color: #64748b;
  padding: 8px 6px 0 0;
  text-align: right;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.timeline-time.is-gap {
  color: #94a3b8;
  font-size: 16px;
  letter-spacing: 0;
}

.timeline-cell {
  position: relative;
  border: 0;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.62);
  padding: 5px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-direction: row;
  gap: 4px;
  overflow: hidden;
  cursor: pointer;
  transition:
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.timeline-cell:hover {
  background: rgba(239, 246, 255, 0.56);
  box-shadow: inset 0 0 0 1px rgba(147, 197, 253, 0.28);
}

.timeline-cell.is-selected {
  background: rgba(239, 246, 255, 0.5);
  box-shadow: inset 0 0 0 1px rgba(147, 197, 253, 0.3);
}

.timeline-cell.is-gap {
  background: rgba(248, 250, 252, 0.42);
}

.timeline-all-day-label {
  padding-top: 9px;
  color: #2563eb;
}

.timeline-all-day-cell {
  align-items: flex-start;
  flex-direction: column;
}

.timeline-event {
  flex: 1 1 auto;
  max-width: 100%;
  min-width: 0;
  min-height: 22px;
  box-sizing: border-box;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  padding: 0 6px;
  color: #334155;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  box-shadow: 0 10px 18px -18px rgba(15, 23, 42, 0.24);
}

.timeline-event i {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: currentColor;
  flex: 0 0 auto;
}

.timeline-event time {
  color: currentColor;
  font-size: 10px;
  font-weight: 950;
  line-height: 1;
  white-space: nowrap;
}

.timeline-event b {
  min-width: 0;
  overflow: hidden;
  color: #334155;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  font-weight: 850;
  line-height: 1;
}

.timeline-event.is-range,
.timeline-all-day-event {
  border-radius: 9px;
  background: rgba(239, 246, 255, 0.94);
}

.timeline-more {
  width: fit-content;
  min-height: 20px;
  border-radius: 999px;
  background: rgba(238, 242, 255, 0.92);
  color: #4338ca;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-weight: 950;
  line-height: 1;
  box-shadow: 0 8px 16px -16px rgba(67, 56, 202, 0.55);
  flex: 0 0 auto;
}

.timeline-event.type-meeting { color: #2563eb; }
.timeline-event.type-task { color: #059669; }
.timeline-event.type-approval { color: #d97706; }
.timeline-event.type-ai { color: #7c3aed; }

.month-grid {
  position: relative;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-template-rows: repeat(6, minmax(0, 1fr));
  gap: 6px;
}

.day-cell {
  position: relative;
  z-index: 1;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  border: 1px solid #eef2f7;
  border-radius: 12px;
  background: rgba(249, 250, 251, 0.54);
  color: #111827;
  padding: 7px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.day-cell-main {
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  text-align: left;
  font: inherit;
  cursor: pointer;
}

.day-cell:hover {
  transform: translateY(-2px);
  border-color: #dbeafe;
  box-shadow: 0 14px 24px -22px rgba(37, 99, 235, 0.5);
}

.day-cell.has-today-bubble {
  z-index: 40;
}

.day-cell.has-today-bubble:hover {
  transform: none;
}

.day-cell.has-events {
  border-color: rgba(191, 219, 254, 0.82);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
}

.day-cell.is-muted {
  border-color: rgba(241, 245, 249, 0.68);
  background: rgba(248, 250, 252, 0.22);
  color: #d4dce8;
  box-shadow: none;
}

.day-cell.is-muted.has-events {
  border-color: rgba(219, 234, 254, 0.46);
  background: rgba(248, 250, 252, 0.42);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.46);
}

.day-cell.is-muted:hover {
  border-color: rgba(219, 234, 254, 0.58);
  background: rgba(248, 250, 252, 0.48);
}

.day-cell.is-muted .day-number {
  color: #cbd5e1;
  font-weight: 760;
}

.day-cell.is-muted .event-count-dot {
  background: rgba(219, 234, 254, 0.54);
  color: #5b7fc7;
}

.day-cell.is-muted .month-event {
  border-color: rgba(226, 232, 240, 0.44);
  background: rgba(255, 255, 255, 0.42);
  color: #94a3b8;
  box-shadow: none;
}

.day-cell.is-muted .month-event b,
.day-cell.is-muted .month-event time {
  color: #94a3b8;
}

.day-cell.is-muted .more-count {
  background: rgba(238, 242, 255, 0.5);
  color: #818cf8;
}

.day-cell.is-selected {
  border-color: rgba(15, 23, 42, 0.72);
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    inset 0 0 0 1px rgba(15, 23, 42, 0.2),
    0 12px 24px -24px rgba(15, 23, 42, 0.34);
}

.day-cell.is-today {
  border-color: rgba(96, 165, 250, 0.58);
  background: rgba(239, 246, 255, 0.86);
}

.day-cell.is-selected.is-today {
  border-color: rgba(15, 23, 42, 0.76);
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.88), rgba(255, 255, 255, 0.9));
  box-shadow:
    inset 0 0 0 1px rgba(15, 23, 42, 0.22),
    0 12px 26px -24px rgba(15, 23, 42, 0.36);
}

.day-cell.is-today .day-number {
  background: #2563eb;
  color: #ffffff;
}

.day-cell-head {
  min-height: 22px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
}

.date-stack {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.day-number {
  width: 22px;
  height: 22px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
}

.today-label {
  min-height: 18px;
  border-radius: 999px;
  background: rgba(219, 234, 254, 0.92);
  color: #1d4ed8;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}

.special-list {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  flex: 1;
}

.event-count-dot {
  min-width: 18px;
  height: 18px;
  box-sizing: border-box;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 950;
  line-height: 1;
}

.special-tag {
  min-width: 20px;
  height: 18px;
  border-radius: 999px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}

.special-holiday {
  background: #fee2e2;
  color: #b91c1c;
}

.special-workday {
  background: #e5e7eb;
  color: #4b5563;
}

.special-solar-term {
  background: #ccfbf1;
  color: #0f766e;
}

.event-stack {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  justify-content: flex-start;
  overflow: hidden;
}

.day-cell.has-range-events .event-stack {
  padding-top: calc(var(--range-lanes, 1) * 26px);
}

.month-event,
.more-count {
  max-width: 100%;
  border-radius: 999px;
  overflow: hidden;
}

.month-event {
  min-height: 30px;
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(226, 232, 240, 0.78);
  background: rgba(255, 255, 255, 0.74);
  padding: 3px 5px;
  display: inline-flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 2px 4px;
  min-width: 0;
  box-shadow: 0 8px 15px -15px rgba(15, 23, 42, 0.28);
}

.month-event i {
  width: 4px;
  height: 4px;
  margin-top: 4px;
  border-radius: 999px;
  background: currentColor;
  flex: 0 0 auto;
}

.month-event time {
  color: currentColor;
  font-size: 9px;
  font-weight: 950;
  line-height: 1;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  order: 1;
}

.month-event b {
  flex: 0 0 calc(100% - 8px);
  min-width: 0;
  margin-left: 8px;
  overflow: hidden;
  color: #334155;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 9px;
  font-weight: 850;
  line-height: 1;
  order: 2;
}

.month-event.is-range {
  min-height: 24px;
  border-color: rgba(226, 232, 240, 0.88);
  background: rgba(255, 255, 255, 0.74);
  color: #94a3b8;
  padding: 4px 7px;
  align-items: center;
  flex-wrap: nowrap;
  gap: 5px;
  box-shadow: none;
}

.month-event.is-range i {
  width: 4px;
  height: 4px;
  margin-top: 0;
}

.month-event.is-range b {
  flex: 1 1 auto;
  margin-left: 0;
  color: #475569;
  font-size: 9px;
  font-weight: 850;
  line-height: 1;
  order: 0;
}

.month-event.status-done {
  opacity: 0.62;
}

.month-event.status-done b {
  color: #64748b;
  text-decoration: line-through;
}

.month-range-layer {
  position: absolute;
  z-index: 6;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-template-rows: repeat(6, minmax(0, 1fr));
  gap: 6px;
  pointer-events: none;
}

.month-range-bar {
  min-width: 0;
  height: 22px;
  box-sizing: border-box;
  align-self: start;
  margin: calc(34px + var(--range-lane, 0) * 25px) 0 0;
  border-radius: 0;
  background: linear-gradient(90deg, rgba(221, 232, 255, 0.98), rgba(213, 226, 255, 0.96));
  color: #7c3aed;
  padding: 0 9px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  overflow: hidden;
  box-shadow:
    inset 0 0 0 1px rgba(124, 58, 237, 0.1),
    0 8px 16px -18px rgba(79, 70, 229, 0.52);
}

.month-range-bar.is-range-start {
  margin-left: 8px;
  border-top-left-radius: 999px;
  border-bottom-left-radius: 999px;
}

.month-range-bar.is-range-end {
  margin-right: 8px;
  border-top-right-radius: 999px;
  border-bottom-right-radius: 999px;
}

.month-range-bar i {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: currentColor;
  flex: 0 0 auto;
}

.month-range-bar b {
  min-width: 0;
  overflow: hidden;
  color: #334155;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
}

.month-range-bar.status-done {
  opacity: 0.64;
}

.more-count {
  width: fit-content;
  min-width: 30px;
  height: 20px;
  min-height: 20px;
  border-radius: 999px;
  background: rgba(238, 242, 255, 0.82);
  color: #6366f1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 950;
  line-height: 1;
  white-space: nowrap;
}

.type-meeting { color: #1d4ed8; }
.type-task { color: #047857; }
.type-approval { color: #b45309; }
.type-ai { color: #6d28d9; }

.month-event.type-meeting { color: #2563eb; }
.month-event.type-task { color: #059669; }
.month-event.type-approval { color: #d97706; }
.month-event.type-ai { color: #7c3aed; }

.today-bubble {
  position: absolute;
  z-index: 30;
  top: -8px;
  left: calc(100% + 10px);
  width: 280px;
  max-height: min(400px, calc(100vh - 150px));
  box-sizing: border-box;
  border: 1px solid rgba(203, 213, 225, 0.9);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(249, 250, 251, 0.96)),
    #ffffff;
  box-shadow:
    0 0 0 10px rgba(148, 163, 184, 0.05),
    0 0 34px 8px rgba(100, 116, 139, 0.14),
    0 34px 72px -34px rgba(15, 23, 42, 0.34),
    0 18px 32px -24px rgba(15, 23, 42, 0.24),
    0 2px 6px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.98),
    inset 0 -1px 0 rgba(226, 232, 240, 0.52);
  padding: 14px 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 11px;
  cursor: default;
  backdrop-filter: blur(14px);
  isolation: isolate;
  overflow: visible;
}

.day-cell.is-bubble-left .today-bubble {
  right: calc(100% + 10px);
  left: auto;
}

.day-cell.is-bubble-up .today-bubble {
  top: auto;
  bottom: -8px;
}

.today-bubble::before {
  position: absolute;
  top: 31px;
  left: -6px;
  width: 12px;
  height: 12px;
  border-left: 1px solid rgba(203, 213, 225, 0.86);
  border-bottom: 1px solid rgba(203, 213, 225, 0.86);
  border-radius: 3px 0 0 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(249, 250, 251, 0.96));
  content: '';
  transform: rotate(45deg);
  z-index: 1;
  box-shadow: -5px 5px 12px -12px rgba(15, 23, 42, 0.4);
}

.day-cell.is-bubble-up .today-bubble::before {
  top: auto;
  bottom: 31px;
  border-radius: 0 0 0 3px;
  box-shadow: -5px 5px 12px -12px rgba(15, 23, 42, 0.4);
}

.today-bubble::after {
  position: absolute;
  inset: -14px;
  z-index: -1;
  border-radius: 26px;
  background:
    radial-gradient(circle at 32% 32%, rgba(100, 116, 139, 0.12), transparent 58%),
    radial-gradient(circle at 70% 74%, rgba(148, 163, 184, 0.1), transparent 62%);
  content: '';
  pointer-events: none;
}

.day-cell.is-bubble-left .today-bubble::before {
  right: -6px;
  left: auto;
  border: 0;
  border-top: 1px solid rgba(203, 213, 225, 0.86);
  border-right: 1px solid rgba(203, 213, 225, 0.86);
  border-radius: 0 3px 0 0;
}

.today-bubble header {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.today-bubble header div {
  min-width: 0;
  display: grid;
  gap: 7px;
}

.today-bubble header strong {
  color: #0f172a;
  font-size: 17px;
  line-height: 1.1;
  font-weight: 900;
}

.today-bubble header span {
  width: fit-content;
  min-height: 21px;
  border-radius: 999px;
  background: rgba(241, 245, 249, 0.92);
  color: #475569;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  font-weight: 900;
}

.today-bubble header button {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 999px;
  background: rgba(241, 245, 249, 0.82);
  color: #64748b;
  font: inherit;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.today-bubble header button:hover {
  background: #e5e7eb;
  color: #111827;
  transform: translateY(-1px);
}

.today-bubble-list {
  min-height: 84px;
  flex: 1 1 auto;
  max-height: none;
  overflow: auto;
  display: grid;
  align-content: start;
  gap: 0;
  border: 1px solid rgba(226, 232, 240, 0.68);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.62);
  overscroll-behavior: contain;
}

.today-bubble-item {
  position: relative;
  min-width: 0;
  border: 0;
  border-bottom: 1px solid rgba(226, 232, 240, 0.58);
  border-radius: 0;
  background: transparent;
  color: #334155;
  padding: 10px 11px 10px 25px;
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease;
}

.today-bubble-item:last-child {
  border-bottom: 0;
}

.today-bubble-item:hover {
  background: rgba(239, 246, 255, 0.7);
}

.today-bubble-item::before {
  position: absolute;
  left: 12px;
  top: 50%;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: #94a3b8;
  content: '';
  transform: translateY(-50%);
}

.today-bubble-item time {
  color: #475569;
  font-size: 11px;
  font-weight: 950;
  font-variant-numeric: tabular-nums;
}

.today-bubble-item span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 900;
}

.today-bubble-empty {
  margin: 0;
  min-height: 74px;
  border: 1px dashed rgba(147, 197, 253, 0.62);
  border-radius: 14px;
  background:
    linear-gradient(135deg, rgba(239, 246, 255, 0.72), rgba(255, 255, 255, 0.52)),
    #ffffff;
  color: #64748b;
  padding: 0 14px;
  display: grid;
  place-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 850;
  text-align: center;
}

.today-bubble-empty p {
  margin: 0;
  max-width: 210px;
  line-height: 1.45;
}

.today-quick-create {
  position: relative;
  flex: 0 0 auto;
  min-height: 42px;
}

.today-quick-create input {
  width: 100%;
  height: 42px;
  box-sizing: border-box;
  border: 1px solid rgba(203, 213, 225, 0.72);
  border-radius: 999px;
  background: #ffffff;
  padding: 0 16px;
  color: #111827;
  font: inherit;
  font-size: 12px;
  outline: none;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    padding 0.18s ease;
}

.today-quick-create input:focus {
  border-color: rgba(96, 165, 250, 0.9);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.today-quick-create.has-value input {
  padding-right: 82px;
}

.today-quick-create button {
  position: absolute;
  top: 5px;
  right: 5px;
  height: 32px;
  border: 0;
  border-radius: 999px;
  background: #2563eb;
  color: #ffffff;
  padding: 0 12px;
  font: inherit;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 10px 20px -16px rgba(37, 99, 235, 0.86);
  transition:
    background 0.18s ease,
    transform 0.18s ease;
}

.today-quick-create button:hover {
  background: #1d4ed8;
  transform: translateY(-1px);
}

@media (max-width: 1180px) {
  .calendar-board {
    min-height: 520px;
  }
}

@media (max-width: 760px) {
  .calendar-board {
    padding: 16px;
  }

  .calendar-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .calendar-head-main {
    width: 100%;
  }

  .calendar-quick-create {
    width: 100%;
    max-width: none;
    min-width: 0;
  }

  .calendar-controls {
    width: 100%;
    justify-content: space-between;
  }

  .month-grid {
    grid-template-rows: repeat(6, minmax(76px, 1fr));
    gap: 6px;
  }

  .timeline-grid {
    grid-template-columns: 42px repeat(7, minmax(0, 1fr));
    gap: 2px;
    padding: 2px;
  }

  .timeline-day-head {
    flex-direction: column;
    gap: 3px;
    padding: 4px 2px;
  }

  .timeline-time {
    padding-right: 3px;
    font-size: 9px;
  }

  .timeline-cell {
    padding: 3px;
  }

  .timeline-event {
    min-height: 19px;
    padding: 0 4px;
  }

  .timeline-event time {
    display: none;
  }

  .timeline-more {
    min-height: 18px;
    padding: 0 5px;
  }

  .day-cell {
    min-height: 76px;
    padding: 7px;
  }

  .month-event {
    min-height: 20px;
    padding: 0 5px;
  }

  .month-event i {
    width: 4px;
    height: 4px;
  }

}
</style>
