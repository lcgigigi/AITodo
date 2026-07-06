<script setup lang="ts">
import { computed } from 'vue'
import type { CalendarDay } from '../types'
import { formatEventTime, isAllDayEvent, isRangeEvent } from '../todoDisplay'

type TimelineSlot = {
  key: string
  label: string
  hour?: number
  isGap?: boolean
}

const props = defineProps<{
  days: CalendarDay[]
  selectedDate: string
}>()

const emit = defineEmits<{
  select: [date: string, time?: string]
}>()

const dateWeekdays = ['日', '一', '二', '三', '四', '五', '六']
const timelineEventLimit = 1

const timelineSlots = computed<TimelineSlot[]>(() => {
  const hours = new Set([9, 10, 11, 16])

  for (const day of props.days) {
    for (const event of day.events) {
      if (isAllDayEvent(event)) continue
      const hour = eventHour(event.time)
      if (hour >= 0) hours.add(hour)
    }
  }

  return [...hours]
    .sort((a, b) => a - b)
    .reduce<TimelineSlot[]>((slots, hour, index, sortedHours) => {
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

function timelineSlotTime(slot: TimelineSlot) {
  if (slot.hour === undefined || slot.isGap) return undefined
  return `${String(slot.hour).padStart(2, '0')}:00`
}

function selectTimelineCell(day: CalendarDay, slot: TimelineSlot) {
  emit('select', day.date, timelineSlotTime(slot))
}
</script>

<template>
  <div class="week-timeline" aria-label="周视图时间轴">
    <div class="timeline-grid">
      <span class="timeline-axis-head"></span>
      <button
        v-for="day in days"
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
        v-for="day in days"
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
          v-for="day in days"
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
</template>

<style scoped>
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

.timeline-event.type-meeting {
  color: #2563eb;
}

.timeline-event.type-task {
  color: #059669;
}

.timeline-event.type-approval {
  color: #d97706;
}

.timeline-event.type-ai {
  color: #7c3aed;
}
</style>
