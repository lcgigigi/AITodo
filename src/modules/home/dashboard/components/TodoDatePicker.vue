<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { getLocalTimeZone, parseDate, today } from '@internationalized/date'
import { computed, ref, useAttrs, watch } from 'vue'
import IconCalendarDays from '~icons/lucide/calendar-days'
import type { DateValue } from 'reka-ui'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    modelValue: string
    disabled?: boolean
    highlighted?: boolean
    placeholder?: string
    ariaLabel?: string
  }>(),
  {
    disabled: false,
    highlighted: false,
    placeholder: '选择日期',
    ariaLabel: '选择日期',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: []
}>()

const attrs = useAttrs()
const open = ref(false)
const calendarPlaceholder = ref(today(getLocalTimeZone()) as any)
const externalClass = computed(() => attrs.class as HTMLAttributes['class'])

const selectedDate = computed<DateValue | undefined>({
  get: () => safeParseDate(props.modelValue),
  set: (value) => {
    emit('update:modelValue', value?.toString() ?? '')
    emit('change')
    open.value = false
  },
})

const displayValue = computed(() => {
  if (!props.modelValue) return props.placeholder
  return props.modelValue.split('-').join('/')
})

watch(
  () => props.modelValue,
  (value) => {
    const nextDate = safeParseDate(value)
    if (nextDate) calendarPlaceholder.value = nextDate
  },
  { immediate: true },
)

function safeParseDate(value: string): DateValue | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined

  try {
    return parseDate(value)
  } catch {
    return undefined
  }
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        type="button"
        variant="outline"
        :disabled="disabled"
        :aria-label="ariaLabel"
        :class="
          cn(
            'todo-date-trigger',
            highlighted && 'is-ai-highlighted',
            externalClass,
          )
        "
      >
        <span class="todo-picker-value" :class="{ 'is-placeholder': !modelValue }">
          {{ displayValue }}
        </span>
        <IconCalendarDays aria-hidden="true" />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="start"
      class="todo-date-popover !w-[264px] !gap-0 !overflow-hidden !rounded-2xl !border !border-slate-200 !bg-white !p-0 !shadow-[0_18px_42px_-30px_rgba(15,23,42,0.45)]"
    >
      <Calendar
        v-model="selectedDate"
        v-model:placeholder="calendarPlaceholder"
        locale="zh-CN"
        layout="month-and-year"
      />
    </PopoverContent>
  </Popover>
</template>

<style scoped>
.todo-date-trigger {
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
  font-weight: 500;
  box-shadow: none;
}

.todo-date-trigger:hover,
.todo-date-trigger[aria-expanded='true'] {
  border-color: #111827;
  background: #ffffff;
  color: #111827;
  box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.07);
}

.todo-date-trigger:disabled {
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

.todo-date-trigger svg {
  width: 16px;
  height: 16px;
  color: #94a3b8;
  flex: 0 0 auto;
}

.todo-date-trigger.is-ai-highlighted .todo-picker-value {
  animation: ai-picker-value-highlight 0.55s ease-in-out 2;
}

.todo-date-popover {
  padding: 0;
  border-color: rgba(203, 213, 225, 0.86);
}

.todo-date-popover :deep([data-slot='calendar']) {
  width: max-content;
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
  .todo-date-trigger.is-ai-highlighted .todo-picker-value {
    animation: none;
  }
}
</style>
