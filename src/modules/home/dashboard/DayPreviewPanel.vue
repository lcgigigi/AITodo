<script setup lang="ts">
import type { CalendarEvent, CalendarEventType, CalendarSpecialDay } from './types'

const props = defineProps<{
  dateLabel: string
  events: CalendarEvent[]
  specialDays: CalendarSpecialDay[]
}>()

const typeText: Record<CalendarEventType, string> = {
  meeting: '会面',
  task: '待办',
  approval: '审批',
  ai: '智能',
}

const statusText: Record<CalendarEvent['status'], string> = {
  todo: '待看',
  done: '完成',
  urgent: '先看',
}

const specialText: Record<CalendarSpecialDay['type'], string> = {
  holiday: '节假日',
  workday: '补班',
  'solar-term': '节气',
}
</script>

<template>
  <section class="preview-panel">
    <header class="preview-head">
      <div>
        <p>这一天</p>
        <h2>{{ props.dateLabel }}</h2>
      </div>
      <span class="event-count">{{ events.length ? `${events.length} 个安排` : '空闲' }}</span>
    </header>

    <div v-if="specialDays.length" class="special-row">
      <span
        v-for="item in specialDays"
        :key="`${item.type}-${item.name}`"
        class="special-chip"
        :class="`special-${item.type}`"
      >
        {{ specialText[item.type] }} · {{ item.name }}
      </span>
    </div>

    <div v-if="events.length" class="timeline">
      <article
        v-for="event in events"
        :key="event.id"
        class="timeline-item"
        :class="[`type-${event.type}`, `status-${event.status}`]"
      >
        <time>{{ event.time }}</time>
        <div class="event-body">
          <div class="event-topline">
            <span class="event-type">{{ typeText[event.type] }}</span>
            <span class="event-status">{{ statusText[event.status] }}</span>
          </div>
          <h3>{{ event.title }}</h3>
          <p>{{ event.owner }}<template v-if="event.source"> · {{ event.source }}</template></p>
        </div>
      </article>
    </div>

    <div v-else class="empty">
      <h3>这一天暂时很清爽</h3>
      <p>可以安排一个待办，或者先浏览本月日程。</p>
    </div>
  </section>
</template>

<style scoped>
.preview-panel {
  padding: 2px 2px 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.preview-head {
  padding: 2px 0 16px;
  border-bottom: 1px dashed rgba(148, 163, 184, 0.46);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.preview-head p {
  margin: 0 0 7px;
  font-size: 12px;
  font-weight: 700;
  color: #8a6a35;
}

.preview-head h2 {
  margin: 0;
  color: #1f2937;
  font-size: 24px;
  font-weight: 850;
  line-height: 1.05;
}

.event-count {
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: #fff7ed;
  color: #9a3412;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.special-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.special-chip {
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 900;
}

.special-holiday {
  background: rgba(254, 226, 226, 0.62);
  border-color: rgba(185, 28, 28, 0.12);
  color: #b91c1c;
}

.special-workday {
  background: rgba(226, 232, 240, 0.72);
  border-color: rgba(75, 85, 99, 0.1);
  color: #4b5563;
}

.special-solar-term {
  background: rgba(204, 251, 241, 0.64);
  border-color: rgba(15, 118, 110, 0.12);
  color: #0f766e;
}

.timeline {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.timeline-item {
  position: relative;
  padding: 12px 0;
  display: grid;
  grid-template-columns: 50px minmax(0, 1fr);
  gap: 14px;
}

.timeline-item + .timeline-item {
  border-top: 1px dashed rgba(203, 213, 225, 0.78);
}

time {
  padding-top: 2px;
  color: #9a3412;
  font-size: 12px;
  font-weight: 850;
  font-variant-numeric: tabular-nums;
}

.event-body {
  position: relative;
  min-width: 0;
  padding: 0 0 0 16px;
}

.event-body::before {
  content: '';
  position: absolute;
  top: 4px;
  left: 0;
  width: 4px;
  height: 34px;
  border-radius: 999px;
  background: #f59e0b;
  opacity: 0.72;
}

.event-topline {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
  flex-wrap: wrap;
}

.event-type,
.event-status {
  min-height: 19px;
  padding: 0 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 750;
  display: inline-flex;
  align-items: center;
}

.event-type {
  background: rgba(255, 251, 235, 0.78);
  border: 1px solid rgba(251, 191, 36, 0.22);
}

.event-status {
  background: rgba(255, 255, 255, 0.68);
  color: #64748b;
}

.timeline-item.status-urgent .event-status {
  background: #fee2e2;
  color: #b91c1c;
}

h3 {
  margin: 0;
  color: #1f2937;
  font-size: 14px;
  font-weight: 780;
  line-height: 1.3;
}

p {
  margin: 6px 0 0;
  color: #6b7280;
  font-size: 12px;
  line-height: 1.45;
}

.type-meeting .event-type { color: #2563eb; }
.type-meeting .event-body::before {
  background: #93c5fd;
}
.type-task .event-type { color: #047857; }
.type-task .event-body::before {
  background: #86efac;
}
.type-approval .event-type { color: #b45309; }
.type-approval .event-body::before {
  background: #fcd34d;
}
.type-ai .event-type { color: #7c3aed; }
.type-ai .event-body::before {
  background: #c4b5fd;
}

.empty {
  min-height: 150px;
  border-left: 2px solid rgba(148, 163, 184, 0.55);
  background: linear-gradient(90deg, rgba(248, 250, 252, 0.84), rgba(248, 250, 252, 0));
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 18px 0 18px 18px;
}

.empty h3 {
  font-size: 15px;
}
</style>
