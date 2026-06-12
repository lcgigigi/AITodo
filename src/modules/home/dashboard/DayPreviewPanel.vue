<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import IconArrowLeft from '~icons/lucide/arrow-left'
import IconCalendarPlus from '~icons/lucide/calendar-plus'
import IconX from '~icons/lucide/x'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import AppRive from '@/shared/components/animation/AppRive.vue'
import TodoDatePicker from './components/TodoDatePicker.vue'
import TodoDeadlineDateTimeRange from './components/TodoDeadlineDateTimeRange.vue'
import TodoTimePicker from './components/TodoTimePicker.vue'
import type {
  CalendarEvent,
  CalendarEventStatus,
  CalendarSpecialDay,
  CalendarTodoDraft,
  CalendarTodoForm,
  CalendarTodoUpdate,
  CalendarUser,
} from './types'
import EventScheduleTime from './components/EventScheduleTime.vue'
import {
  addDays,
  formatFormDateTime,
  isRangeEvent,
  parseDate,
  ymd,
} from './todoDisplay'
import { loadTodoDetail, parseTodoText as serviceParseTodoText } from './todo.service'

const props = defineProps<{
  date: string
  dateLabel: string
  events: CalendarEvent[]
  specialDays: CalendarSpecialDay[]
  currentUser: CalendarUser
  assignableUsers: CalendarUser[]
  showClose?: boolean
  quickCreatePrompt?: string
  quickCreateKey?: number
  externalDraft?: CalendarTodoDraft | null
  externalDraftKey?: number
  presetCreateTime?: string
  presetCreateKey?: number
}>()

const emit = defineEmits<{
  createTodo: [payload: CalendarTodoDraft]
  updateTodo: [payload: CalendarTodoUpdate]
  updateStatus: [id: string, status: CalendarEventStatus]
  deleteTodo: [id: string]
  dirtyChange: [dirty: boolean]
  notify: [message: string]
  close: []
}>()

type PanelMode = 'list' | 'create' | 'edit' | 'view'
type ParsedHighlightField = 'date' | 'time' | 'endDate' | 'endTime' | 'title' | 'source' | 'assignee'

const scheduledTimePresets = [
  { label: '中午12点', value: '12:00' },
  { label: '下午3点', value: '15:00' },
  { label: '晚上5点', value: '17:00' },
]
const aiParsingRiveSrc = '/animations/ai-parsing.riv'
const aiParsingSteps = ['识别日期', '整理时间', '提取事项']

const panelMode = ref<PanelMode>('list')
const editingId = ref('')
const aiPrompt = ref('')
const isParsing = ref(false)
const highlightedFields = ref<Set<ParsedHighlightField>>(new Set())
const todoForm = ref<CalendarTodoForm>(createEmptyForm(props.date))
const initialFormSnapshot = ref(formSnapshot(todoForm.value))
const discardWarningVisible = ref(false)
const deleteWarningVisible = ref(false)
let pendingDiscardAction: (() => void) | undefined
let highlightTimer: ReturnType<typeof setTimeout> | undefined

const specialText: Record<CalendarSpecialDay['type'], string> = {
  holiday: '节假日',
  workday: '补班',
  'solar-term': '节气',
}

const pendingCount = computed(() => props.events.filter((event) => event.status !== 'done').length)
const doneCount = computed(() => props.events.length - pendingCount.value)
const isFormMode = computed(() => panelMode.value !== 'list')
const isViewMode = computed(() => panelMode.value === 'view')
const canEditForm = computed(() => panelMode.value === 'create' || panelMode.value === 'edit')
const formTitle = computed(() => {
  if (panelMode.value === 'view') return '查看待办'
  if (panelMode.value === 'edit') return '编辑待办'
  return '新增待办'
})
const canSubmit = computed(() => canEditForm.value && Boolean(todoForm.value.title.trim()))
const isFormReadonly = computed(() => isParsing.value || isViewMode.value)
const formDateTimeLabel = computed(() => formatFormDateTime(todoForm.value))
const isDeadlineMode = computed(() => todoForm.value.mode === 'deadline')
const canChooseAssignee = computed(() => props.assignableUsers.length > 1)
const hasUnsavedChanges = computed(
  () => canEditForm.value && formSnapshot(todoForm.value) !== initialFormSnapshot.value,
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
    resetFormState()
  },
)

watch(
  () => props.quickCreateKey,
  async () => {
    if (!props.quickCreatePrompt?.trim()) return

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
  deleteWarningVisible.value = false
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

function resetFormState() {
  hideDiscardWarning()
  hideDeleteWarning()
  clearParsedHighlights()
  const nextForm = createEmptyForm(props.date)
  editingId.value = ''
  aiPrompt.value = ''
  isParsing.value = false
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
  isParsing.value = false
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
  isParsing.value = false
  todoForm.value = nextForm
  syncFormSnapshot(nextForm)
  panelMode.value = 'edit'
  emit('dirtyChange', false)
}

function requestCancelForm() {
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
    triggerParsedHighlights(previousForm, nextForm)
  } catch (error) {
    emit(
      'notify',
      error instanceof Error ? error.message : 'AI 解析待办失败，请稍后重试',
    )
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

function selectAssignee(id: string) {
  const assignee = props.assignableUsers.find((user) => user.id === id) ?? props.currentUser
  todoForm.value.assigneeId = assignee.id
  todoForm.value.assigneeName = assignee.name
  todoForm.value.owner = assignee.name
}

function submitTodo() {
  if (!canEditForm.value || !todoForm.value.title.trim()) return

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
    })
  } else {
    emit('createTodo', {
      date: payload.date,
      endDate: payload.mode === 'deadline' ? payload.endDate : undefined,
      time: payload.time || undefined,
      endTime: payload.mode === 'deadline' ? payload.endTime || undefined : undefined,
      title: payload.title,
      owner: payload.owner,
      source: payload.source,
      assigneeId: payload.assigneeId,
      assigneeName: payload.assigneeName,
    })
  }

  resetFormState()
}

function requestDeleteTodo() {
  if (panelMode.value !== 'edit' || !editingId.value || isParsing.value) return
  hideDiscardWarning()
  deleteWarningVisible.value = true
}

function confirmDeleteWarning() {
  const id = editingId.value
  hideDeleteWarning()
  if (!id) return

  emit('deleteTodo', id)
  resetFormState()
}

function toggleStatus(event: CalendarEvent) {
  if (!event.completable) return
  emit('updateStatus', event.id, event.status === 'done' ? 'todo' : 'done')
}

function shouldShowEventMeta(event: CalendarEvent) {
  return Boolean(event.source)
}

function statusText(event: CalendarEvent) {
  if (event.status === 'done') return '已完成'
  return '待处理'
}

defineExpose({
  showDiscardWarning,
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
      <button
        v-if="showClose"
        class="close-btn"
        :class="{ 'is-back': isFormMode }"
        type="button"
        :aria-label="isFormMode ? '返回待办列表' : '关闭当天待办'"
        @click="isFormMode ? requestCancelForm() : requestClosePanel()"
      >
        <IconArrowLeft v-if="isFormMode" aria-hidden="true" />
        <IconX v-else aria-hidden="true" />
      </button>
    </header>

    <template v-if="!isFormMode">
      <div class="preview-toolbar">
        <button class="add-btn" type="button" @click="openCreateForm">+ 新增</button>
      </div>

      <div class="summary-grid" aria-label="当天待办概览">
        <span class="summary-card summary-total">
          <strong>{{ events.length }}</strong>
          待办总数
        </span>
        <span class="summary-card summary-pending">
          <strong>{{ pendingCount }}</strong>
          待处理
        </span>
        <span class="summary-card summary-done">
          <strong>{{ doneCount }}</strong>
          已完成
        </span>
      </div>

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
          :class="[
            `type-${event.type}`,
            `status-${event.status}`,
            event.scope ? `scope-${event.scope}` : '',
          ]"
          tabindex="0"
          @click="openEventDetail(event)"
          @keydown.enter.prevent="openEventDetail(event)"
        >
          <EventScheduleTime :event="event" />
          <div class="event-body">
            <div class="event-title-row">
              <div class="event-title-block">
                <h3>{{ event.title }}</h3>
                <div class="event-meta-row">
                  <span v-if="event.scope === 'assigned_by_me'" class="dispatch-target">
                    派发：{{ event.assigneeName ?? event.owner }}
                  </span>
                  <span
                    v-else-if="event.scope === 'assigned_to_me' && event.creatorName"
                    class="dispatch-target"
                  >
                    派发人：{{ event.creatorName }}
                  </span>
                  <span
                    class="event-status"
                    :class="{
                      'is-done': event.status === 'done',
                    }"
                  >
                    {{ statusText(event) }}
                  </span>
                </div>
              </div>
              <div class="item-actions">
                <button
                  v-if="event.completable"
                  class="status-toggle"
                  type="button"
                  :class="{ 'is-done': event.status === 'done' }"
                  @click.stop="toggleStatus(event)"
                >
                  <span aria-hidden="true">{{ event.status === 'done' ? '✓' : '' }}</span>
                  {{ event.status === 'done' ? '撤销' : '完成' }}
                </button>
                <button
                  v-if="shouldOpenViewForm(event)"
                  class="edit-action is-view"
                  type="button"
                  @click.stop="openViewForm(event)"
                >
                  查看
                </button>
                <button
                  v-else
                  class="edit-action"
                  type="button"
                  @click.stop="openEditForm(event)"
                >
                  编辑
                </button>
              </div>
            </div>
            <div v-if="shouldShowEventMeta(event)" class="event-note">
              <p v-if="event.source">备注：{{ event.source }}</p>
            </div>
          </div>
        </article>
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

      <Transition name="discard-warning">
        <div v-if="deleteWarningVisible" class="inline-discard-warning" role="alert">
          <div>
            <strong>确定删除这个待办吗？</strong>
            <p>删除后无法恢复，请确认是否继续。</p>
          </div>
          <div class="discard-warning-actions">
            <button type="button" @click="hideDeleteWarning">继续编辑</button>
            <button class="discard-confirm" type="button" @click="confirmDeleteWarning">
              确认删除
            </button>
          </div>
        </div>
      </Transition>

      <section
        v-if="canEditForm"
        class="inline-section ai-inline-section"
        :class="{ 'is-parsing': isParsing }"
        :aria-busy="isParsing"
      >
        <label class="field field-full">
          <span>一句话创建待办</span>
          <div class="ai-inline-row">
            <Input
              v-model="aiPrompt"
              type="text"
              :disabled="isParsing"
              :aria-describedby="isParsing ? 'ai-parse-status-title' : undefined"
              placeholder="例如：明天下午给刘畅布置一项开发公司官方网站的任务"
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
          <div
            v-if="isParsing"
            class="ai-parse-status"
            role="status"
            aria-live="polite"
            aria-labelledby="ai-parse-status-title"
          >
            <div class="ai-rive-stage" aria-hidden="true">
              <AppRive class="ai-rive-player" :src="aiParsingRiveSrc">
                <template #fallback>
                  <div class="ai-rive-fallback">
                    <span class="ai-orbit-ring"></span>
                    <span class="ai-orbit-dot is-one"></span>
                    <span class="ai-orbit-dot is-two"></span>
                    <span class="ai-orbit-dot is-three"></span>
                    <span class="ai-note-card is-front"></span>
                    <span class="ai-note-card is-back"></span>
                  </div>
                </template>
              </AppRive>
            </div>
            <div class="ai-status-copy">
              <div class="ai-status-heading">
                <strong id="ai-parse-status-title">正在解析待办内容</strong>
                <span>智能整理中</span>
              </div>
              <p>正在识别时间、地点和事项，稍后自动填入表单。</p>
              <div class="ai-status-steps" aria-hidden="true">
                <span
                  v-for="(step, index) in aiParsingSteps"
                  :key="step"
                  :style="{ '--step-index': index }"
                >
                  <i></i>
                  {{ step }}
                </span>
              </div>
            </div>
          </div>
        </Transition>
      </section>

      <section
        class="inline-section todo-details-section"
        :class="{ 'has-parse-scrim': isParsing, 'is-readonly': isViewMode }"
        :aria-disabled="isFormReadonly"
      >
        <div class="section-title">
          <h3>基础信息</h3>
          <span>{{ formDateTimeLabel }}</span>
        </div>
        <div class="mode-switch" aria-label="待办时间模式">
          <button
            type="button"
            :class="{ active: todoForm.mode === 'scheduled' }"
            :disabled="isFormReadonly"
            @click="setMode('scheduled')"
          >
            指定时间
          </button>
          <button
            type="button"
            :class="{ active: todoForm.mode === 'deadline' }"
            :disabled="isFormReadonly"
            @click="setMode('deadline')"
          >
            截止日期
          </button>
        </div>
        <div class="form-grid" :inert="isFormReadonly">
          <TodoDeadlineDateTimeRange
            v-if="isDeadlineMode"
            v-model:start-date="todoForm.date"
            v-model:start-time="todoForm.time"
            v-model:end-date="todoForm.endDate"
            v-model:end-time="todoForm.endTime"
            :disabled="isFormReadonly"
            :start-highlighted="isAiHighlighted('date') || isAiHighlighted('time')"
            :end-highlighted="isAiHighlighted('endDate') || isAiHighlighted('endTime')"
            @change="syncDateRange"
          />
          <label v-else class="field">
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
          <label v-if="!isDeadlineMode" class="field">
            <span>时间</span>
            <TodoTimePicker
              v-model="todoForm.time"
              class="soft-picker"
              :disabled="isFormReadonly"
              :highlighted="isAiHighlighted('time')"
              aria-label="选择待办时间"
            />
          </label>
          <div v-if="!isDeadlineMode" class="quick-time-row field-full" aria-label="指定时间">
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
          <div v-if="isDeadlineMode" class="quick-range-row field-full" aria-label="快捷时间">
            <button type="button" :disabled="isFormReadonly" @click="applyQuickRange('today')">今天</button>
            <button type="button" :disabled="isFormReadonly" @click="applyQuickRange('week')">本周内</button>
            <button type="button" :disabled="isFormReadonly" @click="applyQuickRange('nextWeek')">下周前</button>
            <button type="button" :disabled="isFormReadonly" @click="applyQuickRange('month')">本月内</button>
          </div>
          <label v-if="canChooseAssignee" class="field field-full">
            <span>负责人</span>
            <Select
              :model-value="todoForm.assigneeId"
              :disabled="isFormReadonly"
              @update:model-value="selectAssignee(String($event))"
            >
              <SelectTrigger
                :class="[
                  'soft-select-trigger',
                  { 'is-ai-highlighted': isAiHighlighted('assignee') },
                ]"
                :disabled="isFormReadonly"
                aria-label="选择负责人"
              >
                <SelectValue placeholder="选择负责人" />
              </SelectTrigger>
              <SelectContent position="popper" class="todo-select-content">
                <SelectItem v-for="user in assignableUsers" :key="user.id" :value="user.id">
                  {{ user.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label class="field field-full">
            <span>待办内容</span>
            <Input
              v-model="todoForm.title"
              :class="{ 'is-ai-highlighted': isAiHighlighted('title') }"
              type="text"
              required
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
      </section>

      <div class="form-actions">
        <template v-if="isViewMode">
          <Button type="button" @click="requestCancelForm">返回</Button>
        </template>
        <template v-else>
          <Button
            v-if="panelMode === 'edit'"
            class="delete-btn"
            type="button"
            :disabled="isParsing"
            @click="requestDeleteTodo"
          >
            删除
          </Button>
          <Button type="button" :disabled="isParsing" @click="requestCancelForm">取消</Button>
          <Button type="submit" :disabled="!canSubmit || isParsing">保存</Button>
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

.preview-head {
  min-width: 0;
  padding: 0 0 12px;
  border-bottom: 1px dashed rgba(148, 163, 184, 0.34);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.preview-head p {
  margin: 0 0 7px;
  font-size: 12px;
  font-weight: 760;
  color: #8a6a35;
}

.preview-head h2 {
  margin: 0;
  color: #1f2937;
  font-size: 25px;
  font-weight: 850;
  line-height: 1.08;
  overflow-wrap: anywhere;
}

.form-date {
  margin-top: 7px;
  display: inline-flex;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.summary-card {
  min-height: 58px;
  box-sizing: border-box;
  border: 0;
  border-radius: 12px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 850;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 1px 3px rgba(15, 23, 42, 0.14),
    0 4px 10px rgba(15, 23, 42, 0.12),
    0 0 16px rgba(15, 23, 42, 0.08);
}

.summary-card strong {
  font-size: 22px;
  line-height: 1;
  font-weight: 950;
}

.summary-total,
.summary-pending,
.summary-done {
  background: #ffffff;
  color: #64748b;
}

.summary-total strong {
  color: #d97706;
}

.summary-pending strong {
  color: #1d4ed8;
}

.summary-done strong {
  color: #059669;
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
  padding-right: 4px;
}

.timeline::-webkit-scrollbar,
.inline-todo-form::-webkit-scrollbar {
  width: 6px;
}

.timeline::-webkit-scrollbar-thumb,
.inline-todo-form::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.42);
}

.timeline::-webkit-scrollbar-track,
.inline-todo-form::-webkit-scrollbar-track {
  background: transparent;
}

.timeline-item {
  position: relative;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid transparent;
  border-radius: 14px;
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

.timeline-item + .timeline-item {
  border-top-color: rgba(226, 232, 240, 0.66);
}

.timeline-item:hover {
  border-color: rgba(191, 219, 254, 0.68);
  background: rgba(248, 250, 252, 0.52);
  box-shadow: 0 14px 26px -28px rgba(15, 23, 42, 0.34);
}

.timeline-item:focus-visible {
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
  color: #0e7490;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.2;
  white-space: nowrap;
}

.timeline-item.scope-assigned_by_me {
  margin: 2px 0;
  border-radius: 14px;
  background: linear-gradient(90deg, rgba(236, 254, 255, 0.72), rgba(255, 255, 255, 0));
}

.timeline-item.scope-assigned_by_me + .timeline-item {
  border-top: 0;
}

.timeline-item.status-done .event-body::before {
  opacity: 0.34;
}

.timeline-item.status-done h3 {
  color: #475569;
}

.timeline-item.status-done p {
  opacity: 0.72;
}

.timeline-item.status-done {
  color: #94a3b8;
  filter: grayscale(0.28);
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
}

.event-title-row {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
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
  background: #dcfce7;
  color: #166534;
}

.item-actions {
  display: flex;
  gap: 8px;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
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

.edit-action {
  background: rgba(255, 255, 255, 0.62) !important;
  color: #64748b !important;
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
  overflow-y: visible;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 0;
}

.inline-section {
  display: grid;
  gap: 10px;
}

.inline-section + .inline-section {
  padding-top: 12px;
  border-top: 1px solid rgba(226, 232, 240, 0.72);
}

.todo-details-section {
  position: relative;
}

.todo-details-section.has-parse-scrim {
  z-index: 1;
}

.todo-details-section.has-parse-scrim::before {
  content: '';
  position: absolute;
  z-index: 2;
  inset: -10px -2px -6px;
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.58);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.58);
  pointer-events: auto;
  cursor: wait;
}

@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .todo-details-section.has-parse-scrim::before {
    background: rgba(248, 250, 252, 0.46);
    -webkit-backdrop-filter: blur(1px);
    backdrop-filter: blur(1px);
  }
}

.ai-inline-section {
  position: relative;
  z-index: 4;
  overflow: visible;
  padding: 10px;
  border: 1px solid transparent;
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.72);
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.ai-inline-section.is-parsing {
  border-color: transparent;
  background: rgba(248, 250, 252, 0.72);
  box-shadow: none;
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
  min-height: 38px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
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
}

.ai-button-dots span {
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

.ai-parse-status {
  position: absolute;
  z-index: 7;
  top: calc(100% + 10px);
  left: 0;
  right: 0;
  box-sizing: border-box;
  min-height: 104px;
  border: 1px solid rgba(147, 197, 253, 0.6);
  border-radius: 18px;
  background: radial-gradient(circle at 82% 20%, rgba(219, 234, 254, 0.76), transparent 34%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(239, 246, 255, 0.92)), #ffffff;
  color: #334155;
  box-shadow:
    0 22px 42px -34px rgba(var(--todo-primary-rgb), 0.55),
    0 13px 26px -24px rgba(15, 23, 42, 0.18);
  padding: 14px 18px;
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  pointer-events: none;
  backdrop-filter: blur(3px);
}

.ai-rive-stage {
  width: 68px;
  height: 68px;
  border-radius: 22px;
  background: radial-gradient(circle at 66% 24%, rgba(255, 255, 255, 0.98), transparent 28%),
    linear-gradient(135deg, rgba(239, 246, 255, 0.96), rgba(219, 234, 254, 0.78));
  box-shadow:
    inset 0 0 0 1px rgba(191, 219, 254, 0.88),
    0 14px 22px -20px rgba(var(--todo-primary-rgb), 0.58);
  overflow: hidden;
}

.ai-rive-player {
  width: 100%;
  height: 100%;
}

.ai-rive-fallback {
  position: relative;
  width: 100%;
  height: 100%;
}

.ai-orbit-ring {
  position: absolute;
  inset: 13px;
  border: 1px dashed rgba(96, 165, 250, 0.55);
  border-radius: 18px;
  animation: ai-rive-orbit 2.8s linear infinite;
}

.ai-orbit-dot {
  position: absolute;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #60a5fa;
  box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.13);
  animation: ai-orbit-dot 1.18s ease-in-out infinite;
}

.ai-orbit-dot.is-one {
  top: 17px;
  left: 17px;
}

.ai-orbit-dot.is-two {
  top: 17px;
  right: 17px;
  animation-delay: 0.16s;
}

.ai-orbit-dot.is-three {
  right: 20px;
  bottom: 17px;
  animation-delay: 0.32s;
}

.ai-note-card {
  position: absolute;
  left: 24px;
  top: 28px;
  width: 24px;
  height: 18px;
  border-radius: 7px;
  background: #ffffff;
  box-shadow:
    inset 0 0 0 1px rgba(147, 197, 253, 0.58),
    0 8px 14px -12px rgba(37, 99, 235, 0.48);
}

.ai-note-card::before,
.ai-note-card::after {
  content: '';
  position: absolute;
  left: 6px;
  right: 6px;
  height: 2px;
  border-radius: 999px;
  background: rgba(96, 165, 250, 0.52);
}

.ai-note-card::before {
  top: 6px;
}

.ai-note-card::after {
  top: 11px;
}

.ai-note-card.is-front {
  animation: ai-note-sort 1.8s ease-in-out infinite;
}

.ai-note-card.is-back {
  top: 22px;
  left: 20px;
  opacity: 0.72;
  transform: rotate(-8deg);
  animation: ai-note-back 1.8s ease-in-out infinite;
}

.ai-status-copy {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.ai-status-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

.ai-status-heading strong {
  display: block;
  color: #1e293b;
  font-size: 14px;
  font-weight: 900;
  line-height: 1.35;
}

.ai-status-heading span {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  border-radius: 999px;
  background: rgba(219, 234, 254, 0.88);
  color: #2563eb;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 900;
}

.ai-parse-status p {
  margin: 0;
  color: #475569;
  font-size: 12px;
  line-height: 1.45;
}

.ai-status-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
}

.ai-status-steps span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 23px;
  border: 1px solid rgba(191, 219, 254, 0.9);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  color: #64748b;
  padding: 0 9px;
  font-size: 11px;
  font-weight: 850;
  animation: ai-step-pulse 1.72s ease-in-out infinite;
  animation-delay: calc(var(--step-index) * 0.16s);
}

.ai-status-steps i {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: #60a5fa;
}

.ai-parse-status-enter-active,
.ai-parse-status-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.ai-parse-status-enter-from,
.ai-parse-status-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

.mode-switch,
.quick-range-row,
.quick-time-row {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.mode-switch {
  width: fit-content;
  padding: 3px;
  border: 1px solid #e5edf6;
  border-radius: 999px;
  background: #f8fafc;
}

.mode-switch button,
.quick-range-row button,
.quick-time-row button {
  min-height: 30px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #64748b;
  padding: 0 12px;
  font: inherit;
  font-size: 13px;
  font-weight: 850;
  cursor: pointer;
}

.mode-switch button.active {
  background: var(--todo-primary);
  color: #ffffff;
}

.quick-range-row button,
.quick-time-row button {
  border: 1px solid #e5edf6;
  background: #ffffff;
}

.quick-range-row button:hover,
.quick-time-row button:hover {
  border-color: #cbd5e1;
  color: #111827;
}

.quick-time-row button.active {
  border-color: var(--todo-primary);
  background: var(--todo-primary);
  color: #ffffff;
}

.mode-switch button.active:hover,
.quick-time-row button.active:hover {
  border-color: var(--todo-primary-hover);
  background: var(--todo-primary-hover);
  color: #ffffff;
}

.mode-switch button:disabled,
.quick-range-row button:disabled,
.quick-time-row button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-title h3 {
  color: #1f2937;
  font-size: 14px;
  font-weight: 900;
  line-height: 1.3;
}

.section-title span {
  color: #64748b;
  font-size: 13px;
  font-weight: 750;
  white-space: nowrap;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 14px;
}

.field {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-full {
  grid-column: 1 / -1;
}

.field span {
  color: #475569;
  font-size: 13px;
  font-weight: 820;
}

.field input,
.field select,
.field textarea {
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid #dfe8f3;
  border-radius: 10px;
  background: #ffffff;
  color: #111827;
  padding: 0 12px;
  font: inherit;
  font-size: 14px;
  outline: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

.field input,
.field select {
  height: 40px;
}

.soft-picker {
  height: 40px;
  width: 100%;
  border: 1px solid #dfe8f3;
  border-radius: 10px;
  background: #ffffff;
  color: #111827;
  font-size: 14px;
  font-weight: 500;
  outline: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.soft-select-trigger {
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

.soft-select-trigger:hover,
.soft-select-trigger[aria-expanded='true'] {
  border-color: #111827;
  background: #ffffff;
  color: #111827;
  box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.07);
}

.soft-select-trigger.is-ai-highlighted :deep([data-slot='select-value']) {
  animation: ai-value-highlight 0.55s ease-in-out 2;
}

.soft-picker:focus {
  border-color: #111827;
  box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.07);
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
  border-color: #111827;
  box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.07);
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

@keyframes ai-rive-orbit {
  to {
    transform: rotate(360deg);
  }
}

@keyframes ai-orbit-dot {
  0%,
  100% {
    transform: translateY(0) scale(0.88);
    opacity: 0.58;
  }
  42% {
    transform: translateY(-3px) scale(1);
    opacity: 1;
  }
}

@keyframes ai-note-sort {
  0%,
  100% {
    transform: translate(0, 0) rotate(2deg);
  }
  48% {
    transform: translate(6px, -5px) rotate(9deg);
  }
}

@keyframes ai-note-back {
  0%,
  100% {
    transform: translate(0, 0) rotate(-8deg);
  }
  48% {
    transform: translate(-4px, 4px) rotate(-13deg);
  }
}

@keyframes ai-step-pulse {
  0%,
  100% {
    border-color: rgba(191, 219, 254, 0.9);
    color: #64748b;
    transform: translateY(0);
  }
  46% {
    border-color: rgba(96, 165, 250, 0.58);
    color: #2563eb;
    transform: translateY(-1px);
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
  .ai-rive-fallback *,
  .ai-status-steps span,
  .field input.is-ai-highlighted,
  .field select.is-ai-highlighted,
  .soft-select-trigger.is-ai-highlighted :deep([data-slot='select-value']) {
    animation: none;
  }
}

.form-actions {
  padding-top: 0;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.form-actions button {
  min-height: 32px;
  padding: 0 14px;
  font-size: 13px;
}

.form-actions .delete-btn {
  margin-right: auto;
  border-color: rgba(220, 38, 38, 0.18);
  background: #fff1f2;
  color: #be123c;
}

.form-actions .delete-btn:hover {
  border-color: rgba(220, 38, 38, 0.28);
  background: #fee2e2;
  color: #991b1b;
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

  .item-actions {
    justify-content: flex-start;
  }

  .summary-grid,
  .empty,
  .form-grid,
  .ai-inline-row,
  .inline-discard-warning {
    grid-template-columns: 1fr;
  }

  .ai-parse-status {
    grid-template-columns: 58px minmax(0, 1fr);
    gap: 12px;
    padding: 12px;
  }

  .ai-rive-stage {
    width: 58px;
    height: 58px;
    border-radius: 19px;
  }

  .discard-warning-actions {
    justify-content: flex-start;
  }
}
</style>
