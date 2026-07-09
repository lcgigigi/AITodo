<script setup lang="ts">
import { computed } from 'vue'

import type { CalendarEvent } from '../config/types'
import { formatEventTime, getEventScheduleDisplay } from '../helpers/todoDisplay'

const props = defineProps<{
  event: CalendarEvent
  allDayText?: string
}>()

const schedule = computed(() => getEventScheduleDisplay(props.event, props.allDayText))
const ariaLabel = computed(() => formatEventTime(props.event, props.allDayText))
</script>

<template>
  <time class="event-schedule" :aria-label="ariaLabel">
    <template v-if="schedule.kind === 'range'">
      <span class="schedule-range">
        <span class="schedule-point">
          <span class="schedule-label">起</span>
          <span class="schedule-date">{{ schedule.start.date }}</span>
          <span v-if="schedule.start.time" class="schedule-clock">{{ schedule.start.time }}</span>
        </span>
        <span class="schedule-divider" aria-hidden="true" />
        <span class="schedule-point is-end">
          <span class="schedule-label">止</span>
          <span class="schedule-date">{{ schedule.end.date }}</span>
          <span v-if="schedule.end.time" class="schedule-clock">{{ schedule.end.time }}</span>
        </span>
      </span>
    </template>

    <span v-else-if="schedule.kind === 'time'" class="schedule-clock is-primary">
      {{ schedule.time }}
    </span>

    <span v-else class="schedule-all-day">
      {{ schedule.label }}
    </span>
  </time>
</template>

<style scoped>
.event-schedule {
  display: block;
  min-width: 0;
  font-variant-numeric: tabular-nums;
}

.schedule-range {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.schedule-point {
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr);
  grid-template-rows: auto auto;
  column-gap: 4px;
  row-gap: 1px;
  align-items: baseline;
}

.schedule-label {
  grid-row: 1 / span 2;
  align-self: center;
  color: currentColor;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.04em;
  opacity: 0.62;
}

.schedule-date {
  color: currentColor;
  font-size: 15px;
  font-weight: 950;
  line-height: 1.05;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.schedule-clock {
  grid-column: 2;
  color: currentColor;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.1;
  opacity: 0.86;
  white-space: nowrap;
}

.schedule-clock.is-primary {
  display: block;
  font-size: 16px;
  font-weight: 950;
  line-height: 1.15;
  letter-spacing: 0.01em;
  opacity: 1;
}

.schedule-all-day {
  display: block;
  font-size: 14px;
  font-weight: 900;
  line-height: 1.2;
  letter-spacing: 0.02em;
}

.schedule-divider {
  display: block;
  width: 18px;
  height: 1px;
  margin-left: 7px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.28;
}
</style>
