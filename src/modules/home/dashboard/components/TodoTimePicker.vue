<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed, nextTick, ref, useAttrs, watch } from 'vue'
import IconCheck from '~icons/lucide/check'
import IconClock3 from '~icons/lucide/clock-3'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { getTodoHourOptions, getTodoMinuteOptions, parseTodoTime } from './picker.helpers'

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
    placeholder: '--:--',
    ariaLabel: '选择时间',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: []
}>()

const attrs = useAttrs()
const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const popoverWidth = ref('')
const hourTouched = ref(false)
const minuteTouched = ref(false)
const externalClass = computed(() => attrs.class as HTMLAttributes['class'])

const parsedTime = computed(() => parseTodoTime(props.modelValue))
const hourOptions = computed(() => getTodoHourOptions(parsedTime.value?.hour))
const minuteOptions = computed(() => getTodoMinuteOptions(parsedTime.value?.minute))

const displayValue = computed(() => (parsedTime.value ? props.modelValue : props.placeholder))

function setHour(hour: string) {
  const minute = parsedTime.value?.minute ?? '00'
  hourTouched.value = true
  emitTime(hour, minute)
  tryClosePopover()
}

function setMinute(minute: string) {
  const hour = parsedTime.value?.hour ?? '07'
  minuteTouched.value = true
  emitTime(hour, minute)
  tryClosePopover()
}

function emitTime(hour: string, minute: string) {
  emit('update:modelValue', `${hour}:${minute}`)
  emit('change')
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
  const trigger = rootRef.value?.querySelector('button')
  const width =
    trigger?.getBoundingClientRect().width ?? rootRef.value?.getBoundingClientRect().width
  if (!width) return

  popoverWidth.value = `${Math.round(width)}px`
}

watch(open, (isOpen) => {
  if (!isOpen) return

  resetSelectionState()
  nextTick(() => {
    syncPopoverWidth()
    requestAnimationFrame(syncPopoverWidth)
  })
})
</script>

<template>
  <div ref="rootRef" class="todo-time-picker">
    <Popover v-model:open="open">
      <PopoverTrigger as-child>
        <Button
          type="button"
          variant="outline"
          :disabled="disabled"
          :aria-label="ariaLabel"
          :class="cn('todo-time-trigger', highlighted && 'is-ai-highlighted', externalClass)"
        >
          <span class="todo-picker-value" :class="{ 'is-placeholder': !parsedTime }">
            {{ displayValue }}
          </span>
          <IconClock3 aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        :style="{ '--todo-time-popover-width': popoverWidth || undefined }"
        class="todo-time-popover gap-0 p-0"
      >
        <div class="todo-time-panel">
          <div class="todo-time-column" aria-label="小时">
            <span class="todo-time-label">时</span>
            <ScrollArea class="todo-time-scroll">
              <button
                v-for="hour in hourOptions"
                :key="hour"
                class="todo-time-option"
                :class="{ active: parsedTime?.hour === hour }"
                type="button"
                @click="setHour(hour)"
              >
                <span class="todo-time-option-value">{{ hour }}</span>
                <IconCheck v-if="parsedTime?.hour === hour" aria-hidden="true" />
              </button>
            </ScrollArea>
          </div>
          <div class="todo-time-column" aria-label="分钟">
            <span class="todo-time-label">分</span>
            <ScrollArea class="todo-time-scroll">
              <button
                v-for="minute in minuteOptions"
                :key="minute"
                class="todo-time-option"
                :class="{ active: parsedTime?.minute === minute }"
                type="button"
                @click="setMinute(minute)"
              >
                <span class="todo-time-option-value">{{ minute }}</span>
                <IconCheck v-if="parsedTime?.minute === minute" aria-hidden="true" />
              </button>
            </ScrollArea>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>

<style scoped>
.todo-time-picker {
  width: 100%;
  min-width: 0;
}

.todo-time-trigger {
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

.todo-time-trigger:hover,
.todo-time-trigger[aria-expanded='true'] {
  border-color: #111827;
  background: #ffffff;
  color: #111827;
  box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.07);
}

.todo-time-trigger:disabled {
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

.todo-time-trigger svg {
  width: 16px;
  height: 16px;
  color: #94a3b8;
  flex: 0 0 auto;
}

.todo-time-trigger.is-ai-highlighted .todo-picker-value {
  animation: ai-picker-value-highlight 0.55s ease-in-out 2;
}

.todo-time-panel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
  width: 100%;
}

.todo-time-column {
  min-width: 0;
  display: grid;
  gap: 7px;
}

.todo-time-label {
  color: #64748b;
  font-size: 12px;
  text-align: center;
}

.todo-time-scroll {
  height: 168px;
  border: 1px solid #e5edf6;
  border-radius: 10px;
  background: #f8fafc;
}

.todo-time-option {
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

.todo-time-option-value {
  display: block;
  width: 100%;
  text-align: center;
}

.todo-time-option:hover {
  background: #eff6ff;
  color: #111827;
}

.todo-time-option.active {
  background: #3b82f6;
  color: #ffffff;
}

.todo-time-option svg {
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
  .todo-time-trigger.is-ai-highlighted .todo-picker-value {
    animation: none;
  }
}
</style>

<style>
[data-slot='popover-content'].todo-time-popover {
  width: var(--todo-time-popover-width) !important;
  min-width: var(--todo-time-popover-width) !important;
  max-width: var(--todo-time-popover-width) !important;
  box-sizing: border-box;
  padding: 9px;
  border-color: rgba(203, 213, 225, 0.86);
  border-radius: 14px;
  box-shadow: 0 18px 40px -28px rgba(15, 23, 42, 0.38);
}
</style>
