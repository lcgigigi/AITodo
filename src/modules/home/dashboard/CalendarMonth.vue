<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import IconChevronLeft from '~icons/lucide/chevron-left'
import IconChevronRight from '~icons/lucide/chevron-right'
import type { CalendarDay, CalendarEvent } from './types'
import {
  compareCalendarRangeBarEvents,
  formatEventTime,
  getActiveCalendarDisplayEvents,
  getTodoStatusLabel,
  isAllDayEvent,
  isRangeEvent,
  isRejectedTodo,
} from './todoDisplay'

type CalendarViewMode = 'month' | 'week'
type MonthRangeDisplayMode = 'daily' | 'bar'
type WeekDaySlotKey = 'morning-early' | 'morning-late' | 'afternoon-early' | 'afternoon-late'
type WeekDaySlot = {
  key: WeekDaySlotKey
  events: CalendarEvent[]
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
}>()

const emit = defineEmits<{
  select: [date: string, time?: string]
  previousPeriod: []
  nextPeriod: []
  calendarInteraction: []
  quickCreateTodo: [prompt: string, date: string]
  openAgentCenter: []
  'update:viewMode': [mode: CalendarViewMode]
}>()

const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const dateWeekdays = ['日', '一', '二', '三', '四', '五', '六']
const monthEventLimit = 3
const weekSlotEventLimit = 2
const displayLabel = computed(() =>
  props.viewMode === 'week' ? props.weekLabel : props.monthLabel,
)
const periodActionLabel = computed(() => (props.viewMode === 'week' ? '周' : '月'))
const weekTimelineDays = computed(() => props.days)
const monthRangeDisplayMode = ref<MonthRangeDisplayMode>('daily')
const hoveredWeekDay = ref<string | null>(null)
const weekDayHoverDelayMs = 1000
let weekDayHoverTimer: ReturnType<typeof setTimeout> | null = null
const weekDaySlotDefs: WeekDaySlot[] = [
  { key: 'morning-early', events: [] },
  { key: 'morning-late', events: [] },
  { key: 'afternoon-early', events: [] },
  { key: 'afternoon-late', events: [] },
]

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
    .sort(compareCalendarRangeBarEvents)
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

function eventDaySlot(event: CalendarEvent): WeekDaySlotKey {
  if (isAllDayEvent(event)) return 'morning-early'

  const hour = Number.parseInt(event.time?.slice(0, 2) ?? '', 10)
  if (!Number.isFinite(hour)) return 'morning-early'
  if (hour < 10) return 'morning-early'
  if (hour < 12) return 'morning-late'
  if (hour < 15) return 'afternoon-early'
  return 'afternoon-late'
}

function weekEventTimeLabel(event: CalendarEvent) {
  if (isAllDayEvent(event)) return '全天'
  return event.time?.slice(0, 5) ?? ''
}

function weekDaySlots(day: CalendarDay): WeekDaySlot[] {
  const grouped = Object.fromEntries(
    weekDaySlotDefs.map((slot) => [slot.key, [] as CalendarEvent[]]),
  ) as Record<WeekDaySlotKey, CalendarEvent[]>

  for (const event of getActiveCalendarDisplayEvents(day.events)) {
    grouped[eventDaySlot(event)].push(event)
  }

  return weekDaySlotDefs.map((slot) => ({
    ...slot,
    events: grouped[slot.key],
  }))
}

function visibleWeekSlotEvents(slot: WeekDaySlot) {
  return slot.events.slice(0, weekSlotEventLimit)
}

function hiddenWeekSlotEventCount(slot: WeekDaySlot) {
  return Math.max(slot.events.length - weekSlotEventLimit, 0)
}

function clearWeekDayHoverTimer() {
  if (!weekDayHoverTimer) return
  clearTimeout(weekDayHoverTimer)
  weekDayHoverTimer = null
}

function scheduleWeekDayHovered(date: string) {
  if (hoveredWeekDay.value === date) return

  clearWeekDayHoverTimer()
  weekDayHoverTimer = setTimeout(() => {
    hoveredWeekDay.value = date
    weekDayHoverTimer = null
  }, weekDayHoverDelayMs)
}

function clearWeekDayHovered() {
  clearWeekDayHoverTimer()
  hoveredWeekDay.value = null
}

function isWeekDayHovered(date: string) {
  return hoveredWeekDay.value === date
}

function weekSlotEventsForDisplay(slot: WeekDaySlot, dayDate: string) {
  if (isWeekDayHovered(dayDate)) return slot.events
  return visibleWeekSlotEvents(slot)
}

function shouldShowWeekSlotMore(slot: WeekDaySlot, dayDate: string) {
  if (isWeekDayHovered(dayDate)) return false
  return hiddenWeekSlotEventCount(slot) > 0
}

function monthInlineEvents(day: CalendarDay) {
  const events = getActiveCalendarDisplayEvents(day.events)
  if (monthRangeDisplayMode.value === 'daily') return events
  return events.filter((event) => !isRangeEvent(event))
}

function monthTotalEventCount(day: CalendarDay) {
  return day.events.length
}

function visibleMonthEvents(day: CalendarDay) {
  return monthInlineEvents(day).slice(0, monthEventLimit)
}

function monthRangeLaneCount(date: string) {
  if (monthRangeDisplayMode.value === 'daily') return 0
  return monthRangeLaneCounts.value.get(date) ?? 0
}

function toggleMonthRangeDisplayMode() {
  monthRangeDisplayMode.value = monthRangeDisplayMode.value === 'daily' ? 'bar' : 'daily'
}

function selectDay(day: CalendarDay) {
  emit('select', day.date)
}

function selectWeekDaySlot(day: CalendarDay) {
  emit('select', day.date)
}

function selectWeekDayEvent(day: CalendarDay, event: CalendarEvent) {
  const time = event.time?.trim().slice(0, 5)
  emit('select', day.date, time || undefined)
}

function timelineEventLabel(event: CalendarEvent) {
  const title = event.title?.trim()
  if (title) return title

  const content = event.content?.trim()
  if (content) return content

  return '未命名待办'
}

onUnmounted(() => {
  clearWeekDayHoverTimer()
})
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
      <div class="calendar-controls">
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
          <button
            type="button"
            :aria-label="`上一${periodActionLabel}`"
            @click="emit('previousPeriod')"
          >
            <IconChevronLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            :aria-label="`下一${periodActionLabel}`"
            @click="emit('nextPeriod')"
          >
            <IconChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>

    <div class="weekdays">
      <span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span>
    </div>

    <div v-if="viewMode === 'week'" class="week-timeline">
      <div class="week-day-columns">
        <section
          v-for="day in weekTimelineDays"
          :key="day.date"
          class="week-day-column"
          :class="{
            'is-selected': day.date === selectedDate,
            'is-today': day.isToday,
            'is-hovered': isWeekDayHovered(day.date),
          }"
          @mouseenter="scheduleWeekDayHovered(day.date)"
          @mouseleave="clearWeekDayHovered()"
        >
          <button
            class="week-day-head"
            type="button"
            @click="emit('select', day.date)"
          >
            <span>周{{ weekdayText(day.date) }}</span>
            <b>{{ day.day }}</b>
          </button>

          <div class="week-day-stack">
            <div
              v-for="slot in weekDaySlots(day)"
              :key="slot.key"
              class="week-period-slot"
              :class="[
                `slot-${slot.key}`,
                {
                  'has-events': slot.events.length > 0,
                  'is-single-event': slot.events.length === 1,
                },
              ]"
            >
              <template v-if="slot.events.length > 0">
                <button
                  v-for="event in weekSlotEventsForDisplay(slot, day.date)"
                  :key="event.id"
                  class="week-event-cell"
                  :class="[
                    `type-${event.type}`,
                    { 'is-selected': day.date === selectedDate },
                  ]"
                  type="button"
                  :aria-label="`${weekEventTimeLabel(event)} ${timelineEventLabel(event)}`"
                  @click="selectWeekDayEvent(day, event)"
                >
                  <span class="week-event-cell-time">{{ weekEventTimeLabel(event) }}</span>
                  <span class="week-event-cell-body">
                    <i></i>
                    <b>{{ timelineEventLabel(event) }}</b>
                  </span>
                </button>

                <button
                  v-if="shouldShowWeekSlotMore(slot, day.date)"
                  class="week-slot-more"
                  type="button"
                  :aria-label="`还有 ${hiddenWeekSlotEventCount(slot)} 项待办，点击查看当天详情`"
                  @click="selectWeekDaySlot(day)"
                >
                  +{{ hiddenWeekSlotEventCount(slot) }} 更多
                </button>
              </template>

              <button
                v-else
                class="week-empty-slot"
                :class="{ 'is-selected': day.date === selectedDate }"
                type="button"
                aria-label="暂无待办"
                @click="selectWeekDaySlot(day)"
              />
            </div>
          </div>
        </section>
      </div>
    </div>

    <div v-else class="month-grid">
      <div
        v-for="day in days"
        :key="day.date"
        class="day-cell"
        :class="{
          'is-muted': !day.inMonth,
          'is-today': day.isToday,
          'is-selected': day.date === selectedDate,
          'has-events': monthTotalEventCount(day) > 0,
          'has-range-events': monthRangeLaneCount(day.date) > 0,
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
              <span v-if="monthTotalEventCount(day)" class="event-count-dot">{{
                monthTotalEventCount(day)
              }}</span>
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
                {
                  'is-range': monthRangeDisplayMode === 'daily' && isRangeEvent(event),
                  'is-rejected': isRejectedTodo(event),
                },
              ]"
              :aria-label="`${formatEventTime(event)} ${event.title}${isRejectedTodo(event) ? ' 已拒绝' : ''}`"
            >
              <em v-if="isRejectedTodo(event)" class="month-event-reject">{{
                getTodoStatusLabel(event)
              }}</em>
              <i></i>
              <b>{{ event.title }}</b>
            </span>
          </span>
        </button>
      </div>

      <div v-if="monthRangeDisplayMode === 'bar'" class="month-range-layer" aria-hidden="true">
        <span
          v-for="segment in monthRangeSegments"
          :key="segment.key"
          class="month-range-bar"
          :class="[
            `type-${segment.event.type}`,
            `status-${segment.event.status}`,
            { 'is-rejected': isRejectedTodo(segment.event) },
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

.calendar-controls {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
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
  transition:
    background 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
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
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
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

.week-day-columns {
  height: 100%;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  border-radius: 14px;
  background: rgba(226, 232, 240, 0.5);
  padding: 4px;
  display: flex;
  align-items: stretch;
  gap: 4px;
  overflow: hidden;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 18px 34px -34px rgba(15, 23, 42, 0.5);
}

.week-day-column {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.42);
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
  transition:
    flex 0.22s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.week-day-column.is-hovered {
  flex: 2.35 1 0;
  z-index: 2;
  background: rgba(255, 255, 255, 0.72);
  box-shadow:
    0 16px 28px -22px rgba(37, 99, 235, 0.34),
    inset 0 0 0 1px rgba(147, 197, 253, 0.42);
}

.week-day-column.is-selected {
  background: rgba(239, 246, 255, 0.62);
  box-shadow: inset 0 0 0 1px rgba(147, 197, 253, 0.34);
}

.week-day-head {
  flex: 0 0 auto;
  border: 0;
  border-radius: 9px;
  background: rgba(248, 250, 252, 0.9);
  color: #64748b;
  padding: 6px 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font: inherit;
  cursor: pointer;
  transition:
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.week-day-head span {
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}

.week-day-head b {
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

.week-day-column.is-today .week-day-head b,
.week-day-column.is-selected .week-day-head b {
  background: #111827;
  color: #ffffff;
}

.week-day-column.is-selected .week-day-head {
  background: rgba(239, 246, 255, 0.92);
  box-shadow: inset 0 0 0 1px rgba(147, 197, 253, 0.35);
}

.week-day-stack {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow: hidden;
  padding: 1px;
}

.week-day-column.is-hovered .week-day-stack {
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.45) transparent;
}

.week-day-column.is-hovered .week-day-stack::-webkit-scrollbar {
  width: 4px;
}

.week-day-column.is-hovered .week-day-stack::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.45);
}

.week-period-slot {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow: hidden;
}

.week-period-slot.has-events {
  justify-content: stretch;
}

.week-day-column.is-hovered .week-period-slot.has-events {
  flex: 0 0 auto;
  min-height: 0;
}

.week-day-column.is-hovered .week-period-slot:not(.has-events) {
  flex: 0.55 1 0;
  min-height: 24px;
}

.week-event-cell {
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  border: 0;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.88);
  padding: 6px 7px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  text-align: left;
  font: inherit;
  cursor: pointer;
  box-shadow: 0 10px 18px -18px rgba(15, 23, 42, 0.22);
  transition:
    background 0.18s ease,
    box-shadow 0.18s ease,
    min-height 0.22s ease,
    padding 0.22s ease,
    gap 0.22s ease;
  overflow: hidden;
}

.week-day-column.is-hovered .week-event-cell {
  flex: 0 0 auto;
  min-height: 58px;
  padding: 9px 10px;
  gap: 6px;
}

.week-event-cell:hover,
.week-empty-slot:hover {
  background: rgba(239, 246, 255, 0.72);
  box-shadow:
    inset 0 0 0 1px rgba(147, 197, 253, 0.28),
    0 12px 20px -18px rgba(37, 99, 235, 0.28);
}

.week-event-cell.is-selected,
.week-empty-slot.is-selected {
  box-shadow:
    inset 0 0 0 1px rgba(147, 197, 253, 0.34),
    0 12px 20px -18px rgba(37, 99, 235, 0.24);
}

.week-event-cell-time {
  flex: 0 0 auto;
  color: #64748b;
  font-size: 10px;
  font-weight: 950;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.week-event-cell-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 5px;
  color: #334155;
}

.week-event-cell-body i {
  width: 5px;
  height: 5px;
  margin-top: 4px;
  border-radius: 999px;
  background: currentColor;
  flex: 0 0 auto;
}

.week-event-cell-body b {
  min-width: 0;
  overflow: hidden;
  color: #334155;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  font-weight: 850;
  line-height: 1.2;
}

.week-period-slot.is-single-event .week-event-cell-body b {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  white-space: normal;
}

.week-day-column.is-hovered .week-event-cell-time {
  font-size: 11px;
}

.week-day-column.is-hovered .week-event-cell-body b {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  white-space: normal;
  font-size: 11px;
  line-height: 1.35;
}

.week-slot-more {
  flex: 0 0 auto;
  align-self: stretch;
  min-height: 22px;
  border: 0;
  border-radius: 9px;
  background: rgba(238, 242, 255, 0.92);
  color: #4338ca;
  padding: 0 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font: inherit;
  font-size: 9px;
  font-weight: 950;
  line-height: 1;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(199, 210, 254, 0.72);
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.week-slot-more:hover {
  background: rgba(224, 231, 255, 0.98);
  color: #3730a3;
}

.week-empty-slot {
  flex: 1;
  min-height: 0;
  width: 100%;
  border: 0;
  border-radius: 9px;
  background: rgba(248, 250, 252, 0.5);
  padding: 0;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(226, 232, 240, 0.6);
  transition:
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.week-period-slot.slot-morning-early .week-event-cell-time {
  color: #2563eb;
}

.week-period-slot.slot-morning-late .week-event-cell-time {
  color: #1d4ed8;
}

.week-period-slot.slot-afternoon-early .week-event-cell-time {
  color: #d97706;
}

.week-period-slot.slot-afternoon-late .week-event-cell-time {
  color: #b45309;
}

.week-event-cell.type-meeting,
.week-event-cell.type-meeting .week-event-cell-body {
  color: #2563eb;
}
.week-event-cell.type-todo,
.week-event-cell.type-task,
.week-event-cell.type-todo .week-event-cell-body,
.week-event-cell.type-task .week-event-cell-body {
  color: #059669;
}
.week-event-cell.type-approval,
.week-event-cell.type-approval .week-event-cell-body {
  color: #d97706;
}
.week-event-cell.type-ai,
.week-event-cell.type-ai .week-event-cell-body {
  color: #7c3aed;
}

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
  overflow: hidden;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
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
  background: transparent;
  color: #94a3b8;
}

.day-cell.is-muted .month-event b {
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
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
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
  border-radius: 4px;
  overflow: hidden;
}

.month-event {
  position: relative;
  width: 100%;
  box-sizing: border-box;
  background: transparent;
  padding: 3px 4px 3px 12px;
  display: flex;
  align-items: center;
  min-height: 20px;
  min-width: 0;
  transition: background 0.15s ease;
}

.month-event:hover {
  background: rgba(15, 23, 42, 0.04);
}

.month-event i {
  position: absolute;
  top: 50%;
  left: 2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  transform: translateY(-50%);
  flex: 0 0 auto;
}

.month-event b {
  width: 100%;
  min-width: 0;
  overflow: hidden;
  color: #334155;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
}

.month-event.is-range {
  min-height: 20px;
  background: rgba(239, 246, 255, 0.6);
  color: #64748b;
  padding: 3px 4px 3px 12px;
}

.month-event.is-range i {
  top: 50%;
}

.month-event.is-range b {
  color: #475569;
}

.month-event.status-done {
  opacity: 0.62;
}

.month-event.status-done b {
  color: #64748b;
  text-decoration: line-through;
}

.month-event.is-rejected {
  position: relative;
  background: rgba(254, 242, 242, 0.6);
  color: #b91c1c;
  padding-right: 38px;
}

.month-event.is-rejected i {
  background: #ef4444;
}

.month-event.is-rejected b {
  color: #991b1b;
}

.month-event.is-rejected .month-event-reject {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 1;
  border-radius: 4px;
  background: rgba(254, 226, 226, 0.96);
  color: #b91c1c;
  font-size: 9px;
  font-style: normal;
  font-weight: 800;
  line-height: 1;
  padding: 2px 4px;
  pointer-events: none;
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

.month-range-bar.is-rejected {
  background: linear-gradient(90deg, rgba(254, 226, 226, 0.98), rgba(254, 242, 242, 0.96));
  color: #b91c1c;
  box-shadow:
    inset 0 0 0 1px rgba(239, 68, 68, 0.12),
    0 8px 16px -18px rgba(185, 28, 28, 0.32);
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

.type-meeting {
  color: #1d4ed8;
}
.type-todo,
.type-task {
  color: #047857;
}
.type-approval {
  color: #b45309;
}
.type-ai {
  color: #6d28d9;
}

.month-event.type-meeting {
  color: #2563eb;
}
.month-event.type-todo,
.month-event.type-task {
  color: #059669;
}
.month-event.type-approval {
  color: #d97706;
}
.month-event.type-ai {
  color: #7c3aed;
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

  .calendar-controls {
    width: 100%;
    justify-content: space-between;
  }

  .month-grid {
    grid-template-rows: repeat(6, minmax(76px, 1fr));
    gap: 6px;
  }

  .week-day-columns {
    gap: 3px;
    padding: 3px;
  }

  .week-day-head {
    flex-direction: column;
    gap: 3px;
    padding: 4px 2px;
  }

  .week-event-cell {
    padding: 5px 6px;
  }

  .week-period-slot.is-single-event .week-event-cell-body b {
    -webkit-line-clamp: 2;
  }

  .day-cell {
    min-height: 76px;
    padding: 7px;
  }

  .month-event {
    min-height: 20px;
    padding: 2px 4px 2px 10px;
    gap: 1px;
  }

  .month-event i {
    top: 5px;
    left: 2px;
    width: 4px;
    height: 4px;
  }
}
</style>
