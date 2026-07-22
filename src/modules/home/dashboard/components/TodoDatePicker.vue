<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { getLocalTimeZone, today } from '@internationalized/date'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useAttrs, watch } from 'vue'
import IconCalendarDays from '~icons/lucide/calendar-days'
import type { DateValue } from 'reka-ui'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  bindPickerDocumentOutsideClose,
  handlePickerPointerDownOutside,
  safeParseCalendarDate,
} from './picker.helpers'

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
const panelRef = ref<HTMLElement | null>(null)
let unbindDocumentOutside: (() => void) | undefined
let wasOpenOnTriggerPointerDown = false
const calendarPlaceholder = shallowRef<DateValue>(today(getLocalTimeZone()))
const externalClass = computed(() => attrs.class as HTMLAttributes['class'])

const selectedDate = computed<DateValue | undefined>({
  get: () => safeParseCalendarDate(props.modelValue),
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
    const nextDate = safeParseCalendarDate(value)
    if (nextDate) calendarPlaceholder.value = nextDate
  },
  { immediate: true },
)

function onTriggerClick() {
  if (props.disabled) return
  const shouldClose = wasOpenOnTriggerPointerDown || open.value
  wasOpenOnTriggerPointerDown = false
  if (shouldClose) {
    open.value = false
    return
  }
  open.value = true
}

function onTriggerPointerDown() {
  wasOpenOnTriggerPointerDown = open.value
}

function onPopoverPointerDownOutside(event: {
  target?: EventTarget | null
  preventDefault?: () => void
}) {
  handlePickerPointerDownOutside(
    event,
    () => {
      open.value = false
    },
    '.todo-date-trigger',
  )
}

watch(open, (isOpen) => {
  unbindDocumentOutside?.()
  unbindDocumentOutside = undefined

  if (!isOpen) return

  nextTick(() => {
    unbindDocumentOutside = bindPickerDocumentOutsideClose({
      isOpen: () => open.value,
      getContentEl: () => panelRef.value?.closest('[data-slot="popover-content"]') ?? null,
      close: () => {
        open.value = false
      },
      triggerSelector: '.todo-date-trigger',
    })
  })
})

onBeforeUnmount(() => {
  unbindDocumentOutside?.()
})
</script>

<template>
  <Popover v-model:open="open">
    <PopoverAnchor as-child>
      <Button
        type="button"
        variant="outline"
        :disabled="disabled"
        :aria-label="ariaLabel"
        :aria-expanded="open"
        :class="
          cn(
            'todo-picker-trigger todo-date-trigger',
            highlighted && 'is-ai-highlighted',
            externalClass,
          )
        "
        @pointerdown="onTriggerPointerDown"
        @click.stop="onTriggerClick"
      >
        <span class="todo-picker-value" :class="{ 'is-placeholder': !modelValue }">
          {{ displayValue }}
        </span>
        <IconCalendarDays aria-hidden="true" />
      </Button>
    </PopoverAnchor>
    <PopoverContent
      align="start"
      class="todo-date-popover !z-[1200] !w-[264px] !gap-0 !overflow-hidden !rounded-2xl !border !border-slate-200 !bg-white !p-0 !ring-0 !shadow-[0_18px_42px_-30px_rgba(15,23,42,0.45)]"
      @pointer-down-outside="onPopoverPointerDownOutside"
    >
      <div ref="panelRef" class="todo-date-panel">
        <Calendar
          v-model="selectedDate"
          v-model:placeholder="calendarPlaceholder"
          locale="zh-CN"
          layout="month-and-year"
        />
      </div>
    </PopoverContent>
  </Popover>
</template>

<style scoped>
.todo-date-trigger {
  font-weight: 500;
}

.todo-date-popover {
  padding: 0;
  border-color: rgba(203, 213, 225, 0.86);
}

.todo-date-popover :deep([data-slot='calendar']) {
  width: max-content;
}
</style>

<style>
[data-slot='popover-content'].todo-date-popover {
  box-sizing: border-box;
  border: 1px solid #e2e8f0 !important;
  border-radius: 16px !important;
  overflow: hidden !important;
  background: #ffffff !important;
  box-shadow: 0 18px 42px -30px rgba(15, 23, 42, 0.45) !important;
}
</style>
