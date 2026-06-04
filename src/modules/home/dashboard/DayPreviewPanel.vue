<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
  CalendarEvent,
  CalendarEventStatus,
  CalendarSpecialDay,
  CalendarTodoDraft,
  CalendarTodoForm,
  CalendarTodoUpdate,
  CalendarUser,
} from './types'
import {
  addDays,
  formatEventTime,
  formatFormDateTime,
  isRangeEvent,
  parseDate,
  ymd,
} from './todoDisplay'
import { parseTodoText as serviceParseTodoText } from './todo.service'

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
  close: []
}>()

type PanelMode = 'list' | 'create' | 'edit'

const panelMode = ref<PanelMode>('list')
const editingId = ref('')
const aiPrompt = ref('')
const isParsing = ref(false)
const todoForm = ref<CalendarTodoForm>(createEmptyForm(props.date))
const initialFormSnapshot = ref(formSnapshot(todoForm.value))

const specialText: Record<CalendarSpecialDay['type'], string> = {
  holiday: '节假日',
  workday: '补班',
  'solar-term': '节气',
}

const pendingCount = computed(() => props.events.filter((event) => event.status !== 'done').length)
const doneCount = computed(() => props.events.length - pendingCount.value)
const isFormMode = computed(() => panelMode.value !== 'list')
const formTitle = computed(() => (panelMode.value === 'edit' ? '编辑待办' : '新增待办'))
const canSubmit = computed(() => Boolean(todoForm.value.title.trim()))
const formDateTimeLabel = computed(() => formatFormDateTime(todoForm.value))
const isDeadlineMode = computed(() => todoForm.value.mode === 'deadline')
const canChooseAssignee = computed(
  () => props.currentUser.role === 'leader' && props.assignableUsers.length > 1,
)
const hasUnsavedChanges = computed(
  () => isFormMode.value && formSnapshot(todoForm.value) !== initialFormSnapshot.value,
)

watch(
  hasUnsavedChanges,
  (dirty) => {
    emit('dirtyChange', dirty)
  },
  { immediate: true },
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
      mode: draft.endDate && draft.endDate !== draft.date ? 'deadline' : 'scheduled',
      date: draft.date,
      endDate: draft.endDate ?? draft.date,
      time: draft.time ?? '',
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

function confirmDiscardChanges() {
  if (!hasUnsavedChanges.value) return true
  return window.confirm('当前待办内容还没有保存，确定放弃修改吗？')
}

function resetFormState() {
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
  if (!confirmDiscardChanges()) return
  beginCreateForm()
}

function openEditForm(event: CalendarEvent) {
  if (!event.editable) return

  if (!confirmDiscardChanges()) return

  const nextForm = createFormFromEvent(event)
  editingId.value = event.id
  aiPrompt.value = ''
  isParsing.value = false
  todoForm.value = nextForm
  syncFormSnapshot(nextForm)
  panelMode.value = 'edit'
  emit('dirtyChange', false)
}

function requestCancelForm() {
  if (!confirmDiscardChanges()) return
  resetFormState()
}

function requestClosePanel() {
  if (!confirmDiscardChanges()) return
  resetFormState()
  emit('close')
}

async function parseTodoText() {
  if (!aiPrompt.value.trim()) return

  isParsing.value = true
  try {
    const parsed = await serviceParseTodoText(
      aiPrompt.value,
      props.currentUser,
      props.assignableUsers,
      todoForm.value,
    )
    todoForm.value = {
      ...todoForm.value,
      ...parsed,
      mode: parsed.endDate && parsed.endDate !== parsed.date ? 'deadline' : todoForm.value.mode,
      endDate: parsed.endDate ?? parsed.date ?? todoForm.value.endDate,
      time: parsed.time ?? todoForm.value.time,
    }
  } finally {
    isParsing.value = false
  }
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
  todoForm.value.time = ''
}

function applyQuickRange(type: 'today' | 'week' | 'nextWeek' | 'month') {
  const start = parseDate(props.date)
  todoForm.value.date = ymd(start)
  todoForm.value.mode = 'deadline'
  todoForm.value.time = ''

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

function onAssigneeChange(event: Event) {
  selectAssignee((event.target as HTMLSelectElement).value)
}

function submitTodo() {
  if (!todoForm.value.title.trim()) return

  const payload = createFormCopy(todoForm.value)

  if (panelMode.value === 'edit' && editingId.value) {
    emit('updateTodo', {
      id: editingId.value,
      date: payload.date,
      endDate: payload.mode === 'deadline' ? payload.endDate : undefined,
      time: payload.mode === 'scheduled' ? payload.time || undefined : undefined,
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
      time: payload.mode === 'scheduled' ? payload.time || undefined : undefined,
      title: payload.title,
      owner: payload.owner,
      source: payload.source,
      assigneeId: payload.assigneeId,
      assigneeName: payload.assigneeName,
    })
  }

  resetFormState()
}

function deleteCurrentTodo() {
  if (panelMode.value !== 'edit' || !editingId.value) return
  if (!window.confirm('确定删除这个待办吗？')) return

  emit('deleteTodo', editingId.value)
  resetFormState()
}

function toggleStatus(event: CalendarEvent) {
  if (!event.completable) return
  emit('updateStatus', event.id, event.status === 'done' ? 'todo' : 'done')
}

function shouldShowEventMeta(event: CalendarEvent) {
  return Boolean((event.scope === 'assigned_to_me' && event.creatorName) || event.source)
}

function statusText(event: CalendarEvent) {
  if (event.status === 'done') return '已完成'
  return '待处理'
}
</script>

<template>
  <section class="preview-panel" :class="{ 'is-form-mode': isFormMode }">
    <header class="preview-head">
      <div>
        <p>{{ isFormMode ? '整理待办' : '待办详情' }}</p>
        <h2>{{ isFormMode ? formTitle : props.dateLabel }}</h2>
        <span v-if="isFormMode" class="form-date">{{ props.dateLabel }}</span>
      </div>
      <button
        v-if="showClose"
        class="close-btn"
        type="button"
        aria-label="关闭当天待办"
        @click="requestClosePanel"
      >
        ×
      </button>
    </header>

    <template v-if="!isFormMode">
      <div class="preview-toolbar">
        <span class="event-count">{{
          events.length ? `${events.length} 个待办` : '当天空闲'
        }}</span>
        <button class="add-btn" type="button" @click="openCreateForm">+ 新增</button>
      </div>

      <div class="summary-grid" aria-label="当天待办概览">
        <span>
          <strong>{{ events.length }}</strong>
          待办总数
        </span>
        <span>
          <strong>{{ pendingCount }}</strong>
          待处理
        </span>
        <span>
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
          @click="openEditForm(event)"
          @keydown.enter.prevent="openEditForm(event)"
        >
          <time>{{ formatEventTime(event) }}</time>
          <div class="event-body">
            <div class="event-topline">
              <span v-if="event.scope === 'assigned_by_me'" class="dispatch-target">
                派发：{{ event.assigneeName ?? event.owner }}
              </span>
            </div>
            <div class="event-title-row">
              <div class="event-title-block">
                <h3>{{ event.title }}</h3>
                <span
                  class="event-status"
                  :class="{
                    'is-done': event.status === 'done',
                  }"
                >
                  {{ statusText(event) }}
                </span>
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
                  {{ event.status === 'done' ? '撤回' : '完成' }}
                </button>
                <button
                  v-if="event.editable"
                  class="edit-action"
                  type="button"
                  @click.stop="openEditForm(event)"
                >
                  编辑
                </button>
              </div>
            </div>
            <div v-if="shouldShowEventMeta(event)" class="event-note">
              <p v-if="event.scope === 'assigned_to_me' && event.creatorName">
                派发人：{{ event.creatorName }}
              </p>
              <p v-if="event.source">备注：{{ event.source }}</p>
            </div>
          </div>
        </article>
      </div>

      <div v-else class="empty">
        <h3>当天暂无待办</h3>
        <p>可以安排一个待办，或者先浏览本月日程。</p>
      </div>
    </template>

    <form v-else class="inline-todo-form" @submit.prevent="submitTodo">
      <section class="inline-section ai-inline-section">
        <label class="field field-full">
          <span>一句话创建待办</span>
          <div class="ai-inline-row">
            <input
              v-model="aiPrompt"
              type="text"
              placeholder="例如：明天下午给刘畅布置一项开发公司官方网站的任务"
            />
            <button type="button" :disabled="isParsing || !aiPrompt.trim()" @click="parseTodoText">
              {{ isParsing ? '解析中' : 'AI 解析' }}
            </button>
          </div>
        </label>
      </section>

      <section class="inline-section">
        <div class="section-title">
          <h3>基础信息</h3>
          <span>{{ formDateTimeLabel }}</span>
        </div>
        <div class="mode-switch" aria-label="待办时间模式">
          <button
            type="button"
            :class="{ active: todoForm.mode === 'scheduled' }"
            @click="setMode('scheduled')"
          >
            指定时间
          </button>
          <button
            type="button"
            :class="{ active: todoForm.mode === 'deadline' }"
            @click="setMode('deadline')"
          >
            截止日期
          </button>
        </div>
        <div class="form-grid">
          <label class="field" :class="{ 'field-date-range': isDeadlineMode }">
            <span>日期</span>
            <input
              v-model="todoForm.date"
              class="soft-picker"
              type="date"
              @change="syncDateRange"
            />
          </label>
          <label v-if="!isDeadlineMode" class="field">
            <span>时间</span>
            <input v-model="todoForm.time" class="soft-picker" type="time" />
          </label>
          <label v-else class="field">
            <span>截止</span>
            <input
              v-model="todoForm.endDate"
              class="soft-picker"
              type="date"
              @change="syncDateRange"
            />
          </label>
          <div v-if="isDeadlineMode" class="quick-range-row field-full" aria-label="快捷时间">
            <button type="button" @click="applyQuickRange('today')">今天</button>
            <button type="button" @click="applyQuickRange('week')">本周内</button>
            <button type="button" @click="applyQuickRange('nextWeek')">下周前</button>
            <button type="button" @click="applyQuickRange('month')">本月内</button>
          </div>
          <label class="field field-full">
            <span>待办内容</span>
            <input v-model="todoForm.title" type="text" required placeholder="输入待办内容" />
          </label>
          <label v-if="canChooseAssignee" class="field">
            <span>负责人</span>
            <select v-model="todoForm.assigneeId" @change="onAssigneeChange">
              <option v-for="user in assignableUsers" :key="user.id" :value="user.id">
                {{ user.name }}
              </option>
            </select>
          </label>
          <label class="field field-full">
            <span>备注</span>
            <input v-model="todoForm.source" type="text" placeholder="备注或来源" />
          </label>
        </div>
      </section>

      <div class="form-actions">
        <button
          v-if="panelMode === 'edit'"
          class="delete-btn"
          type="button"
          @click="deleteCurrentTodo"
        >
          删除
        </button>
        <button type="button" @click="requestCancelForm">取消</button>
        <button type="submit" :disabled="!canSubmit">保存</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.preview-panel {
  width: 100%;
  min-width: 0;
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
  justify-content: space-between;
  gap: 10px;
}

.event-count {
  min-height: 28px;
  padding: 0 11px;
  border-radius: 999px;
  background: #fff7ed;
  color: #9a3412;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 820;
  white-space: nowrap;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.summary-grid span {
  min-height: 56px;
  box-sizing: border-box;
  border: 1px solid rgba(226, 232, 240, 0.72);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  color: #64748b;
  padding: 10px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 820;
}

.summary-grid strong {
  color: #0f172a;
  font-size: 22px;
  line-height: 1;
  font-weight: 930;
}

.add-btn,
.close-btn,
.item-actions button,
.form-actions button,
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
  border-color: #111827;
  background: #111827;
  color: #ffffff;
}

.close-btn {
  width: 32px;
  padding: 0;
  border-radius: 999px;
  color: #64748b;
  font-size: 20px;
  line-height: 1;
  flex: 0 0 auto;
}

.add-btn:hover,
.close-btn:hover,
.item-actions button:hover,
.form-actions button:hover,
.ai-inline-row button:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
  color: #111827;
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
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.timeline-item {
  position: relative;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid transparent;
  border-radius: 14px;
  padding: 11px 8px;
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
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

.event-topline {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
  flex-wrap: wrap;
}

.dispatch-target {
  min-height: 19px;
  padding: 0 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 750;
  display: inline-flex;
  align-items: center;
}

.dispatch-target {
  background: #ecfeff;
  color: #0e7490;
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
  gap: 7px;
}

.event-status {
  width: fit-content;
  min-height: 22px;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
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
  min-height: 140px;
  border-left: 2px solid rgba(148, 163, 184, 0.42);
  background: linear-gradient(90deg, rgba(248, 250, 252, 0.72), rgba(248, 250, 252, 0));
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 18px 0 18px 18px;
}

.empty h3 {
  font-size: 15px;
}

.inline-todo-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.inline-section {
  display: grid;
  gap: 10px;
}

.inline-section + .inline-section {
  padding-top: 12px;
  border-top: 1px solid rgba(226, 232, 240, 0.72);
}

.ai-inline-section {
  padding: 10px;
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.72);
}

.ai-inline-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.mode-switch,
.quick-range-row {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.mode-switch {
  width: fit-content;
  padding: 3px;
  border: 1px solid #e5edf6;
  border-radius: 999px;
  background: #f8fafc;
}

.mode-switch button,
.quick-range-row button {
  min-height: 28px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #64748b;
  padding: 0 10px;
  font: inherit;
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
}

.mode-switch button.active {
  background: #111827;
  color: #ffffff;
}

.quick-range-row button {
  border: 1px solid #e5edf6;
  background: #ffffff;
}

.quick-range-row button:hover {
  border-color: #cbd5e1;
  color: #111827;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-title h3 {
  color: #1f2937;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.3;
}

.section-title span {
  color: #64748b;
  font-size: 12px;
  font-weight: 750;
  white-space: nowrap;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
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
  color: #475569;
  font-size: 12px;
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
  padding: 0 10px;
  font: inherit;
  font-size: 13px;
  outline: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

.field input,
.field select {
  height: 36px;
}

.soft-picker {
  height: 36px;
  width: 100%;
  border: 1px solid #dfe8f3;
  border-radius: 10px;
  background: #ffffff;
  color: #111827;
  font-size: 13px;
  font-weight: 500;
  outline: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.soft-picker:focus {
  border-color: #111827;
  box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.07);
}

.field textarea {
  min-height: 76px;
  padding: 10px;
  resize: none;
  line-height: 1.45;
}

.field input:focus,
.field select:focus,
.field textarea:focus {
  border-color: #111827;
  box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.07);
}

.form-actions {
  padding-top: 2px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
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
  .form-grid,
  .ai-inline-row {
    grid-template-columns: 1fr;
  }
}
</style>
