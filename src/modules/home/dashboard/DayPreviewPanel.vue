<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import IconArrowLeft from '~icons/lucide/arrow-left'
import IconCalendarPlus from '~icons/lucide/calendar-plus'
import IconPlus from '~icons/lucide/plus'
import IconX from '~icons/lucide/x'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import AiParseStatus from './components/AiParseStatus.vue'
import TodoAssigneeSelect from './components/TodoAssigneeSelect.vue'
import TodoDatePicker from './components/TodoDatePicker.vue'
import TodoDeadlineDateTimeRange from './components/TodoDeadlineDateTimeRange.vue'
import TodoTimePicker from './components/TodoTimePicker.vue'
import { isValidTodoTime } from './components/picker.helpers'
import type {
  CalendarEvent,
  CalendarEventStatus,
  CalendarSpecialDay,
  CalendarTodoDraft,
  CalendarTodoForm,
  CalendarTodoUpdate,
  CalendarUser,
} from './config/types'
import EventScheduleTime from './components/EventScheduleTime.vue'
import {
  eventTypeLabel,
  filterEventsByScope,
  filterEventsByStatus,
  filterEventsByType,
  isMeetingEvent,
  scheduledTimePresets,
  shouldShowEventMeta,
  specialText,
  statusText,
  type PanelMode,
  type ParsedHighlightField,
  type TodoScopeFilter,
  type TodoStatusFilter,
  type TodoTypeFilter,
} from './helpers/dayPreviewPanel.helpers'
import {
  addDays,
  getRejectedTodoMessage,
  getTodoListDisplayText,
  getTodoScopeBadge,
  isRangeEvent,
  isRejectedTodo,
  parseDate,
  ymd,
} from './helpers/todoDisplay'
import { loadTodoDetail, parseTodoText as serviceParseTodoText } from './services/todo.service'

const props = defineProps<{
  date: string
  dateLabel: string
  events: CalendarEvent[]
  specialDays: CalendarSpecialDay[]
  currentUser: CalendarUser
  assignableUsers: CalendarUser[]
  showClose?: boolean
  formOnly?: boolean
  quickCreatePrompt?: string
  quickCreateKey?: number
  externalDraft?: CalendarTodoDraft | null
  externalDraftKey?: number
  presetCreateTime?: string
  presetCreateKey?: number
  statusUpdatingIds?: Set<string>
}>()

const emit = defineEmits<{
  createTodo: [payload: CalendarTodoDraft]
  updateTodo: [payload: CalendarTodoUpdate]
  updateStatus: [id: string, status: CalendarEventStatus]
  deleteTodo: [id: string]
  dirtyChange: [dirty: boolean]
  notify: [message: string, type?: 'success' | 'error' | 'info']
  close: []
}>()

const panelMode = ref<PanelMode>('list')
const statusFilter = ref<TodoStatusFilter>('all')
const typeFilter = ref<TodoTypeFilter>('all')
const scopeFilter = ref<TodoScopeFilter>('all')
const editingId = ref('')
const aiPrompt = ref('')
const aiParsedOriginalText = ref('')
const isParsing = ref(false)
const isTitleInvalid = ref(false)
const isScheduledTimeInvalid = ref(false)
const isDeadlineStartTimeInvalid = ref(false)
const isDeadlineEndTimeInvalid = ref(false)
const highlightedFields = ref<Set<ParsedHighlightField>>(new Set())
const todoForm = ref<CalendarTodoForm>(createEmptyForm(props.date))
const initialFormSnapshot = ref(formSnapshot(todoForm.value))
const discardWarningVisible = ref(false)
const pendingDeleteId = ref('')
let pendingDiscardAction: (() => void) | undefined
let highlightTimer: ReturnType<typeof setTimeout> | undefined

const eventsForStatusCounts = computed(() => filterEventsByType(props.events, typeFilter.value))
const eventsForTypeCounts = computed(() => filterEventsByStatus(props.events, statusFilter.value))

const totalCount = computed(() => eventsForStatusCounts.value.length)
const pendingCount = computed(
  () =>
    eventsForStatusCounts.value.filter((event) => event.status !== 'done' && !isRejectedTodo(event))
      .length,
)
const rejectedCount = computed(
  () => eventsForStatusCounts.value.filter((event) => isRejectedTodo(event)).length,
)
const doneCount = computed(
  () =>
    eventsForStatusCounts.value.filter((event) => event.status === 'done' && !isRejectedTodo(event))
      .length,
)
const taskTypeCount = computed(
  () => eventsForTypeCounts.value.filter((event) => !isMeetingEvent(event)).length,
)
const meetingTypeCount = computed(
  () => eventsForTypeCounts.value.filter((event) => isMeetingEvent(event)).length,
)
const assignedByMeCount = computed(
  () => props.events.filter((event) => event.scope === 'assigned_by_me').length,
)
const assignedToMeCount = computed(
  () => props.events.filter((event) => event.scope === 'assigned_to_me').length,
)
const hasScopeFilters = computed(() => assignedByMeCount.value > 0 || assignedToMeCount.value > 0)
const filteredEvents = computed(() =>
  filterEventsByScope(
    filterEventsByType(filterEventsByStatus(props.events, statusFilter.value), typeFilter.value),
    scopeFilter.value,
  ),
)
const hasActiveFilters = computed(
  () => statusFilter.value !== 'all' || typeFilter.value !== 'all' || scopeFilter.value !== 'all',
)
const isFilterEmpty = computed(() => props.events.length > 0 && filteredEvents.value.length === 0)
const isFormMode = computed(() => panelMode.value !== 'list')
const isViewMode = computed(() => panelMode.value === 'view')
const canEditForm = computed(() => panelMode.value === 'create' || panelMode.value === 'edit')
const formTitle = computed(() => {
  if (panelMode.value === 'view') return '查看待办'
  if (panelMode.value === 'edit') return '编辑待办'
  return '新增待办'
})
const isFormReadonly = computed(() => isParsing.value || isViewMode.value)
const isDeadlineMode = computed(() => todoForm.value.mode === 'deadline')
const canChooseAssignee = computed(() => props.assignableUsers.length > 1)
const hasUnsavedChanges = computed(
  () => canEditForm.value && formSnapshot(todoForm.value) !== initialFormSnapshot.value,
)

watch(
  () => todoForm.value.title,
  (title) => {
    if (title.trim()) {
      isTitleInvalid.value = false
    }
  },
)

function clearTimeInvalidState() {
  isScheduledTimeInvalid.value = false
  isDeadlineStartTimeInvalid.value = false
  isDeadlineEndTimeInvalid.value = false
}

function isCreateTimeValid(form: CalendarTodoForm) {
  if (form.mode === 'scheduled') {
    return isValidTodoTime(form.time)
  }

  return isValidTodoTime(form.time) && isValidTodoTime(form.endTime)
}

function setCreateTimeInvalidState(form: CalendarTodoForm) {
  if (form.mode === 'scheduled') {
    isScheduledTimeInvalid.value = !isValidTodoTime(form.time)
    isDeadlineStartTimeInvalid.value = false
    isDeadlineEndTimeInvalid.value = false
    return
  }

  isScheduledTimeInvalid.value = false
  isDeadlineStartTimeInvalid.value = !isValidTodoTime(form.time)
  isDeadlineEndTimeInvalid.value = !isValidTodoTime(form.endTime)
}

watch(
  () => [todoForm.value.time, todoForm.value.endTime, todoForm.value.mode] as const,
  () => {
    if (!isScheduledTimeInvalid.value && !isDeadlineStartTimeInvalid.value && !isDeadlineEndTimeInvalid.value) {
      return
    }

    if (isCreateTimeValid(todoForm.value)) {
      clearTimeInvalidState()
    }
  },
)

watch(
  hasUnsavedChanges,
  (dirty) => {
    emit('dirtyChange', dirty)
    if (!dirty) hideDiscardWarning()
  },
  { immediate: true },
)

watch(
  () => formSnapshot(todoForm.value, aiPrompt.value),
  () => {
    if (discardWarningVisible.value) hideDiscardWarning()
  },
)

watch(
  () => props.date,
  () => {
    if (props.formOnly) return

    resetFormState()
    resetListFilters()
  },
)

watch(
  () => props.quickCreateKey,
  async () => {
    if (!props.quickCreatePrompt?.trim()) {
      if (props.formOnly) beginCreateForm()
      return
    }

    beginCreateForm()
    aiPrompt.value = props.quickCreatePrompt
    await parseTodoText()
  },
  { immediate: true },
)

watch(
  () => props.externalDraftKey,
  () => {
    const draft = props.externalDraft
    if (!draft) return

    beginCreateForm({
      mode: draft.endDate ? 'deadline' : 'scheduled',
      date: draft.date,
      endDate: draft.endDate ?? draft.date,
      time: draft.time ?? '',
      endTime: draft.endTime ?? '',
      title: draft.title,
      owner: draft.owner ?? draft.assigneeName ?? props.currentUser.name,
      assigneeId: draft.assigneeId ?? props.currentUser.id,
      assigneeName: draft.assigneeName ?? draft.owner ?? props.currentUser.name,
      source: draft.source ?? '',
      type: draft.type ?? 1,
    })
  },
  { immediate: true },
)

watch(
  () => props.presetCreateKey,
  () => {
    const time = props.presetCreateTime?.trim()
    if (!time) return

    beginCreateForm({
      mode: 'scheduled',
      time,
      endDate: props.date,
    })
  },
  { immediate: true },
)

function createEmptyForm(date = props.date): CalendarTodoForm {
  const assignee = getDefaultAssignee()

  return {
    mode: 'scheduled',
    date,
    endDate: date,
    time: '',
    endTime: '',
    title: '',
    owner: assignee.name,
    assigneeId: assignee.id,
    assigneeName: assignee.name,
    source: '',
    type: 1,
  }
}

function getDefaultAssignee() {
  return (
    props.assignableUsers.find((user) => user.id === props.currentUser.id) ??
    props.assignableUsers[0] ??
    props.currentUser
  )
}

function createFormFromEvent(event: CalendarEvent): CalendarTodoForm {
  return {
    mode: isRangeEvent(event) ? 'deadline' : 'scheduled',
    date: event.date,
    endDate: event.endDate ?? event.date,
    time: event.time ?? '',
    endTime: event.endTime ?? '',
    title: event.title,
    owner: event.owner,
    assigneeId: event.assigneeId ?? props.currentUser.id,
    assigneeName: event.assigneeName ?? event.owner,
    source: event.source ?? '',
    type: event.type === 'meeting' ? 2 : 1,
  }
}

function createFormCopy(form: CalendarTodoForm): CalendarTodoForm {
  return {
    mode: form.mode,
    date: form.date,
    endDate: form.endDate,
    time: form.time,
    endTime: form.endTime,
    title: form.title,
    owner: form.owner,
    assigneeId: form.assigneeId,
    assigneeName: form.assigneeName,
    source: form.source,
    type: form.type,
  }
}

function formSnapshot(form: CalendarTodoForm, prompt = aiPrompt.value) {
  return JSON.stringify({
    form: createFormCopy(form),
    aiPrompt: prompt,
  })
}

function syncFormSnapshot(form = todoForm.value, prompt = aiPrompt.value) {
  initialFormSnapshot.value = formSnapshot(form, prompt)
}

function hideDiscardWarning() {
  discardWarningVisible.value = false
  pendingDiscardAction = undefined
}

function hideDeleteWarning() {
  pendingDeleteId.value = ''
}

function canDeleteEvent(event: CalendarEvent) {
  return Boolean(event.editable)
}

function isStatusUpdating(id: string) {
  return props.statusUpdatingIds?.has(id) ?? false
}

function showDiscardWarning(onConfirm?: () => void) {
  hideDeleteWarning()
  pendingDiscardAction = onConfirm
  discardWarningVisible.value = true
}

function confirmDiscardWarning() {
  const discardAction = pendingDiscardAction
  hideDiscardWarning()
  resetFormState()

  if (discardAction) {
    discardAction()
  }
}

function confirmDiscardChanges(onConfirm?: () => void) {
  if (!hasUnsavedChanges.value) return true
  showDiscardWarning(onConfirm)
  return false
}

function resetListFilters() {
  statusFilter.value = 'all'
  typeFilter.value = 'all'
  scopeFilter.value = 'all'
}

function setStatusFilter(filter: TodoStatusFilter) {
  statusFilter.value = statusFilter.value === filter && filter !== 'all' ? 'all' : filter
}

function applyStatusFilter(filter: TodoStatusFilter) {
  resetFormState()
  statusFilter.value = filter
  typeFilter.value = 'all'
}

function applyTypeFilter(filter: TodoTypeFilter) {
  resetFormState()
  typeFilter.value = filter
  statusFilter.value = 'all'
}

function setTypeFilter(filter: TodoTypeFilter) {
  typeFilter.value = typeFilter.value === filter && filter !== 'all' ? 'all' : filter
}

function setScopeFilter(filter: Exclude<TodoScopeFilter, 'all'>) {
  scopeFilter.value = scopeFilter.value === filter ? 'all' : filter
}

function resetFormState() {
  hideDiscardWarning()
  hideDeleteWarning()
  clearParsedHighlights()
  const nextForm = createEmptyForm(props.date)
  editingId.value = ''
  aiPrompt.value = ''
  aiParsedOriginalText.value = ''
  isParsing.value = false
  isTitleInvalid.value = false
  clearTimeInvalidState()
  todoForm.value = nextForm
  syncFormSnapshot(nextForm)
  panelMode.value = 'list'
  emit('dirtyChange', false)
}

function beginCreateForm(overrides: Partial<CalendarTodoForm> = {}) {
  hideDiscardWarning()
  clearParsedHighlights()
  const nextForm = {
    ...createEmptyForm(props.date),
    ...overrides,
  }
  editingId.value = ''
  aiPrompt.value = ''
  aiParsedOriginalText.value = ''
  isParsing.value = false
  isTitleInvalid.value = false
  clearTimeInvalidState()
  todoForm.value = nextForm
  syncFormSnapshot(nextForm)
  panelMode.value = 'create'
  emit('dirtyChange', false)
}

function openCreateForm() {
  if (!confirmDiscardChanges(beginCreateForm)) return
  beginCreateForm()
}

function shouldOpenViewForm(event: CalendarEvent) {
  return event.status === 'done' || !event.editable
}

function openEventDetail(event: CalendarEvent) {
  if (shouldOpenViewForm(event)) {
    openViewForm(event)
    return
  }

  openEditForm(event)
}

function openViewForm(event: CalendarEvent) {
  if (!confirmDiscardChanges(() => void beginViewForm(event))) return

  void beginViewForm(event)
}

function openEditForm(event: CalendarEvent) {
  if (!event.editable || event.status === 'done') return

  if (!confirmDiscardChanges(() => void beginEditForm(event))) return

  void beginEditForm(event)
}

async function beginViewForm(event: CalendarEvent) {
  clearParsedHighlights()

  let detailEvent = event
  try {
    detailEvent = await loadTodoDetail(event.id, props.currentUser, props.assignableUsers)
  } catch {
    // 列表数据不可用时回退到当前事件
  }

  const nextForm = createFormFromEvent(detailEvent)
  editingId.value = detailEvent.id
  aiPrompt.value = ''
  aiParsedOriginalText.value = ''
  isParsing.value = false
  todoForm.value = nextForm
  syncFormSnapshot(nextForm)
  panelMode.value = 'view'
  emit('dirtyChange', false)
}

async function beginEditForm(event: CalendarEvent) {
  clearParsedHighlights()

  let detailEvent = event
  try {
    detailEvent = await loadTodoDetail(event.id, props.currentUser, props.assignableUsers)
  } catch {
    // 列表数据不可用时回退到当前事件
  }

  const nextForm = createFormFromEvent(detailEvent)
  editingId.value = detailEvent.id
  aiPrompt.value = ''
  aiParsedOriginalText.value = ''
  isParsing.value = false
  isTitleInvalid.value = false
  clearTimeInvalidState()
  todoForm.value = nextForm
  syncFormSnapshot(nextForm)
  panelMode.value = 'edit'
  emit('dirtyChange', false)
}

function requestCancelForm() {
  if (props.formOnly) {
    requestClosePanel()
    return
  }

  if (!confirmDiscardChanges(resetFormState)) return
  resetFormState()
}

function requestClosePanel() {
  if (
    !confirmDiscardChanges(() => {
      resetFormState()
      emit('close')
    })
  )
    return

  resetFormState()
  emit('close')
}

async function parseTodoText() {
  if (!aiPrompt.value.trim()) return

  isParsing.value = true
  try {
    const previousForm = createFormCopy(todoForm.value)
    const parsed = await serviceParseTodoText(
      aiPrompt.value,
      props.currentUser,
      props.assignableUsers,
      todoForm.value,
    )
    const nextForm = {
      ...todoForm.value,
      ...parsed,
      mode: parsed.mode ?? (parsed.endDate ? 'deadline' : 'scheduled'),
      endDate: parsed.endDate ?? parsed.date ?? todoForm.value.endDate,
      time: parsed.time ?? todoForm.value.time,
      endTime: parsed.endTime ?? todoForm.value.endTime,
    }
    todoForm.value = nextForm
    aiParsedOriginalText.value = aiPrompt.value.trim()
    triggerParsedHighlights(previousForm, nextForm)
  } catch (error) {
    emit('notify', error instanceof Error ? error.message : 'AI 解析待办失败，请稍后重试', 'error')
  } finally {
    isParsing.value = false
  }
}

function isAiHighlighted(field: ParsedHighlightField) {
  return highlightedFields.value.has(field)
}

function clearParsedHighlights() {
  if (highlightTimer) {
    clearTimeout(highlightTimer)
    highlightTimer = undefined
  }
  highlightedFields.value = new Set()
}

function triggerParsedHighlights(previousForm: CalendarTodoForm, nextForm: CalendarTodoForm) {
  const fields: ParsedHighlightField[] = []

  if (nextForm.date !== previousForm.date) fields.push('date')

  if (nextForm.mode === 'deadline') {
    if (nextForm.endDate !== previousForm.endDate) fields.push('endDate')
    if (nextForm.time !== previousForm.time) fields.push('time')
    if (nextForm.endTime !== previousForm.endTime) fields.push('endTime')
  } else if (nextForm.time !== previousForm.time) {
    fields.push('time')
  }

  if (nextForm.title !== previousForm.title) fields.push('title')
  if (nextForm.source !== previousForm.source) fields.push('source')

  if (
    canChooseAssignee.value &&
    (nextForm.assigneeId !== previousForm.assigneeId ||
      nextForm.assigneeName !== previousForm.assigneeName)
  ) {
    fields.push('assignee')
  }

  if (nextForm.type !== previousForm.type) fields.push('type')

  if (!fields.length) return

  clearParsedHighlights()
  highlightedFields.value = new Set(fields)
  highlightTimer = setTimeout(clearParsedHighlights, 1300)
}

function setMode(mode: CalendarTodoForm['mode']) {
  todoForm.value.mode = mode
  if (mode === 'scheduled') {
    todoForm.value.endDate = todoForm.value.date
    return
  }

  if (!todoForm.value.endDate || todoForm.value.endDate < todoForm.value.date) {
    todoForm.value.endDate = todoForm.value.date
  }
}

function applyQuickRange(type: 'today' | 'week' | 'nextWeek' | 'month') {
  const start = parseDate(props.date)
  todoForm.value.date = ymd(start)
  todoForm.value.mode = 'deadline'

  if (type === 'today') {
    todoForm.value.endDate = todoForm.value.date
    return
  }

  if (type === 'week') {
    const day = start.getDay() || 7
    todoForm.value.endDate = ymd(addDays(start, 7 - day))
  } else if (type === 'nextWeek') {
    const day = start.getDay() || 7
    todoForm.value.endDate = ymd(addDays(start, 8 - day))
  } else {
    todoForm.value.endDate = ymd(new Date(start.getFullYear(), start.getMonth() + 1, 0))
  }
}

function applyScheduledTime(time: string) {
  todoForm.value.mode = 'scheduled'
  todoForm.value.endDate = todoForm.value.date
  todoForm.value.time = time
}

function syncDateRange() {
  if (todoForm.value.mode === 'scheduled') {
    todoForm.value.endDate = todoForm.value.date
    return
  }

  if (todoForm.value.endDate < todoForm.value.date) {
    todoForm.value.endDate = todoForm.value.date
  }
}

function parseAssigneeIds(value: string) {
  if (!value) return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function selectAssignees(ids: string[]) {
  const selected = ids
    .map((id) => props.assignableUsers.find((user) => user.id === id))
    .filter((user): user is CalendarUser => Boolean(user))

  if (selected.length === 0) {
    todoForm.value.assigneeId = props.currentUser.id
    todoForm.value.assigneeName = props.currentUser.name
    todoForm.value.owner = props.currentUser.name
    return
  }

  todoForm.value.assigneeId = selected.map((user) => user.id).join(',')
  todoForm.value.assigneeName = selected.map((user) => user.name).join('、')
  todoForm.value.owner = todoForm.value.assigneeName
}

function setTodoType(type: 1 | 2) {
  todoForm.value.type = type
}

function submitTodo() {
  if (!canEditForm.value) return

  if (!todoForm.value.title.trim()) {
    isTitleInvalid.value = true
    return
  }

  isTitleInvalid.value = false

  if (panelMode.value === 'create' && !isCreateTimeValid(todoForm.value)) {
    setCreateTimeInvalidState(todoForm.value)
    return
  }

  clearTimeInvalidState()

  const payload = createFormCopy(todoForm.value)

  if (panelMode.value === 'edit' && editingId.value) {
    emit('updateTodo', {
      id: editingId.value,
      date: payload.date,
      endDate: payload.mode === 'deadline' ? payload.endDate : undefined,
      time: payload.time || undefined,
      endTime: payload.mode === 'deadline' ? payload.endTime || undefined : undefined,
      title: payload.title,
      owner: payload.owner || '未指定',
      source: payload.source,
      assigneeId: payload.assigneeId,
      assigneeName: payload.assigneeName,
      type: payload.type,
    })
  } else {
    emit('createTodo', {
      date: payload.date,
      endDate: payload.mode === 'deadline' ? payload.endDate : undefined,
      time: payload.time || undefined,
      endTime: payload.mode === 'deadline' ? payload.endTime || undefined : undefined,
      title: payload.title,
      aiPrompt: aiParsedOriginalText.value || undefined,
      owner: payload.owner,
      source: payload.source,
      assigneeId: payload.assigneeId,
      assigneeName: payload.assigneeName,
      type: payload.type,
    })
  }

  if (props.formOnly) {
    syncFormSnapshot()
    hideDiscardWarning()
  } else {
    resetFormState()
  }
}

function requestDeleteTodo(event: CalendarEvent) {
  if (!canDeleteEvent(event)) return
  hideDiscardWarning()
  pendingDeleteId.value = event.id
}

function confirmDeleteWarning() {
  const id = pendingDeleteId.value
  hideDeleteWarning()
  if (!id) return

  emit('deleteTodo', id)
}

function toggleStatus(event: CalendarEvent) {
  if (!event.completable || isStatusUpdating(event.id)) return
  emit('updateStatus', event.id, event.status === 'done' ? 'todo' : 'done')
}

function openEventDetailById(id: string) {
  const event = props.events.find((item) => item.id === id)
  if (!event) return false

  openEventDetail(event)
  return true
}

function openEditFormById(id: string) {
  const event = props.events.find((item) => item.id === id)
  if (!event) return false

  if (!confirmDiscardChanges(() => void beginEditForm(event))) return false

  void beginEditForm(event)
  return true
}

defineExpose({
  openCreateForm,
  openEventDetailById,
  openEditFormById,
  showDiscardWarning,
  applyStatusFilter,
  applyTypeFilter,
})
</script>

<template>
  <section
    class="preview-panel"
    :class="{ 'is-form-mode': isFormMode, 'is-view-mode': isViewMode }"
  >
    <header class="preview-head">
      <div>
        <p v-if="isViewMode">查看安排</p>
        <p v-else-if="!isFormMode">待办详情</p>
        <h2>{{ isFormMode ? formTitle : props.dateLabel }}</h2>
      </div>
      <div class="preview-head-actions">
        <button
          v-if="showClose"
          class="close-btn"
          :class="{ 'is-back': isFormMode && !formOnly }"
          type="button"
          :aria-label="isFormMode && !formOnly ? '返回待办列表' : '关闭'"
          @click="isFormMode ? requestCancelForm() : requestClosePanel()"
        >
          <IconArrowLeft v-if="isFormMode && !formOnly" aria-hidden="true" />
          <IconX v-else aria-hidden="true" />
        </button>
      </div>
    </header>

    <template v-if="!isFormMode">
      <div class="summary-grid" role="group" aria-label="当天待办概览">
        <button
          type="button"
          class="summary-card summary-total"
          :class="{ active: statusFilter === 'all' }"
          :aria-pressed="statusFilter === 'all'"
          @click="setStatusFilter('all')"
        >
          <strong>{{ totalCount }}</strong>
          <span class="summary-label">
            <span>待办总数</span>
            <small v-if="rejectedCount">含 {{ rejectedCount }} 项已拒绝</small>
          </span>
        </button>
        <button
          type="button"
          class="summary-card summary-pending"
          :class="{ active: statusFilter === 'pending' }"
          :aria-pressed="statusFilter === 'pending'"
          @click="setStatusFilter('pending')"
        >
          <strong>{{ pendingCount }}</strong>
          <span class="summary-label">
            <span>待处理</span>
          </span>
        </button>
        <button
          type="button"
          class="summary-card summary-done"
          :class="{ active: statusFilter === 'done' }"
          :aria-pressed="statusFilter === 'done'"
          @click="setStatusFilter('done')"
        >
          <strong>{{ doneCount }}</strong>
          <span class="summary-label">
            <span>已完成</span>
          </span>
        </button>
      </div>

      <div class="type-filter-toolbar" :class="{ 'has-scope-filters': hasScopeFilters }">
        <div class="type-filter-row" role="group" aria-label="待办类型筛选">
          <button
            type="button"
            class="type-filter-chip type-all"
            :class="{ active: typeFilter === 'all' }"
            :aria-pressed="typeFilter === 'all'"
            @click="setTypeFilter('all')"
          >
            <span class="type-filter-label"> 全部 </span>
            <span class="type-filter-count">{{ eventsForTypeCounts.length }}</span>
          </button>
          <button
            type="button"
            class="type-filter-chip type-task"
            :class="{ active: typeFilter === 'task' }"
            :aria-pressed="typeFilter === 'task'"
            @click="setTypeFilter('task')"
          >
            <span class="type-filter-label"> 待办 </span>
            <span class="type-filter-count">{{ taskTypeCount }}</span>
          </button>
          <button
            type="button"
            class="type-filter-chip type-meeting"
            :class="{ active: typeFilter === 'meeting' }"
            :aria-pressed="typeFilter === 'meeting'"
            @click="setTypeFilter('meeting')"
          >
            <span class="type-filter-label"> 会议 </span>
            <span class="type-filter-count">{{ meetingTypeCount }}</span>
          </button>
        </div>

        <template v-if="hasScopeFilters">
          <span class="type-filter-divider" aria-hidden="true"></span>
          <div class="scope-filter-panel" role="group" aria-label="派发来源筛选">
            <span class="scope-filter-kicker">派发</span>
            <div class="scope-filter-row">
              <button
                v-if="assignedByMeCount > 0"
                type="button"
                class="scope-filter-chip scope-outgoing"
                :class="{ active: scopeFilter === 'assigned_by_me' }"
                :aria-pressed="scopeFilter === 'assigned_by_me'"
                @click="setScopeFilter('assigned_by_me')"
              >
                <span class="scope-filter-label">我派发</span>
                <span class="scope-filter-count">{{ assignedByMeCount }}</span>
              </button>
              <button
                v-if="assignedToMeCount > 0"
                type="button"
                class="scope-filter-chip scope-incoming"
                :class="{ active: scopeFilter === 'assigned_to_me' }"
                :aria-pressed="scopeFilter === 'assigned_to_me'"
                @click="setScopeFilter('assigned_to_me')"
              >
                <span class="scope-filter-label">派给我</span>
                <span class="scope-filter-count">{{ assignedToMeCount }}</span>
              </button>
            </div>
          </div>
        </template>
      </div>

      <p v-if="hasActiveFilters" class="filter-hint">
        当前展示 {{ filteredEvents.length }} 项
        <button type="button" @click="resetListFilters">清除筛选</button>
      </p>

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

      <div v-if="filteredEvents.length" class="timeline">
        <article
          v-for="event in filteredEvents"
          :key="event.id"
          class="timeline-item"
          :class="[
            `type-${event.type}`,
            `status-${event.status}`,
            event.scope ? `scope-${event.scope}` : '',
            { 'is-rejected': isRejectedTodo(event) },
            { 'is-deleting': pendingDeleteId === event.id },
          ]"
          tabindex="0"
          @click="openEventDetail(event)"
          @keydown.enter.prevent="openEventDetail(event)"
        >
          <EventScheduleTime :event="event" />
          <div class="event-body">
            <div class="event-title-row">
              <div class="event-title-block">
                <h3>{{ getTodoListDisplayText(event) }}</h3>
                <div class="event-meta-row">
                  <span
                    class="event-kind"
                    :class="isMeetingEvent(event) ? 'is-meeting' : 'is-task'"
                  >
                    {{ eventTypeLabel(event) }}
                  </span>
                  <span
                    v-if="getTodoScopeBadge(event)"
                    class="todo-scope-badge scope-badge"
                    :class="`tone-${getTodoScopeBadge(event)!.tone}`"
                  >
                    {{ getTodoScopeBadge(event)!.label }}
                  </span>
                  <span
                    class="event-status"
                    :class="{
                      'is-done': event.status === 'done',
                      'is-rejected': isRejectedTodo(event),
                    }"
                  >
                    {{ statusText(event) }}
                  </span>
                </div>
              </div>
            </div>
            <div v-if="shouldShowEventMeta(event)" class="event-note">
              <p
                v-if="isRejectedTodo(event) && getRejectedTodoMessage(event)"
                class="event-reject-note"
              >
                {{ getRejectedTodoMessage(event) }}
              </p>
              <p v-if="event.source">备注：{{ event.source }}</p>
            </div>
          </div>
          <div class="item-actions">
            <template v-if="pendingDeleteId === event.id">
              <span class="delete-confirm-text">确定删除？</span>
              <button class="edit-action" type="button" @click.stop="hideDeleteWarning">
                取消
              </button>
              <button class="delete-action" type="button" @click.stop="confirmDeleteWarning">
                确认
              </button>
            </template>
            <template v-else>
              <button
                v-if="event.completable"
                class="status-toggle"
                type="button"
                :class="{
                  'is-done': event.status === 'done',
                  'is-syncing': isStatusUpdating(event.id),
                }"
                :disabled="isStatusUpdating(event.id)"
                :aria-busy="isStatusUpdating(event.id)"
                @click.stop="toggleStatus(event)"
              >
                <span aria-hidden="true">{{ event.status === 'done' ? '✓' : '' }}</span>
                {{
                  isStatusUpdating(event.id)
                    ? '处理中...'
                    : event.status === 'done'
                      ? '撤销'
                      : '完成'
                }}
              </button>
              <button
                v-if="shouldOpenViewForm(event)"
                class="edit-action is-view"
                type="button"
                @click.stop="openViewForm(event)"
              >
                查看
              </button>
              <button v-else class="edit-action" type="button" @click.stop="openEditForm(event)">
                编辑
              </button>
              <button
                v-if="canDeleteEvent(event)"
                class="delete-action"
                type="button"
                @click.stop="requestDeleteTodo(event)"
              >
                删除
              </button>
            </template>
          </div>
        </article>
      </div>

      <div v-else-if="isFilterEmpty" class="empty empty-filtered">
        <span class="empty-icon" aria-hidden="true">
          <IconCalendarPlus />
        </span>
        <div class="empty-copy">
          <h3>当前筛选下暂无事项</h3>
          <p>试试切换状态或类型筛选，或清除筛选查看全部安排。</p>
          <button type="button" class="empty-reset-btn" @click="resetListFilters">清除筛选</button>
        </div>
      </div>

      <div v-else class="empty">
        <span class="empty-icon" aria-hidden="true">
          <IconCalendarPlus />
        </span>
        <div class="empty-copy">
          <h3>当天暂无待办</h3>
          <p>安排一个待办，或选择其他日期查看日程。</p>
        </div>
      </div>

      <button class="add-btn floating-add-btn" type="button" @click="openCreateForm">
        <IconPlus aria-hidden="true" />
        <span>新增</span>
      </button>
    </template>

    <form v-else class="inline-todo-form" :aria-busy="isParsing" @submit.prevent="submitTodo">
      <Transition name="discard-warning">
        <div v-if="discardWarningVisible" class="inline-discard-warning" role="alert">
          <div>
            <strong>当前待办内容还没有保存</strong>
            <p>放弃后，本次填写的内容不会保存。</p>
          </div>
          <div class="discard-warning-actions">
            <button type="button" @click="hideDiscardWarning">继续编辑</button>
            <button class="discard-confirm" type="button" @click="confirmDiscardWarning">
              放弃修改
            </button>
          </div>
        </div>
      </Transition>

      <div class="inline-todo-form-body">
        <section
          v-if="canEditForm"
          class="inline-section ai-inline-section"
          :class="{ 'is-parsing': isParsing }"
          :aria-busy="isParsing"
          data-tour-target="todo-ai-parser"
        >
          <label class="field field-full">
            <span>一句话创建待办</span>
            <div class="ai-inline-row">
              <Input
                v-model="aiPrompt"
                type="text"
                :disabled="isParsing"
                :aria-describedby="isParsing ? 'ai-parse-status-title' : undefined"
                placeholder="例如：明天下午给XXX布置一项开发公司官方网站的任务"
              />
              <Button
                type="button"
                :class="{ 'is-parsing': isParsing }"
                :disabled="isParsing || !aiPrompt.trim()"
                @click="parseTodoText"
              >
                <span v-if="isParsing" class="ai-button-dots" aria-hidden="true">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
                {{ isParsing ? '解析中' : 'AI 解析' }}
              </Button>
            </div>
          </label>
          <Transition name="ai-parse-status">
            <AiParseStatus v-if="isParsing" />
          </Transition>
        </section>

        <section
          class="inline-section todo-details-section"
          :class="{ 'is-readonly': isViewMode }"
          :aria-disabled="isFormReadonly"
          data-tour-target="todo-detail-fields"
        >
          <div class="basic-info-layout" :inert="isFormReadonly">
            <div class="basic-info-columns">
              <div class="basic-info-column type-info-column">
                <label class="mode-switch-field">
                  <span>事项类型</span>
                  <div class="mode-switch" role="group" aria-label="事项类型">
                    <button
                      type="button"
                      class="is-todo-type"
                      :class="{
                        active: todoForm.type === 1,
                        'is-ai-highlighted': isAiHighlighted('type'),
                      }"
                      :disabled="isFormReadonly"
                      @click="setTodoType(1)"
                    >
                      待办
                    </button>
                    <button
                      type="button"
                      class="is-meeting-type"
                      :class="{
                        active: todoForm.type === 2,
                        'is-ai-highlighted': isAiHighlighted('type'),
                      }"
                      :disabled="isFormReadonly"
                      @click="setTodoType(2)"
                    >
                      会议
                    </button>
                  </div>
                </label>
              </div>

              <div
                class="basic-info-column schedule-info-column"
                :class="{ 'is-deadline-mode': isDeadlineMode }"
              >
                <label class="mode-switch-field">
                  <span>时间模式</span>
                  <div class="mode-switch" role="group" aria-label="时间模式">
                    <button
                      type="button"
                      class="is-scheduled-mode"
                      :class="{ active: todoForm.mode === 'scheduled' }"
                      :disabled="isFormReadonly"
                      @click="setMode('scheduled')"
                    >
                      指定时间
                    </button>
                    <button
                      type="button"
                      class="is-deadline-mode"
                      :class="{ active: todoForm.mode === 'deadline' }"
                      :disabled="isFormReadonly"
                      @click="setMode('deadline')"
                    >
                      截止日期
                    </button>
                  </div>
                </label>
              </div>
            </div>

            <div class="schedule-field-panel" :class="{ 'is-deadline-panel': isDeadlineMode }">
              <div class="schedule-mode-shell">
                <div v-if="!isDeadlineMode" key="scheduled" class="schedule-mode-panel">
                  <div class="scheduled-time-fields">
                    <label class="field">
                      <span>日期</span>
                      <TodoDatePicker
                        v-model="todoForm.date"
                        class="soft-picker"
                        :disabled="isFormReadonly"
                        :highlighted="isAiHighlighted('date')"
                        aria-label="选择待办日期"
                        @change="syncDateRange"
                      />
                    </label>
                    <label class="field">
                      <span>时间</span>
                      <TodoTimePicker
                        v-model="todoForm.time"
                        class="soft-picker"
                        :disabled="isFormReadonly"
                        :highlighted="isAiHighlighted('time')"
                        :invalid="isScheduledTimeInvalid"
                        aria-label="选择待办时间"
                      />
                    </label>
                  </div>
                  <div class="quick-time-row" aria-label="快捷时间">
                    <button
                      v-for="preset in scheduledTimePresets"
                      :key="preset.value"
                      type="button"
                      :class="{ active: todoForm.time === preset.value }"
                      :disabled="isFormReadonly"
                      @click="applyScheduledTime(preset.value)"
                    >
                      {{ preset.label }}
                    </button>
                  </div>
                </div>
                <div v-else key="deadline" class="schedule-mode-panel">
                  <TodoDeadlineDateTimeRange
                    v-model:start-date="todoForm.date"
                    v-model:start-time="todoForm.time"
                    v-model:end-date="todoForm.endDate"
                    v-model:end-time="todoForm.endTime"
                    class="field-full"
                    :disabled="isFormReadonly"
                    :start-highlighted="isAiHighlighted('date') || isAiHighlighted('time')"
                    :end-highlighted="isAiHighlighted('endDate') || isAiHighlighted('endTime')"
                    :start-invalid="isDeadlineStartTimeInvalid"
                    :end-invalid="isDeadlineEndTimeInvalid"
                    @change="syncDateRange"
                  />
                  <div class="quick-range-row field-full" aria-label="快捷时间">
                    <button
                      type="button"
                      :disabled="isFormReadonly"
                      @click="applyQuickRange('today')"
                    >
                      今天
                    </button>
                    <button
                      type="button"
                      :disabled="isFormReadonly"
                      @click="applyQuickRange('week')"
                    >
                      本周内
                    </button>
                    <button
                      type="button"
                      :disabled="isFormReadonly"
                      @click="applyQuickRange('nextWeek')"
                    >
                      下周前
                    </button>
                    <button
                      type="button"
                      :disabled="isFormReadonly"
                      @click="applyQuickRange('month')"
                    >
                      本月内
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-grid">
              <label v-if="canChooseAssignee" class="field field-full">
                <span>负责人</span>
                <TodoAssigneeSelect
                  :model-value="parseAssigneeIds(todoForm.assigneeId)"
                  :users="assignableUsers"
                  :disabled="isFormReadonly"
                  :highlighted="isAiHighlighted('assignee')"
                  @update:model-value="selectAssignees"
                />
              </label>
              <label class="field field-full">
                <span>待办内容</span>
                <Input
                  v-model="todoForm.title"
                  :class="{
                    'is-ai-highlighted': isAiHighlighted('title'),
                    'is-field-invalid': isTitleInvalid,
                  }"
                  :aria-invalid="isTitleInvalid || undefined"
                  type="text"
                  :disabled="isFormReadonly"
                  :readonly="isViewMode"
                  placeholder="输入待办内容"
                />
              </label>
              <label class="field field-full">
                <span>备注</span>
                <Input
                  v-model="todoForm.source"
                  :class="{ 'is-ai-highlighted': isAiHighlighted('source') }"
                  type="text"
                  :disabled="isFormReadonly"
                  :readonly="isViewMode"
                  placeholder="备注或来源"
                />
              </label>
            </div>
          </div>
        </section>
      </div>

      <div
        class="form-actions"
        :class="{ 'is-single-action': isViewMode }"
        data-tour-target="todo-save-actions"
      >
        <template v-if="isViewMode">
          <Button type="button" @click="requestCancelForm">返回</Button>
        </template>
        <template v-else>
          <Button type="button" :disabled="isParsing" @click="requestCancelForm">取消</Button>
          <Button type="submit">保存</Button>
        </template>
      </div>
    </form>
  </section>
</template>

<style scoped>
.preview-panel {
  --todo-primary: #3b82f6;
  --todo-primary-hover: #2563eb;
  --todo-primary-rgb: 59, 130, 246;
  --todo-surface: rgba(255, 255, 255, 0.84);
  --todo-surface-strong: rgba(255, 255, 255, 0.94);
  --todo-surface-soft: rgba(248, 250, 252, 0.66);
  --todo-line: rgba(226, 232, 240, 0.76);
  --todo-text: #101936;
  --todo-muted: #8795aa;
  position: relative;
  height: 100%;
  width: 100%;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  padding: 2px 2px 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-x: clip;
}

.preview-panel.is-form-mode {
  --form-green-rgb: 34, 197, 94;
  --form-sky-rgb: 14, 165, 233;
  --form-amber-rgb: 245, 158, 11;
  --form-surface: rgba(255, 255, 255, 0.72);
  --form-surface-strong: rgba(255, 255, 255, 0.92);
  --form-border: rgba(203, 213, 225, 0.72);
  --form-module-bg: linear-gradient(
    135deg,
    rgba(var(--todo-primary-rgb), 0.07),
    rgba(239, 246, 255, 0.88)
  );
  --form-module-border: rgba(var(--todo-primary-rgb), 0.1);
  gap: 0;
  padding: 0;
  border-radius: 22px;
  background: linear-gradient(165deg, rgba(255, 255, 255, 0.84), rgba(239, 246, 255, 0.62));
  border: 1px solid rgba(255, 255, 255, 0.82);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 18px 36px -28px rgba(38, 67, 109, 0.22);
  overflow: hidden;
}

.preview-head {
  min-width: 0;
  padding: 0 0 12px;
  border-bottom: 1px dashed rgba(148, 163, 184, 0.34);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.preview-panel.is-form-mode .preview-head {
  flex: 0 0 auto;
  align-items: flex-start;
  padding: 18px 20px 16px;
  border-bottom: 1px solid rgba(var(--todo-primary-rgb), 0.1);
  background: linear-gradient(135deg, rgba(239, 246, 255, 0.82), rgba(255, 255, 255, 0.48));
}

.preview-head > div:first-child {
  min-width: 0;
}

.preview-head-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex: 0 0 auto;
}

.preview-head p {
  margin: 0 0 7px;
  font-size: 12px;
  font-weight: 760;
  color: #8a6a35;
}

.preview-panel.is-form-mode .preview-head p {
  margin: 0 0 6px;
  color: var(--todo-muted);
  font-size: 11px;
  font-weight: 760;
  letter-spacing: 0.4px;
}

.preview-head h2 {
  margin: 0;
  color: #1f2937;
  font-size: 25px;
  font-weight: 850;
  line-height: 1.08;
  overflow-wrap: anywhere;
}

.preview-panel.is-form-mode .preview-head h2 {
  color: var(--todo-primary);
  font-size: 17px;
  font-weight: 850;
  line-height: 1.2;
  letter-spacing: 0;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.summary-card {
  min-height: 58px;
  box-sizing: border-box;
  border: 1px solid #e5ebf2;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.92);
  color: #64748b;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  text-align: left;
  box-shadow: 0 8px 18px -22px rgba(15, 23, 42, 0.4);
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.summary-card strong {
  min-width: 28px;
  color: #1f2937;
  font-size: 24px;
  line-height: 1;
  font-weight: 950;
  letter-spacing: 0;
  text-align: center;
}

.summary-label {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  color: #475569;
  line-height: 1.15;
  white-space: nowrap;
}

.summary-card small {
  color: #b91c1c;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
}

.summary-card:hover {
  border-color: #cbd5e1;
  background: #ffffff;
  box-shadow: 0 12px 22px -24px rgba(15, 23, 42, 0.56);
  transform: translateY(-1px);
}

.summary-card:focus-visible {
  outline: 2px solid rgba(var(--todo-primary-rgb), 0.24);
  outline-offset: 3px;
}

.summary-card.active {
  border-color: rgba(var(--todo-primary-rgb), 0.28);
  background: #f8fbff;
  box-shadow:
    inset 0 0 0 1px rgba(var(--todo-primary-rgb), 0.08),
    0 10px 22px -24px rgba(var(--todo-primary-rgb), 0.55);
}

.summary-card.active strong,
.summary-card.active .summary-label {
  color: var(--todo-primary-hover);
}

.summary-card:active {
  transform: translateY(0);
}

.type-filter-toolbar {
  display: flex;
  align-items: stretch;
  gap: 0;
  border-bottom: 1px solid #e5ebf2;
  background: transparent;
}

.type-filter-toolbar.has-scope-filters .type-filter-row {
  flex: 3 1 0;
  min-width: 0;
}

.type-filter-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  border-bottom: 0;
  background: transparent;
  padding: 0 4px;
}

.type-filter-divider {
  flex: 0 0 1px;
  align-self: stretch;
  margin: 8px 0;
  background: rgba(148, 163, 184, 0.28);
}

.type-filter-chip {
  min-width: 0;
  min-height: 38px;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  background: transparent;
  color: #64748b;
  padding: 0 12px 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font: inherit;
  font-size: 13px;
  font-weight: 850;
  cursor: pointer;
  transition:
    border-bottom-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
}

.type-filter-label {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  white-space: nowrap;
}

.type-filter-count {
  min-width: 20px;
  height: 20px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.07);
  color: #475569;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 850;
  line-height: 1;
}

.type-filter-chip:hover:not(.active) {
  color: #1e293b;
}

.type-filter-chip:focus-visible {
  outline: 2px solid rgba(var(--todo-primary-rgb), 0.22);
  outline-offset: 2px;
}

.type-filter-chip.active {
  border-bottom-color: var(--todo-primary);
  color: #0f172a;
}

.type-filter-chip.active .type-filter-count {
  background: #eaf2ff;
  color: var(--todo-primary-hover);
}

.scope-filter-panel {
  flex: 2 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  padding: 0 8px 0 4px;
}

.scope-filter-kicker {
  color: #7b8798;
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 0.02em;
  line-height: 1;
  white-space: nowrap;
}

.scope-filter-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  gap: 6px;
  min-width: 0;
}

.scope-filter-label {
  white-space: nowrap;
}

.scope-filter-chip {
  min-height: 32px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: #475569;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}

.scope-filter-count {
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.07);
  color: #475569;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 850;
  line-height: 1;
}

.scope-filter-chip.scope-outgoing.active {
  border-color: rgba(14, 116, 144, 0.28);
  background: rgba(236, 254, 255, 0.96);
  color: #0e7490;
  box-shadow: 0 4px 12px rgba(14, 116, 144, 0.08);
}

.scope-filter-chip.scope-outgoing.active .scope-filter-count {
  background: rgba(14, 116, 144, 0.12);
  color: #0e7490;
}

.scope-filter-chip.scope-incoming.active {
  border-color: rgba(217, 119, 6, 0.28);
  background: rgba(255, 251, 235, 0.98);
  color: #b45309;
  box-shadow: 0 4px 12px rgba(217, 119, 6, 0.08);
}

.scope-filter-chip.scope-incoming.active .scope-filter-count {
  background: rgba(217, 119, 6, 0.12);
  color: #b45309;
}

.filter-hint {
  margin: -2px 0 0;
  color: #64748b;
  font-size: 12px;
  font-weight: 750;
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-hint button {
  border: 0;
  background: transparent;
  color: var(--todo-primary);
  padding: 0;
  font: inherit;
  font-size: 12px;
  font-weight: 820;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.filter-hint button:hover {
  color: var(--todo-primary-hover);
}

.event-kind {
  min-height: 20px;
  border-radius: 999px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 850;
  line-height: 1;
}

.event-kind.is-task {
  background: rgba(218, 247, 232, 0.86);
  color: #08724f;
}

.event-kind.is-meeting {
  background: rgba(219, 234, 254, 0.92);
  color: #2f66c9;
}

.empty-filtered .empty-copy {
  align-items: center;
  text-align: center;
}

.empty-reset-btn {
  margin-top: 4px;
  min-height: 32px;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  background: #ffffff;
  color: #334155;
  padding: 0 14px;
  font: inherit;
  font-size: 12px;
  font-weight: 820;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease;
}

.empty-reset-btn:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.add-btn,
.close-btn,
.item-actions button,
.form-actions button,
.discard-warning-actions button,
.ai-inline-row button {
  min-height: 30px;
  border: 1px solid #e5edf6;
  border-radius: 999px;
  background: #ffffff;
  color: #475569;
  padding: 0 12px;
  font: inherit;
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}

.add-btn,
.form-actions button[type='submit'],
.ai-inline-row button {
  border-color: var(--todo-primary);
  background: var(--todo-primary);
  color: #ffffff;
}

.floating-add-btn {
  position: absolute;
  right: 18px;
  bottom: 18px;
  z-index: 20;
  min-height: 44px;
  padding: 0 18px 0 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  box-shadow:
    0 18px 28px -18px rgba(var(--todo-primary-rgb), 0.78),
    0 6px 14px -12px rgba(15, 23, 42, 0.32);
}

.floating-add-btn svg {
  width: 16px;
  height: 16px;
  stroke-width: 3;
}

.floating-add-btn span {
  white-space: nowrap;
}

.close-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 999px;
  color: #64748b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  flex: 0 0 auto;
}

.preview-panel.is-form-mode .close-btn {
  width: 36px;
  height: 36px;
  border-color: rgba(var(--todo-primary-rgb), 0.12);
  border-radius: 12px;
  color: #60708d;
  background: rgba(255, 255, 255, 0.76);
}

.preview-panel.is-form-mode .close-btn:hover {
  border-color: rgba(var(--todo-primary-rgb), 0.22);
  background: rgba(239, 246, 255, 0.92);
  color: var(--todo-primary-hover);
}

.close-btn svg {
  width: 18px;
  height: 18px;
  stroke-width: 3;
}

.add-btn:hover,
.close-btn:hover,
.item-actions button:hover,
.form-actions button:hover,
.discard-warning-actions button:not(.discard-confirm):hover,
.ai-inline-row button:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
  color: #111827;
}

.item-actions button:disabled {
  cursor: wait;
  opacity: 0.68;
}

.item-actions button:disabled:hover {
  border-color: #e5edf6;
  background: #ffffff;
  color: #475569;
}

.add-btn:hover,
.form-actions button[type='submit']:not(:disabled):hover,
.ai-inline-row button:not(:disabled):hover {
  border-color: var(--todo-primary-hover);
  background: var(--todo-primary-hover);
  color: #ffffff;
}

.form-actions button:disabled,
.ai-inline-row button:disabled {
  border-color: #e5edf6;
  background: #f1f5f9;
  color: #94a3b8;
  cursor: not-allowed;
  box-shadow: none;
}

.special-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.special-chip {
  min-height: 23px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 860;
}

.special-holiday {
  background: rgba(254, 226, 226, 0.58);
  border-color: rgba(185, 28, 28, 0.1);
  color: #b91c1c;
}

.special-workday {
  background: rgba(226, 232, 240, 0.66);
  border-color: rgba(75, 85, 99, 0.08);
  color: #4b5563;
}

.special-solar-term {
  background: rgba(204, 251, 241, 0.58);
  border-color: rgba(15, 118, 110, 0.1);
  color: #0f766e;
}

.timeline {
  position: relative;
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 4px 72px 0;
}

.timeline::-webkit-scrollbar,
.inline-todo-form-body::-webkit-scrollbar {
  width: 6px;
}

.timeline::-webkit-scrollbar-thumb,
.inline-todo-form-body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.42);
}

.timeline::-webkit-scrollbar-track,
.inline-todo-form-body::-webkit-scrollbar-track {
  background: transparent;
}

.timeline-item {
  position: relative;
  z-index: 0;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid rgba(226, 232, 240, 0.82);
  border-radius: 14px;
  background: #ffffff;
  padding: 11px 8px;
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 12px;
  cursor: default;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.timeline-item:hover,
.timeline-item.is-deleting {
  z-index: 1;
  border: 1px solid rgba(191, 219, 254, 0.68);
  background: #ffffff;
  box-shadow: 0 14px 26px -28px rgba(15, 23, 42, 0.34);
}

.timeline-item:focus-visible {
  z-index: 1;
  outline: 2px solid rgba(79, 124, 255, 0.3);
  outline-offset: 4px;
}

.timeline-item :deep(.event-schedule) {
  align-self: start;
  padding-top: 1px;
  color: #c2410c;
}

.event-body {
  position: relative;
  min-width: 0;
  padding: 0 0 0 14px;
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
  opacity: 0.66;
}

.event-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.dispatch-target {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
}

.scope-badge {
  min-height: 20px;
}

.timeline-item.scope-assigned_by_me {
  margin: 2px 0;
  border-radius: 14px;
  background: linear-gradient(90deg, rgba(236, 254, 255, 0.72), rgba(255, 255, 255, 0)), #ffffff;
}

.timeline-item.scope-assigned_to_me {
  margin: 2px 0;
  border-radius: 14px;
  background: linear-gradient(90deg, rgba(255, 251, 235, 0.82), rgba(255, 255, 255, 0)), #ffffff;
}

.timeline-item.status-done .event-body::before {
  background: #16a34a;
  box-shadow: 0 0 0 5px rgba(34, 197, 94, 0.12);
  opacity: 0.86;
}

.timeline-item.status-done h3 {
  color: #64748b;
  text-decoration: line-through;
  text-decoration-color: rgba(22, 101, 52, 0.36);
  text-decoration-thickness: 1.5px;
}

.timeline-item.status-done p {
  color: #94a3b8;
  opacity: 0.78;
}

.timeline-item.status-done {
  color: #64748b;
  border-radius: 14px;
  background: linear-gradient(
      90deg,
      rgba(220, 252, 231, 0.46),
      rgba(248, 250, 252, 0.68) 48%,
      rgba(255, 255, 255, 0) 100%
    ),
    #ffffff;
}

.timeline-item.status-done.type-meeting {
  background: linear-gradient(
      90deg,
      rgba(219, 234, 254, 0.52),
      rgba(248, 250, 252, 0.68) 48%,
      rgba(255, 255, 255, 0) 100%
    ),
    #ffffff;
}

.timeline-item.status-done.type-meeting .event-body::before {
  background: #3478f6;
  box-shadow: 0 0 0 5px rgba(52, 120, 246, 0.12);
}

.timeline-item.status-done.type-meeting h3 {
  text-decoration-color: rgba(29, 78, 216, 0.32);
}

.timeline-item.status-done.type-meeting .event-kind.is-meeting {
  background: rgba(219, 234, 254, 0.92);
  color: #1d4ed8;
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.22);
}

.timeline-item.status-done.type-meeting .event-status.is-done {
  border: 1px solid rgba(37, 99, 235, 0.22);
  background: rgba(219, 234, 254, 0.92);
  color: #1d4ed8;
}

.timeline-item.status-done:hover .item-actions,
.timeline-item.status-done:focus-within .item-actions,
.timeline-item.status-done.is-deleting .item-actions {
  background: linear-gradient(
    to right,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.9) 25px,
    rgba(255, 255, 255, 1) 40px
  );
}

.timeline-item.is-rejected {
  background: linear-gradient(90deg, rgba(254, 242, 242, 0.82), rgba(255, 255, 255, 0)), #ffffff;
}

.timeline-item.is-rejected:hover .item-actions,
.timeline-item.is-rejected:focus-within .item-actions,
.timeline-item.is-rejected.is-deleting .item-actions {
  background: linear-gradient(
    to right,
    rgba(254, 242, 242, 0) 0%,
    rgba(254, 242, 242, 0.9) 25px,
    rgba(254, 242, 242, 1) 40px
  );
}

.timeline-item.is-rejected h3 {
  color: #991b1b;
}

h3 {
  margin: 0;
  color: #1f2937;
  font-size: 14px;
  font-weight: 780;
  line-height: 1.32;
  min-width: 0;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

p {
  margin: 6px 0 0;
  color: #6b7280;
  font-size: 12px;
  line-height: 1.45;
}

.event-note {
  display: grid;
  gap: 2px;
  margin-top: 6px;
}

.event-note p {
  margin: 0;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  line-clamp: 1;
}

.event-reject-note {
  color: #b91c1c;
  font-weight: 850;
}

.event-title-row {
  min-width: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  align-items: center;
  position: relative;
}

.event-title-block {
  min-width: 0;
  display: grid;
  gap: 6px;
}

.event-status {
  width: fit-content;
  min-height: 22px;
  border-radius: 999px;
  background: #eff6ff;
  color: var(--todo-primary-hover);
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}

.event-status.is-done {
  border: 1px solid rgba(22, 163, 74, 0.24);
  background: rgba(220, 252, 231, 0.9);
  color: #166534;
}

.event-status.is-rejected {
  background: #fee2e2;
  color: #b91c1c;
}

.item-actions {
  display: flex;
  gap: 8px;
  align-items: center;

  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  padding: 6px 8px 6px 40px;
  border-radius: 0 14px 14px 0;
  z-index: 10;

  /* 添加一个从左到右过渡的渐变背景，作为底部文本的遮罩 */
  background: linear-gradient(
    to right,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.9) 25px,
    rgba(255, 255, 255, 1) 40px
  );

  opacity: 0;
  visibility: hidden;
  transform: translateX(-8px);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.timeline-item:hover .item-actions,
.timeline-item:focus-within .item-actions,
.timeline-item.is-deleting .item-actions {
  background: linear-gradient(
    to right,
    rgba(248, 250, 252, 0) 0%,
    rgba(248, 250, 252, 0.9) 25px,
    rgba(248, 250, 252, 1) 40px
  );
  opacity: 1;
  visibility: visible;
  transform: translateX(0);
}

.delete-confirm-text {
  font-size: 13px;
  font-weight: 800;
  color: #be123c;
  margin-right: 2px;
}

.status-toggle {
  gap: 6px;
  display: inline-flex;
  align-items: center;
}

.status-toggle span {
  width: 15px;
  height: 15px;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 10px;
  line-height: 1;
}

.status-toggle.is-done span {
  border-color: #16a34a;
  background: #16a34a;
}

.status-toggle.is-syncing span {
  border-color: #94a3b8;
  background: #94a3b8;
}

.edit-action {
  background: rgba(255, 255, 255, 0.62) !important;
  color: #64748b !important;
}

.delete-action {
  background: rgba(255, 241, 242, 0.82) !important;
  color: #be123c !important;
}

.delete-action:hover {
  background: #fee2e2 !important;
  color: #991b1b !important;
}

.type-meeting .event-body::before {
  background: #93c5fd;
}
.type-task .event-body::before {
  background: #86efac;
}
.type-approval .event-body::before {
  background: #fcd34d;
}
.type-ai .event-body::before {
  background: #c4b5fd;
}

.empty {
  min-height: 104px;
  box-sizing: border-box;
  border: 1px dashed rgba(96, 165, 250, 0.36);
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(239, 246, 255, 0.88), rgba(255, 251, 235, 0.48)), #ffffff;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  padding: 16px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.empty h3 {
  color: #1f2937;
  font-size: 14px;
  font-weight: 900;
  line-height: 1.3;
}

.empty p {
  margin-top: 4px;
  color: #64748b;
}

.empty-icon {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: #ffffff;
  color: var(--todo-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12px 24px -20px rgba(var(--todo-primary-rgb), 0.65);
}

.empty-icon svg {
  width: 22px;
  height: 22px;
  stroke-width: 2.5;
}

.inline-todo-form {
  position: relative;
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 14px 18px 0;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.18), rgba(239, 246, 255, 0.08));
}

.inline-todo-form-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: hidden;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 10px;
}

.inline-section {
  display: grid;
  gap: 10px;
}

.preview-panel:not(.is-form-mode) .inline-section + .inline-section {
  padding-top: 12px;
  border-top: 1px solid rgba(226, 232, 240, 0.72);
}

.todo-details-section {
  position: relative;
}

.ai-inline-section {
  position: relative;
  z-index: 4;
  overflow: visible;
  padding: 12px;
  border: 1px solid var(--form-module-border, rgba(var(--todo-primary-rgb), 0.1));
  border-radius: 16px;
  background: var(
    --form-module-bg,
    linear-gradient(135deg, rgba(var(--todo-primary-rgb), 0.07), rgba(239, 246, 255, 0.88))
  );
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.ai-inline-section.is-parsing {
  border-color: rgba(var(--todo-primary-rgb), 0.16);
  background: linear-gradient(
    135deg,
    rgba(var(--todo-primary-rgb), 0.11),
    rgba(239, 246, 255, 0.82)
  );
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
}

.ai-inline-section.is-parsing::before {
  content: none;
}

.ai-inline-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.ai-inline-row button {
  min-width: 96px;
  min-height: 40px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 14px;
  font-size: 14px;
}

.ai-inline-section .field > span {
  color: #5b7cab;
}

.ai-inline-section :deep(input) {
  border-color: rgba(var(--todo-primary-rgb), 0.14);
  background: var(--form-surface-strong, rgba(255, 255, 255, 0.92));
}

.ai-inline-section :deep(input:focus) {
  border-color: rgba(var(--todo-primary-rgb), 0.28);
  box-shadow: 0 0 0 3px rgba(var(--todo-primary-rgb), 0.08);
}

.ai-inline-row button:not(:disabled) {
  border-color: rgba(var(--todo-primary-rgb), 0.24);
  background: linear-gradient(180deg, rgba(var(--todo-primary-rgb), 0.92), rgba(37, 99, 235, 0.9));
  box-shadow: 0 10px 22px -18px rgba(var(--todo-primary-rgb), 0.55);
}

.ai-inline-row button.is-parsing:disabled {
  border-color: var(--todo-primary);
  background: var(--todo-primary);
  color: #ffffff;
  cursor: progress;
  box-shadow: 0 10px 22px -16px rgba(var(--todo-primary-rgb), 0.72);
}

.ai-button-dots {
  min-width: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
}

.ai-button-dots span {
  width: 4px;
  height: 4px;
  border-radius: 999px;
  animation: ai-dot-bounce 0.82s ease-in-out infinite;
  background: rgba(255, 255, 255, 0.92);
}

.ai-button-dots span:nth-child(2) {
  animation-delay: 0.12s;
}

.ai-button-dots span:nth-child(3) {
  animation-delay: 0.24s;
}

.ai-inline-row input:disabled {
  background: #ffffff;
  color: #475569;
  cursor: progress;
}

.basic-info-layout {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.basic-info-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  align-items: stretch;
}

.basic-info-column {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid var(--form-module-border, rgba(var(--todo-primary-rgb), 0.1));
  background: var(
    --form-module-bg,
    linear-gradient(135deg, rgba(var(--todo-primary-rgb), 0.07), rgba(239, 246, 255, 0.88))
  );
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.type-info-column .mode-switch {
  background: rgba(var(--form-green-rgb, 34, 197, 94), 0.1);
}

.schedule-info-column .mode-switch {
  background: rgba(var(--form-sky-rgb, 14, 165, 233), 0.1);
}

.schedule-info-column.is-deadline-mode .mode-switch {
  background: rgba(var(--form-amber-rgb, 245, 158, 11), 0.1);
}

.scheduled-time-fields {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(132px, 0.7fr);
  gap: 10px;
  align-items: end;
}

.schedule-field-panel {
  display: grid;
  gap: 0;
  flex: 0 0 129px;
  height: 129px;
  padding: 12px;
  overflow: hidden;
  contain: layout;
  border-radius: 16px;
  border: 1px solid var(--form-module-border, rgba(var(--todo-primary-rgb), 0.1));
  background: var(
    --form-module-bg,
    linear-gradient(135deg, rgba(var(--todo-primary-rgb), 0.07), rgba(239, 246, 255, 0.88))
  );
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.schedule-mode-shell {
  height: 105px;
  overflow: hidden;
}

.schedule-mode-panel {
  display: grid;
  gap: 10px;
  align-content: start;
}

.schedule-field-panel :deep(.deadline-datetime-grid) {
  gap: 10px;
}

.schedule-field-panel :deep(.deadline-datetime-field) {
  gap: 5px;
}

.schedule-field-panel :deep(.deadline-datetime-field > span) {
  color: var(--todo-muted);
  font-size: 11px;
  font-weight: 760;
  letter-spacing: 0.4px;
}

.schedule-field-panel :deep(.todo-datetime-trigger) {
  height: 42px;
  border-color: var(--form-border, rgba(203, 213, 225, 0.82));
  border-radius: 14px;
  background: var(--form-surface-strong, rgba(255, 255, 255, 0.92));
  color: var(--todo-text);
  font-size: 15px;
  font-weight: 650;
}

.schedule-field-panel :deep(.todo-datetime-trigger:hover),
.schedule-field-panel :deep(.todo-datetime-trigger.is-active) {
  border-color: rgba(var(--form-sky-rgb, 14, 165, 233), 0.34);
  box-shadow: 0 0 0 3px rgba(var(--form-sky-rgb, 14, 165, 233), 0.1);
}

.schedule-field-panel.is-deadline-panel :deep(.todo-datetime-trigger:hover),
.schedule-field-panel.is-deadline-panel :deep(.todo-datetime-trigger.is-active) {
  border-color: rgba(var(--form-amber-rgb, 245, 158, 11), 0.34);
  box-shadow: 0 0 0 3px rgba(var(--form-amber-rgb, 245, 158, 11), 0.1);
}

.mode-switch-field {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mode-switch-field > span {
  color: var(--todo-muted);
  font-size: 11px;
  font-weight: 760;
  letter-spacing: 0.4px;
  line-height: 1.3;
}

.quick-range-row,
.quick-time-row {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-height: 34px;
}

.mode-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  width: 100%;
  padding: 3px;
  border: 0;
  border-radius: 14px;
  background: rgba(226, 232, 240, 0.68);
}

.mode-switch button,
.quick-range-row button,
.quick-time-row button {
  min-height: 34px;
  border: 1px solid transparent;
  border-radius: 11px;
  background: transparent;
  color: #64748b;
  padding: 0 12px;
  font: inherit;
  font-size: 14px;
  font-weight: 760;
  cursor: pointer;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    color 0.18s ease;
}

.mode-switch button.active {
  box-shadow:
    0 1px 1px rgba(15, 23, 42, 0.04),
    0 2px 8px rgba(15, 23, 42, 0.08);
}

.mode-switch button.is-todo-type.active {
  background: rgba(34, 197, 94, 0.16);
  color: #15803d;
  border-color: rgba(34, 197, 94, 0.28);
  box-shadow:
    0 1px 1px rgba(21, 128, 61, 0.06),
    0 2px 8px rgba(34, 197, 94, 0.12);
}

.mode-switch button.is-meeting-type.active {
  background: rgba(var(--todo-primary-rgb), 0.14);
  color: #1d4ed8;
  border-color: rgba(var(--todo-primary-rgb), 0.24);
  box-shadow:
    0 1px 1px rgba(37, 99, 235, 0.06),
    0 2px 8px rgba(var(--todo-primary-rgb), 0.12);
}

.mode-switch button.is-scheduled-mode.active {
  background: rgba(14, 165, 233, 0.14);
  color: #0369a1;
  border-color: rgba(14, 165, 233, 0.26);
  box-shadow:
    0 1px 1px rgba(3, 105, 161, 0.06),
    0 2px 8px rgba(14, 165, 233, 0.12);
}

.mode-switch button.is-deadline-mode.active {
  background: rgba(245, 158, 11, 0.16);
  color: #b45309;
  border-color: rgba(245, 158, 11, 0.28);
  box-shadow:
    0 1px 1px rgba(180, 83, 9, 0.06),
    0 2px 8px rgba(245, 158, 11, 0.12);
}

.quick-range-row button,
.quick-time-row button {
  min-height: 28px;
  border: 1px solid rgba(203, 213, 225, 0.82);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  font-size: 12px;
  font-weight: 700;
}

.basic-info-column .quick-time-row {
  margin-top: 0;
}

.quick-range-row button:hover,
.quick-time-row button:hover {
  border-color: rgba(var(--form-sky-rgb, 14, 165, 233), 0.24);
  background: rgba(239, 246, 255, 0.82);
  color: #0369a1;
}

.quick-time-row button.active {
  border-color: rgba(var(--form-sky-rgb, 14, 165, 233), 0.28);
  background: rgba(var(--form-sky-rgb, 14, 165, 233), 0.12);
  color: #0369a1;
}

.schedule-field-panel.is-deadline-panel .quick-range-row button:hover {
  border-color: rgba(var(--form-amber-rgb, 245, 158, 11), 0.28);
  background: rgba(255, 251, 235, 0.88);
  color: #b45309;
}

.mode-switch button.is-todo-type.active:hover {
  background: rgba(34, 197, 94, 0.2);
  color: #166534;
  border-color: rgba(34, 197, 94, 0.34);
}

.mode-switch button.is-meeting-type.active:hover {
  background: rgba(var(--todo-primary-rgb), 0.18);
  color: #1e40af;
  border-color: rgba(var(--todo-primary-rgb), 0.3);
}

.mode-switch button.is-scheduled-mode.active:hover {
  background: rgba(14, 165, 233, 0.18);
  color: #075985;
  border-color: rgba(14, 165, 233, 0.32);
}

.mode-switch button.is-deadline-mode.active:hover {
  background: rgba(245, 158, 11, 0.2);
  color: #92400e;
  border-color: rgba(245, 158, 11, 0.34);
}

.quick-time-row button.active:hover {
  border-color: rgba(var(--form-sky-rgb, 14, 165, 233), 0.34);
  background: rgba(var(--form-sky-rgb, 14, 165, 233), 0.16);
  color: #075985;
}

.mode-switch button:disabled,
.quick-range-row button:disabled,
.quick-time-row button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid var(--form-module-border, rgba(var(--todo-primary-rgb), 0.1));
  background: var(
    --form-module-bg,
    linear-gradient(135deg, rgba(var(--todo-primary-rgb), 0.07), rgba(239, 246, 255, 0.88))
  );
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.field {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-full {
  grid-column: 1 / -1;
}

.field span {
  color: var(--todo-muted);
  font-size: 11px;
  font-weight: 760;
  letter-spacing: 0.4px;
}

.basic-info-column .field span {
  color: var(--todo-muted);
  font-size: 11px;
  font-weight: 760;
}

.field input,
.field select,
.field textarea {
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid var(--form-border, rgba(203, 213, 225, 0.82));
  border-radius: 14px;
  background: var(--form-surface-strong, rgba(255, 255, 255, 0.92));
  color: var(--todo-text);
  padding: 0 14px;
  font: inherit;
  font-size: 15px;
  font-weight: 650;
  outline: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

.field input,
.field select {
  height: 42px;
}

.soft-picker {
  height: 42px;
  width: 100%;
  border: 1px solid var(--form-border, rgba(203, 213, 225, 0.82));
  border-radius: 14px;
  background: var(--form-surface-strong, rgba(255, 255, 255, 0.92));
  color: var(--todo-text);
  font-size: 15px;
  font-weight: 650;
  outline: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.soft-picker:focus {
  border-color: rgba(var(--todo-primary-rgb), 0.42);
  box-shadow: 0 0 0 3px rgba(var(--todo-primary-rgb), 0.1);
}

.field textarea {
  min-height: 72px;
  padding: 10px 12px;
  resize: none;
  line-height: 1.45;
}

.field input:focus,
.field select:focus,
.field textarea:focus {
  border-color: rgba(var(--todo-primary-rgb), 0.42);
  box-shadow: 0 0 0 3px rgba(var(--todo-primary-rgb), 0.1);
}

.field :deep(input.is-field-invalid),
.field :deep(input[aria-invalid='true']) {
  border-color: rgba(239, 68, 68, 0.72);
  background: rgba(254, 242, 242, 0.92);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.field :deep(input.is-field-invalid:focus),
.field :deep(input[aria-invalid='true']:focus) {
  border-color: rgba(220, 38, 38, 0.82);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.14);
}

.field input.is-ai-highlighted,
.field select.is-ai-highlighted {
  animation: ai-value-highlight 0.55s ease-in-out 2;
}

.inline-discard-warning {
  position: absolute;
  z-index: 8;
  top: 0;
  left: 0;
  right: 4px;
  border: 1px solid rgba(245, 158, 11, 0.28);
  border-radius: 14px;
  background: #fffbeb;
  color: #78350f;
  box-shadow: 0 18px 36px -24px rgba(120, 53, 15, 0.45);
  padding: 15px 16px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
}

.inline-discard-warning strong {
  display: block;
  color: #78350f;
  font-size: 15px;
  font-weight: 900;
  line-height: 1.35;
}

.inline-discard-warning p {
  margin-top: 5px;
  color: #92400e;
  font-size: 13px;
  line-height: 1.4;
}

.discard-warning-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.discard-warning-actions button {
  min-height: 36px;
  padding: 0 16px;
  font-size: 13px;
}

.discard-warning-actions .discard-confirm {
  border-color: #f59e0b;
  background: #f59e0b;
  color: #ffffff;
}

.discard-warning-actions .discard-confirm:hover {
  border-color: #d97706;
  background: #d97706;
  color: #ffffff;
}

.discard-warning-enter-active,
.discard-warning-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.discard-warning-enter-from,
.discard-warning-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

@keyframes ai-dot-bounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.48;
  }
  40% {
    transform: translateY(-3px);
    opacity: 1;
  }
}

@keyframes ai-value-highlight {
  0% {
    color: #111827;
    text-shadow: none;
  }
  38% {
    color: var(--todo-primary-hover);
    text-shadow:
      0 0 1px rgba(var(--todo-primary-rgb), 0.62),
      0 0 10px rgba(var(--todo-primary-rgb), 0.24);
  }
  100% {
    color: #111827;
    text-shadow: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ai-button-dots span,
  .field input.is-ai-highlighted,
  .field select.is-ai-highlighted {
    animation: none;
  }
}

.form-actions {
  flex: 0 0 auto;
  margin: 0 -18px;
  padding: 4px 18px 8px;
  border-top: 1px solid rgba(var(--todo-primary-rgb), 0.1);
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.35), rgba(239, 246, 255, 0.78));
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.form-actions.is-single-action {
  grid-template-columns: 1fr;
}

.form-actions button {
  min-height: 42px;
  border-radius: 14px;
  padding: 0 18px;
  font-size: 15px;
  font-weight: 850;
}

.form-actions button[type='button'] {
  border-color: rgba(203, 213, 225, 0.9);
  background: rgba(255, 255, 255, 0.88);
  color: #52607a;
}

.form-actions button[type='button']:hover {
  border-color: rgba(var(--todo-primary-rgb), 0.18);
  background: rgba(239, 246, 255, 0.92);
  color: #334155;
}

.form-actions button[type='submit'] {
  border-color: rgba(var(--todo-primary-rgb), 0.24);
  background: linear-gradient(180deg, rgba(var(--todo-primary-rgb), 0.92), rgba(37, 99, 235, 0.9));
  box-shadow: 0 10px 22px -18px rgba(var(--todo-primary-rgb), 0.55);
}

.form-actions button[type='submit']:not(:disabled):hover {
  border-color: rgba(37, 99, 235, 0.34);
  background: linear-gradient(180deg, #4f93f8, #2563eb);
}

.form-actions button[type='submit']:disabled {
  border-color: rgba(203, 213, 225, 0.72);
  background: rgba(226, 232, 240, 0.58);
  color: #94a3b8;
  box-shadow: none;
}

@media (max-width: 760px) {
  .preview-head {
    gap: 10px;
  }

  .preview-head h2 {
    font-size: 22px;
  }

  .event-title-row {
    grid-template-columns: 1fr;
    align-items: flex-start;
  }

  .summary-grid,
  .empty,
  .form-grid,
  .basic-info-columns,
  .scheduled-time-fields,
  .ai-inline-row,
  .inline-discard-warning {
    grid-template-columns: 1fr;
  }

  .form-actions {
    grid-template-columns: 1fr;
  }

  .discard-warning-actions {
    justify-content: flex-start;
  }
}
</style>
