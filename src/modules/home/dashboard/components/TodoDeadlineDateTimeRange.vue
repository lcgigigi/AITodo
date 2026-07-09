<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { getLocalTimeZone, today } from '@internationalized/date'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useAttrs,
  watch,
} from 'vue'
import IconCalendarDays from '~icons/lucide/calendar-days'
import IconCheck from '~icons/lucide/check'
import type { DateValue } from 'reka-ui'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  getTodoHourOptions,
  getTodoMinuteOptions,
  handlePickerPopoverOutside,
  parseTodoTime,
  safeParseCalendarDate,
} from './picker.helpers'

type ActiveField = 'start' | 'end'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    startDate: string
    startTime: string
    endDate: string
    endTime: string
    disabled?: boolean
    startHighlighted?: boolean
    endHighlighted?: boolean
  }>(),
  {
    disabled: false,
    startHighlighted: false,
    endHighlighted: false,
  },
)

const emit = defineEmits<{
  'update:startDate': [value: string]
  'update:startTime': [value: string]
  'update:endDate': [value: string]
  'update:endTime': [value: string]
  change: []
}>()

const attrs = useAttrs()
const open = ref(false)
const activeField = ref<ActiveField>('start')
const rootRef = ref<HTMLElement | null>(null)
const gridRef = ref<HTMLElement | null>(null)
const anchorRef = ref<HTMLElement | null>(null)
const popoverWidth = ref('')
let resizeObserver: ResizeObserver | null = null
const popoverAlign = computed(() => (activeField.value === 'end' ? 'end' : 'start'))
const calendarPlaceholder = shallowRef<DateValue>(today(getLocalTimeZone()))
const hourTouched = ref(false)
const minuteTouched = ref(false)
const externalClass = computed(() => attrs.class as HTMLAttributes['class'])

const activeDate = computed({
  get: () => (activeField.value === 'start' ? props.startDate : props.endDate),
  set: (value: string) => {
    if (activeField.value === 'start') {
      emit('update:startDate', value)
    } else {
      emit('update:endDate', value)
    }
    emit('change')
  },
})

const activeTime = computed({
  get: () => (activeField.value === 'start' ? props.startTime : props.endTime),
  set: (value: string) => {
    if (activeField.value === 'start') {
      emit('update:startTime', value)
    } else {
      emit('update:endTime', value)
    }
    emit('change')
  },
})

const parsedTime = computed(() => parseTodoTime(activeTime.value))
const hourOptions = computed(() => getTodoHourOptions(parsedTime.value?.hour))
const minuteOptions = computed(() => getTodoMinuteOptions(parsedTime.value?.minute))

const selectedDate = computed<DateValue | undefined>({
  get: () => safeParseCalendarDate(activeDate.value),
  set: (value) => {
    activeDate.value = value?.toString() ?? ''
  },
})

const startDisplayValue = computed(() =>
  formatDisplayValue(props.startDate, props.startTime, '选择开始时间'),
)
const endDisplayValue = computed(() =>
  formatDisplayValue(props.endDate, props.endTime, '选择截止时间'),
)
const activeFieldLabel = computed(() => (activeField.value === 'start' ? '开始时间' : '截止时间'))

function formatDisplayValue(date: string, time: string, placeholder: string) {
  if (!date) return placeholder

  const dateText = date.split('-').join('/')
  const parsed = parseTodoTime(time)
  if (!parsed) return dateText

  return `${dateText} ${time}`
}

function openPicker(field: ActiveField) {
  if (props.disabled) return

  if (open.value && activeField.value === field) {
    open.value = false
    return
  }

  activeField.value = field
  schedulePopoverWidthSync()
  nextTick(() => {
    syncPopoverWidth()
    open.value = true
    schedulePopoverWidthSync()
  })
}

function setHour(hour: string) {
  const minute = parsedTime.value?.minute ?? '00'
  hourTouched.value = true
  activeTime.value = `${hour}:${minute}`
  tryClosePopover()
}

function setMinute(minute: string) {
  const hour = parsedTime.value?.hour ?? '07'
  minuteTouched.value = true
  activeTime.value = `${hour}:${minute}`
  tryClosePopover()
}

function resetSelectionState() {
  hourTouched.value = Boolean(parsedTime.value?.hour)
  minuteTouched.value = false
}

function tryClosePopover() {
  if (hourTouched.value && minuteTouched.value) {
    open.value = false
  }
}

function syncPopoverWidth() {
  const width =
    gridRef.value?.getBoundingClientRect().width ??
    rootRef.value?.getBoundingClientRect().width ??
    anchorRef.value?.getBoundingClientRect().width
  if (!width) return

  popoverWidth.value = `${Math.round(width)}px`
}

function schedulePopoverWidthSync() {
  syncPopoverWidth()
  nextTick(() => {
    syncPopoverWidth()
    requestAnimationFrame(() => {
      syncPopoverWidth()
      requestAnimationFrame(syncPopoverWidth)
    })
  })
}

function onPopoverOutside(event: { target?: EventTarget | null; preventDefault?: () => void }) {
  handlePickerPopoverOutside(
    event,
    () => {
      open.value = false
    },
    { keepTriggerSelector: '.todo-datetime-trigger' },
  )
}

watch(
  () => activeDate.value,
  (value) => {
    const nextDate = safeParseCalendarDate(value)
    if (nextDate) calendarPlaceholder.value = nextDate
  },
  { immediate: true },
)

watch(activeField, () => {
  const nextDate = safeParseCalendarDate(activeDate.value)
  if (nextDate) calendarPlaceholder.value = nextDate
  resetSelectionState()

  if (open.value) {
    schedulePopoverWidthSync()
  }
})

watch(open, (isOpen) => {
  if (!isOpen) return

  resetSelectionState()
  nextTick(() => {
    resetSelectionState()
    schedulePopoverWidthSync()
  })
})

onMounted(() => {
  schedulePopoverWidthSync()

  resizeObserver = new ResizeObserver(() => {
    syncPopoverWidth()
  })

  const observeTarget = gridRef.value ?? rootRef.value
  if (observeTarget) {
    resizeObserver.observe(observeTarget)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<template>
  <div ref="rootRef" :class="cn('deadline-datetime-range', externalClass)">
    <div ref="gridRef" class="deadline-datetime-grid">
      <label class="deadline-datetime-field">
        <span>开始时间</span>
        <Button
          type="button"
          variant="outline"
          :disabled="disabled"
          aria-label="选择开始时间"
          :class="
            cn(
              'todo-datetime-trigger',
              startHighlighted && 'is-ai-highlighted',
              open && activeField === 'start' && 'is-active',
            )
          "
          @click="openPicker('start')"
        >
          <span class="todo-picker-value" :class="{ 'is-placeholder': !startDate }">
            {{ startDisplayValue }}
          </span>
          <IconCalendarDays aria-hidden="true" />
        </Button>
      </label>
      <label class="deadline-datetime-field">
        <span>截止时间</span>
        <Button
          type="button"
          variant="outline"
          :disabled="disabled"
          aria-label="选择截止时间"
          :class="
            cn(
              'todo-datetime-trigger',
              endHighlighted && 'is-ai-highlighted',
              open && activeField === 'end' && 'is-active',
            )
          "
          @click="openPicker('end')"
        >
          <span class="todo-picker-value" :class="{ 'is-placeholder': !endDate }">
            {{ endDisplayValue }}
          </span>
          <IconCalendarDays aria-hidden="true" />
        </Button>
      </label>
    </div>

    <Popover v-model:open="open">
      <PopoverAnchor as-child>
        <div ref="anchorRef" class="deadline-datetime-anchor" aria-hidden="true" />
      </PopoverAnchor>
      <PopoverContent
        :align="popoverAlign"
        :style="{
          width: popoverWidth || undefined,
          minWidth: popoverWidth || undefined,
          maxWidth: popoverWidth || undefined,
        }"
        class="todo-datetime-popover !z-[1200] !w-auto !gap-0 !overflow-hidden !rounded-2xl !border !border-slate-200 !bg-white !p-0 !ring-0 !shadow-[0_18px_42px_-30px_rgba(15,23,42,0.45)]"
        @pointer-down-outside="onPopoverOutside"
        @interact-outside="onPopoverOutside"
        @focus-outside="onPopoverOutside"
      >
        <div class="deadline-datetime-popover-head">正在设置{{ activeFieldLabel }}</div>
        <div class="todo-datetime-panel">
          <div class="todo-datetime-calendar">
            <Calendar
              v-model="selectedDate"
              v-model:placeholder="calendarPlaceholder"
              locale="zh-CN"
              layout="month-and-year"
            />
          </div>
          <div class="todo-datetime-time">
            <div class="todo-datetime-time-column" aria-label="小时">
              <span class="todo-datetime-time-label">时</span>
              <ScrollArea class="todo-datetime-time-scroll">
                <button
                  v-for="hour in hourOptions"
                  :key="hour"
                  class="todo-datetime-time-option"
                  :class="{ active: parsedTime?.hour === hour }"
                  type="button"
                  @click="setHour(hour)"
                >
                  <span class="todo-datetime-time-option-value">{{ hour }}</span>
                  <IconCheck v-if="parsedTime?.hour === hour" aria-hidden="true" />
                </button>
              </ScrollArea>
            </div>
            <div class="todo-datetime-time-column" aria-label="分钟">
              <span class="todo-datetime-time-label">分</span>
              <ScrollArea class="todo-datetime-time-scroll">
                <button
                  v-for="minute in minuteOptions"
                  :key="minute"
                  class="todo-datetime-time-option"
                  :class="{ active: parsedTime?.minute === minute }"
                  type="button"
                  @click="setMinute(minute)"
                >
                  <span class="todo-datetime-time-option-value">{{ minute }}</span>
                  <IconCheck v-if="parsedTime?.minute === minute" aria-hidden="true" />
                </button>
              </ScrollArea>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>

<style scoped>
.deadline-datetime-range {
  grid-column: 1 / -1;
  position: relative;
  width: 100%;
  min-width: 0;
}

.deadline-datetime-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 14px;
}

.deadline-datetime-field {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.deadline-datetime-field > span {
  color: #475569;
  font-size: 13px;
}

.deadline-datetime-anchor {
  width: 100%;
  height: 0;
  pointer-events: none;
}

.deadline-datetime-popover-head {
  padding: 10px 14px 2px;
  color: #64748b;
  font-size: 12px;
}

.todo-datetime-trigger {
  width: 100%;
  min-width: 0;
  height: 40px;
  border-color: #dfe8f3;
  border-radius: 10px;
  background: #ffffff;
  color: #111827;
  padding: 0 12px;
  justify-content: space-between;
  font: inherit;
  font-size: 14px;
  box-shadow: none;
}

.todo-datetime-trigger:hover,
.todo-datetime-trigger.is-active {
  border-color: #111827;
  background: #ffffff;
  color: #111827;
  box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.07);
}

.todo-datetime-trigger:disabled {
  background: #f8fafc;
  color: #475569;
  cursor: default;
  opacity: 1;
}

.todo-picker-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-picker-value.is-placeholder {
  color: #94a3b8;
}

.todo-datetime-trigger svg {
  width: 16px;
  height: 16px;
  color: #94a3b8;
  flex: 0 0 auto;
}

.todo-datetime-trigger.is-ai-highlighted .todo-picker-value {
  animation: ai-picker-value-highlight 0.55s ease-in-out 2;
}

.todo-datetime-panel {
  display: flex;
  align-items: flex-start;
  width: 100%;
}

.todo-datetime-calendar {
  flex: 1.55 1 0;
  min-width: 0;
  border-right: 1px solid #eef2f7;
  padding: 6px 8px 8px;
}

.todo-datetime-time {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 10px;
  padding: 6px 12px 8px;
  flex: 1 1 0;
  min-width: 0;
}

.todo-datetime-time-column {
  min-width: 0;
  display: grid;
  gap: 6px;
}

.todo-datetime-time-label {
  color: #64748b;
  font-size: 12px;
  text-align: center;
}

.todo-datetime-time-scroll {
  height: 210px;
  border: 1px solid #e5edf6;
  border-radius: 10px;
  background: #f8fafc;
}

.todo-datetime-time-option {
  position: relative;
  width: 100%;
  min-height: 30px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #334155;
  padding: 0 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.todo-datetime-time-option-value {
  display: block;
  width: 100%;
  text-align: center;
}

.todo-datetime-time-option:hover {
  background: #eff6ff;
  color: #111827;
}

.todo-datetime-time-option.active {
  background: #3b82f6;
  color: #ffffff;
}

.todo-datetime-time-option svg {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 13px;
  height: 13px;
  color: currentColor;
}

@keyframes ai-picker-value-highlight {
  0% {
    color: #111827;
    text-shadow: none;
  }
  38% {
    color: #2563eb;
    text-shadow:
      0 0 1px rgba(59, 130, 246, 0.62),
      0 0 10px rgba(59, 130, 246, 0.24);
  }
  100% {
    color: #111827;
    text-shadow: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .todo-datetime-trigger.is-ai-highlighted .todo-picker-value {
    animation: none;
  }
}
</style>

<style>
[data-slot='popover-content'].todo-datetime-popover {
  box-sizing: border-box;
  border: 1px solid #e2e8f0 !important;
  border-radius: 16px !important;
  overflow: hidden !important;
  background: #ffffff !important;
  box-shadow: 0 18px 42px -30px rgba(15, 23, 42, 0.45) !important;
}

[data-slot='popover-content'].todo-datetime-popover .todo-datetime-calendar [data-slot='calendar'] {
  width: 100% !important;
  max-width: 100%;
  border: 0;
  padding: 2px 4px 4px !important;
  --cell-size: min(calc((100% - 8px) / 7), 34px);
  --cell-radius: 10px;
}

[data-slot='popover-content'].todo-datetime-popover
  .todo-datetime-calendar
  [data-slot='calendar']
  .mt-3 {
  margin-top: 8px !important;
}

[data-slot='popover-content'].todo-datetime-popover
  .todo-datetime-calendar
  [data-slot='calendar-grid-row'].mt-1 {
  margin-top: 2px !important;
}

[data-slot='popover-content'].todo-datetime-popover
  .todo-datetime-calendar
  [data-slot='calendar-grid'] {
  width: 100% !important;
}

[data-slot='popover-content'].todo-datetime-popover
  .todo-datetime-calendar
  [data-slot='calendar-grid-row'] {
  width: 100% !important;
  justify-content: space-between;
}

[data-slot='popover-content'].todo-datetime-popover
  .todo-datetime-calendar
  [data-slot='calendar-cell'] {
  width: var(--cell-size) !important;
  height: var(--cell-size) !important;
  flex: 0 0 var(--cell-size);
}

[data-slot='popover-content'].todo-datetime-popover
  .todo-datetime-calendar
  [data-slot='calendar-cell']:has([data-selected]) {
  background: transparent !important;
}

[data-slot='popover-content'].todo-datetime-popover
  .todo-datetime-calendar
  [data-slot='calendar-cell-trigger'] {
  width: 100% !important;
  height: 100% !important;
  border-radius: var(--cell-radius) !important;
}

[data-slot='popover-content'].todo-datetime-popover
  .todo-datetime-calendar
  [data-slot='calendar-cell-trigger'][data-selected] {
  background-color: #3b82f6 !important;
  color: #ffffff !important;
  box-shadow: 0 8px 18px -12px rgba(37, 99, 235, 0.9);
}

[data-slot='popover-content'].todo-datetime-popover
  .todo-datetime-calendar
  [data-slot='calendar-cell-trigger'][data-selected]:hover,
[data-slot='popover-content'].todo-datetime-popover
  .todo-datetime-calendar
  [data-slot='calendar-cell-trigger'][data-selected]:focus,
[data-slot='popover-content'].todo-datetime-popover
  .todo-datetime-calendar
  [data-slot='calendar-cell-trigger'][data-selected]:focus-visible {
  background-color: #3b82f6 !important;
  color: #ffffff !important;
  box-shadow: 0 8px 18px -12px rgba(37, 99, 235, 0.9);
}

[data-slot='popover-content'].todo-datetime-popover
  .todo-datetime-calendar
  [data-slot='calendar-header']
  nav {
  z-index: 30;
}

[data-slot='popover-content'].todo-datetime-popover
  .todo-datetime-calendar
  [data-slot='calendar-header']
  .relative.z-20.flex {
  width: auto;
  max-width: calc(100% - 4.5rem);
  gap: 8px;
}
</style>
