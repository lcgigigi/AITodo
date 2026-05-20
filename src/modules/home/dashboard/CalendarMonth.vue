<script setup lang="ts">
import { computed } from 'vue'
import type { CalendarDay } from './types'

type CalendarViewMode = 'month' | 'week'
type TimelineSlot = {
  key: string
  label: string
  hour?: number
  isGap?: boolean
}

const props = defineProps<{
  days: CalendarDay[]
  selectedDate: string
  monthLabel: string
  weekLabel: string
  viewMode: CalendarViewMode
}>()

const emit = defineEmits<{
  select: [date: string]
  previousPeriod: []
  nextPeriod: []
  'update:viewMode': [mode: CalendarViewMode]
}>()

const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const dateWeekdays = ['日', '一', '二', '三', '四', '五', '六']
const timelineEventLimit = 1
const displayLabel = computed(() => (props.viewMode === 'week' ? props.weekLabel : props.monthLabel))
const periodActionLabel = computed(() => (props.viewMode === 'week' ? '周' : '月'))
const weekTimelineDays = computed(() => props.days)
const timelineSlots = computed<TimelineSlot[]>(() => {
  const hours = new Set([9, 10, 11, 16])

  for (const day of weekTimelineDays.value) {
    for (const event of day.events) {
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

function weekdayText(date: string) {
  return dateWeekdays[new Date(`${date}T12:00:00`).getDay()]
}

function eventHour(time: string) {
  const hour = Number.parseInt(time.slice(0, 2), 10)
  return Number.isFinite(hour) ? hour : -1
}

function timelineEvents(day: CalendarDay, slot: TimelineSlot) {
  if (slot.isGap || slot.hour === undefined) return []
  return day.events.filter((event) => eventHour(event.time) === slot.hour)
}

function visibleTimelineEvents(day: CalendarDay, slot: TimelineSlot) {
  return timelineEvents(day, slot).slice(0, timelineEventLimit)
}

function hiddenTimelineEventCount(day: CalendarDay, slot: TimelineSlot) {
  return Math.max(timelineEvents(day, slot).length - timelineEventLimit, 0)
}
</script>

<template>
  <section class="calendar-board" :class="{ 'is-week-mode': viewMode === 'week' }">
    <header class="calendar-head">
      <div class="calendar-title-line">
        <h2>{{ displayLabel }}</h2>
      </div>
      <div class="calendar-controls">
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
          <button type="button" :aria-label="`上一${periodActionLabel}`" @click="emit('previousPeriod')">‹</button>
          <button type="button" :aria-label="`下一${periodActionLabel}`" @click="emit('nextPeriod')">›</button>
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

        <template v-for="slot in timelineSlots" :key="slot.key">
          <span class="timeline-time" :class="{ 'is-gap': slot.isGap }">{{ slot.label }}</span>
          <button
            v-for="day in weekTimelineDays"
            :key="`${slot.key}-${day.date}`"
            class="timeline-cell"
            :class="{ 'is-selected': day.date === selectedDate, 'is-gap': slot.isGap }"
            type="button"
            @click="emit('select', day.date)"
          >
            <span
              v-for="event in visibleTimelineEvents(day, slot)"
              :key="event.id"
              class="timeline-event"
              :class="[`type-${event.type}`, { 'is-urgent': event.priority === 'urgent' }]"
            >
              <i></i>
              <time>{{ event.time }}</time>
              <b>{{ event.title }}</b>
            </span>
            <span v-if="hiddenTimelineEventCount(day, slot) > 0" class="timeline-more">
              +{{ hiddenTimelineEventCount(day, slot) }}
            </span>
          </button>
        </template>
      </div>
    </div>

    <div v-else class="month-grid" :class="{ 'is-six-weeks': days.length > 35 }">
      <button
        v-for="day in days"
        :key="day.date"
        class="day-cell"
        :class="{
          'is-muted': !day.inMonth,
          'is-today': day.isToday,
          'is-selected': day.date === selectedDate,
          'has-events': day.events.length > 0,
        }"
        type="button"
        @click="emit('select', day.date)"
      >
        <span class="day-cell-head">
          <span class="date-stack">
            <span class="day-number">{{ day.day }}</span>
          </span>
          <span class="special-list">
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
            v-for="event in day.events.slice(0, 4)"
            :key="event.id"
            class="month-event"
            :class="[
              `type-${event.type}`,
              `status-${event.status}`,
              { 'is-urgent': event.priority === 'urgent' && event.status !== 'done' },
            ]"
            :aria-label="`${event.time} ${event.title}`"
          >
            <i></i>
            <b>{{ event.title }}</b>
            <time>{{ event.time }}</time>
          </span>
          <span v-if="day.events.length > 4" class="more-count">
            +{{ day.events.length - 4 }}
          </span>
        </span>
      </button>
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
  font: inherit;
  font-size: 20px;
  font-weight: 850;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease;
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

.timeline-event.is-urgent {
  background: rgba(254, 242, 242, 0.9);
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
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-template-rows: repeat(5, minmax(0, 1fr));
  gap: 6px;
}

.month-grid.is-six-weeks {
  grid-template-rows: repeat(6, minmax(0, 1fr));
}

.day-cell {
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  border: 1px solid #eef2f7;
  border-radius: 12px;
  background: rgba(249, 250, 251, 0.72);
  color: #111827;
  padding: 7px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  text-align: left;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.day-cell:hover {
  transform: translateY(-2px);
  border-color: #dbeafe;
  box-shadow: 0 14px 24px -22px rgba(37, 99, 235, 0.5);
}

.day-cell.is-muted {
  color: #cbd5e1;
  background: rgba(248, 250, 252, 0.46);
}

.day-cell.is-selected {
  border-color: #111827;
  background: #ffffff;
  box-shadow: 0 18px 32px -24px rgba(15, 23, 42, 0.45);
}

.day-cell.is-today .day-number {
  background: #111827;
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

.special-list {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  flex: 1;
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

.month-event,
.more-count {
  max-width: 100%;
  border-radius: 999px;
  overflow: hidden;
}

.month-event {
  min-height: 22px;
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(226, 232, 240, 0.78);
  background: rgba(255, 255, 255, 0.74);
  padding: 0 7px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  box-shadow: 0 8px 15px -15px rgba(15, 23, 42, 0.28);
}

.month-event i {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: currentColor;
  flex: 0 0 auto;
}

.month-event time {
  color: currentColor;
  font-size: 10px;
  font-weight: 950;
  line-height: 1;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.month-event b {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: #334155;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  font-weight: 850;
  line-height: 1;
}

.month-event.is-urgent {
  border-color: rgba(248, 113, 113, 0.24);
  background: rgba(254, 242, 242, 0.9);
}

.month-event.status-done {
  opacity: 0.62;
}

.month-event.status-done b {
  color: #64748b;
  text-decoration: line-through;
}

.more-count {
  width: fit-content;
  min-height: 17px;
  padding: 0 6px;
  background: #eef2ff;
  color: #4338ca;
  font-size: 10px;
  font-weight: 800;
  line-height: 17px;
}

.type-meeting { color: #1d4ed8; }
.type-task { color: #047857; }
.type-approval { color: #b45309; }
.type-ai { color: #6d28d9; }

.month-event.type-meeting { color: #2563eb; }
.month-event.type-task { color: #059669; }
.month-event.type-approval { color: #d97706; }
.month-event.type-ai { color: #7c3aed; }

@media (max-width: 1180px) {
  .calendar-board {
    min-height: 520px;
  }
}

@media (max-width: 1360px) {
  .month-event time {
    display: none;
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
    grid-template-rows: repeat(5, minmax(76px, 1fr));
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
