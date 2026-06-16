<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import IconCheck from '~icons/lucide/check'
import IconChevronDown from '~icons/lucide/chevron-down'
import IconSearch from '~icons/lucide/search'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { CalendarUser } from '../types'

const props = withDefaults(
  defineProps<{
    modelValue: string | string[]
    users: CalendarUser[]
    disabled?: boolean
    highlighted?: boolean
    multiple?: boolean
  }>(),
  {
    multiple: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const open = ref(false)
const query = ref('')
const rootRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const popoverWidth = ref(0)

const selectedIds = computed(() => normalizeIds(props.modelValue))

const selectedSet = computed(() => new Set(selectedIds.value))

const userMap = computed(() => new Map(props.users.map((user) => [user.id, user])))

const filteredUsers = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return props.users

  return props.users.filter((user) => {
    return user.name.toLowerCase().includes(keyword) || user.id.toLowerCase().includes(keyword)
  })
})

const displayLabel = computed(() => {
  const names = selectedIds.value
    .map((id) => userMap.value.get(id)?.name)
    .filter((name): name is string => Boolean(name))

  if (names.length === 0) return '选择负责人'
  if (names.length <= 2) return names.join('、')
  return `${names.slice(0, 2).join('、')} 等 ${names.length} 人`
})

const hasSelection = computed(() => selectedIds.value.length > 0)

function normalizeIds(value: string | string[]) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (!value) return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function syncPopoverWidth() {
  popoverWidth.value = rootRef.value?.getBoundingClientRect().width ?? 0
}

function toggleUser(id: string) {
  if (props.disabled) return

  let nextIds: string[]

  if (props.multiple) {
    nextIds = selectedSet.value.has(id)
      ? selectedIds.value.filter((item) => item !== id)
      : [...selectedIds.value, id]
  } else {
    nextIds = selectedSet.value.has(id) ? [] : [id]
    open.value = false
  }

  emit('update:modelValue', nextIds)
}

function closePopover() {
  open.value = false
}

watch(open, (isOpen) => {
  if (!isOpen) {
    query.value = ''
    return
  }

  syncPopoverWidth()
  nextTick(() => {
    searchInputRef.value?.focus()
  })
})
</script>

<template>
  <div ref="rootRef" class="assignee-select-root">
    <Popover v-model:open="open">
      <PopoverTrigger as-child>
        <button
          type="button"
          :class="['assignee-select-trigger', { 'is-ai-highlighted': highlighted }]"
          :disabled="disabled"
          aria-label="选择负责人"
          :aria-expanded="open"
        >
          <span class="assignee-select-value" :class="{ 'is-placeholder': !hasSelection }">
            {{ displayLabel }}
          </span>
          <IconChevronDown class="assignee-select-icon" aria-hidden="true" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="center"
        :side-offset="6"
        :style="{
          width: popoverWidth ? `${popoverWidth}px` : undefined,
          minWidth: popoverWidth ? `${popoverWidth}px` : undefined,
          maxWidth: popoverWidth ? `${popoverWidth}px` : undefined,
        }"
        class="todo-assignee-popover"
      >
        <div class="assignee-toolbar">
          <label class="assignee-search-bar">
            <IconSearch class="assignee-search-icon" aria-hidden="true" />
            <input
              ref="searchInputRef"
              v-model="query"
              type="search"
              class="assignee-search-input"
              placeholder="搜索姓名或工号"
              autocomplete="off"
              @keydown.stop
            />
          </label>
          <button type="button" class="assignee-cancel-btn" @click="closePopover">取消</button>
        </div>

        <div
          class="assignee-grid"
          role="listbox"
          aria-label="负责人列表"
          aria-multiselectable="true"
        >
          <button
            v-for="user in filteredUsers"
            :key="user.id"
            type="button"
            role="option"
            class="assignee-option"
            :class="{ 'is-selected': selectedSet.has(user.id) }"
            :aria-selected="selectedSet.has(user.id)"
            @click="toggleUser(user.id)"
          >
            <span class="assignee-option-name">{{ user.name }}</span>
            <IconCheck
              v-if="selectedSet.has(user.id)"
              class="assignee-option-check"
              aria-hidden="true"
            />
          </button>
        </div>

        <p v-if="filteredUsers.length === 0" class="assignee-empty">未找到匹配人员</p>

        <div v-if="selectedIds.length > 0" class="assignee-footer">
          已选 {{ selectedIds.length }} 人
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>

<style scoped>
.assignee-select-root {
  width: 100%;
  min-width: 0;
}

.assignee-select-trigger {
  width: 100%;
  min-width: 0;
  height: 40px;
  border: 1px solid #dfe8f3;
  border-radius: 10px;
  background: #ffffff;
  color: #111827;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  box-shadow: none;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.assignee-select-trigger:hover:not(:disabled),
.assignee-select-trigger[aria-expanded='true'] {
  border-color: #111827;
  box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.07);
}

.assignee-select-trigger:disabled {
  background: #f8fafc;
  color: #94a3b8;
  cursor: not-allowed;
}

.assignee-select-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.assignee-select-value.is-placeholder {
  color: #94a3b8;
  font-weight: 400;
}

.assignee-select-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: #64748b;
}

.assignee-select-trigger.is-ai-highlighted .assignee-select-value {
  animation: ai-value-highlight 0.55s ease-in-out 2;
}

@keyframes ai-value-highlight {
  0%,
  100% {
    box-shadow: none;
  }

  50% {
    box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.55);
    border-radius: 6px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .assignee-select-trigger.is-ai-highlighted .assignee-select-value {
    animation: none;
  }
}
</style>

<!-- Portal 内容 -->
<style>
.todo-assignee-popover[data-slot='popover-content'] {
  z-index: 1200 !important;
  gap: 0 !important;
  overflow: hidden !important;
  border-radius: 10px !important;
  border: 1px solid #dfe8f3 !important;
  background: #ffffff !important;
  padding: 0 !important;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.1) !important;
  ring: 0 !important;
}

.todo-assignee-popover .assignee-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: #f8fafc;
  border-bottom: 1px solid #eef2f7;
}

.todo-assignee-popover .assignee-search-bar {
  flex: 1;
  min-width: 0;
  height: 36px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  border: 1px solid #dfe8f3;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
}

.todo-assignee-popover .assignee-search-bar:focus-within {
  border-color: #111827;
  box-shadow:
    inset 0 1px 2px rgba(15, 23, 42, 0.04),
    0 0 0 3px rgba(17, 24, 39, 0.07);
}

.todo-assignee-popover .assignee-search-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  color: #94a3b8;
}

.todo-assignee-popover .assignee-search-input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: #111827;
  font: inherit;
  font-size: 13px;
}

.todo-assignee-popover .assignee-search-input::placeholder {
  color: #94a3b8;
}

.todo-assignee-popover .assignee-cancel-btn {
  flex-shrink: 0;
  border: 0;
  background: transparent;
  color: #64748b;
  padding: 0 2px;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s ease;
}

.todo-assignee-popover .assignee-cancel-btn:hover {
  color: #111827;
}

.todo-assignee-popover .assignee-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  max-height: 200px;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 8px;
  scrollbar-width: thin;
  scrollbar-color: #e2e8f0 transparent;
}

.todo-assignee-popover .assignee-grid::-webkit-scrollbar {
  width: 4px;
}

.todo-assignee-popover .assignee-grid::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: #e2e8f0;
}

.todo-assignee-popover .assignee-option {
  min-height: 36px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #111827;
  padding: 8px 24px 8px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  gap: 4px;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.todo-assignee-popover .assignee-option:hover,
.todo-assignee-popover .assignee-option:focus-visible {
  background: #f3f4f6;
  outline: none;
}

.todo-assignee-popover .assignee-option.is-selected {
  background: #f8fafc;
  border-color: #e2e8f0;
}

.todo-assignee-popover .assignee-option-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
  text-align: center;
}

.todo-assignee-popover .assignee-option-check {
  position: absolute;
  right: 6px;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: #111827;
}

.todo-assignee-popover .assignee-empty {
  margin: 0;
  padding: 20px 12px 16px;
  color: #94a3b8;
  font-size: 13px;
  text-align: center;
}

.todo-assignee-popover .assignee-footer {
  padding: 8px 12px 10px;
  border-top: 1px solid #eef2f7;
  color: #64748b;
  font-size: 12px;
  text-align: right;
}
</style>
