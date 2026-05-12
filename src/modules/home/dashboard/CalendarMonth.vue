<script setup lang="ts">
import type { CalendarDay, CalendarEventType } from './types'

defineProps<{
  days: CalendarDay[]
  selectedDate: string
}>()

const emit = defineEmits<{
  select: [date: string]
}>()

const weekdays = ['一', '二', '三', '四', '五', '六', '日']

const typeLabel: Record<CalendarEventType, string> = {
  meeting: '会议',
  task: '待办',
  approval: '审批',
  ai: 'AI',
}
</script>

<template>
  <section class="calendar-board">
    <header class="calendar-head">
      <div>
        <p class="eyebrow">日程</p>
        <h2>2026 年 5 月</h2>
      </div>
      <div class="legend">
        <span v-for="(label, type) in typeLabel" :key="type" class="legend-item" :class="`type-${type}`">
          <i></i>{{ label }}
        </span>
      </div>
    </header>

    <div class="weekdays">
      <span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span>
    </div>

    <div class="month-grid">
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
          <span class="day-number">{{ day.day }}</span>
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
            v-for="event in day.events.slice(0, 3)"
            :key="event.id"
            class="event-pill"
            :class="[`type-${event.type}`, `status-${event.status}`]"
          >
            {{ event.time }} {{ event.title }}
          </span>
          <span v-if="day.events.length > 3" class="more-count">+{{ day.events.length - 3 }}</span>
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
  gap: 20px;
  align-items: flex-start;
}

.eyebrow {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 700;
  color: #6b7280;
}

h2 {
  margin: 0;
  font-size: 23px;
  line-height: 1.1;
  color: #111827;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.legend-item {
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  background: #f8fafc;
  color: #4b5563;
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend-item i {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: currentColor;
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

.month-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-template-rows: repeat(5, minmax(0, 1fr));
  gap: 6px;
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
  align-items: center;
  justify-content: space-between;
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
}

.event-pill,
.more-count {
  max-width: 100%;
  min-height: 17px;
  border-radius: 6px;
  padding: 0 6px;
  font-size: 10px;
  font-weight: 700;
  line-height: 17px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.more-count {
  width: fit-content;
  background: #eef2ff;
  color: #4338ca;
}

.type-meeting { color: #1d4ed8; }
.type-task { color: #047857; }
.type-approval { color: #b45309; }
.type-ai { color: #6d28d9; }

.event-pill.type-meeting { background: #dbeafe; }
.event-pill.type-task { background: #d1fae5; }
.event-pill.type-approval { background: #ffedd5; }
.event-pill.type-ai { background: #ede9fe; }
.event-pill.status-urgent { outline: 1px solid rgba(220, 38, 38, 0.28); }

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
    flex-direction: column;
  }

  .legend {
    justify-content: flex-start;
  }

  .month-grid {
    grid-template-rows: repeat(5, minmax(76px, 1fr));
    gap: 6px;
  }

  .day-cell {
    min-height: 76px;
    padding: 7px;
  }

  .event-pill {
    display: none;
  }

  .day-cell.has-events::after {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: #2563eb;
  }
}
</style>
