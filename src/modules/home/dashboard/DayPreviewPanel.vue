<script setup lang="ts">
import { ref } from 'vue'
import TodoDialog from './TodoDialog.vue'
import type {
  CalendarEvent,
  CalendarEventStatus,
  CalendarEventType,
  CalendarSpecialDay,
  CalendarTodoDraft,
  CalendarTodoForm,
  CalendarTodoUpdate,
  CalendarUser,
} from './types'

const props = defineProps<{
  date: string
  dateLabel: string
  events: CalendarEvent[]
  specialDays: CalendarSpecialDay[]
  currentUser: CalendarUser
  assignableUsers: CalendarUser[]
  showClose?: boolean
}>()

const emit = defineEmits<{
  createTodo: [payload: CalendarTodoDraft]
  updateTodo: [payload: CalendarTodoUpdate]
  updateStatus: [id: string, status: CalendarEventStatus]
  close: []
}>()

type TodoDialogMode = 'create' | 'edit' | 'view'

const isDialogOpen = ref(false)
const dialogMode = ref<TodoDialogMode>('create')
const editingId = ref('')
const todoForm = ref<CalendarTodoForm>({
  date: props.date,
  time: '09:00',
  title: '',
  owner: '',
  assigneeId: '',
  assigneeName: '',
  source: '',
  completionIdeas: '',
})

const typeText: Record<CalendarEventType, string> = {
  meeting: '会面',
  task: '待办',
  approval: '审批',
  ai: '智能',
}

const specialText: Record<CalendarSpecialDay['type'], string> = {
  holiday: '节假日',
  workday: '补班',
  'solar-term': '节气',
}

function resetTodoForm(date = props.date) {
  todoForm.value = {
    date,
    time: '09:00',
    title: '',
    owner: props.currentUser.name,
    assigneeId: props.currentUser.id,
    assigneeName: props.currentUser.name,
    source: '',
    completionIdeas: '',
  }
}

function openCreateDialog() {
  dialogMode.value = 'create'
  editingId.value = ''
  resetTodoForm(props.date)
  isDialogOpen.value = true
}

function openEditDialog(event: CalendarEvent) {
  dialogMode.value = 'edit'
  editingId.value = event.id
  todoForm.value = {
    date: event.date,
    time: event.time,
    title: event.title,
    owner: event.owner,
    assigneeId: event.assigneeId ?? props.currentUser.id,
    assigneeName: event.assigneeName ?? event.owner,
    source: event.source ?? '',
    completionIdeas: event.completionIdeas ?? '',
  }
  isDialogOpen.value = true
}

function openDetailDialog(event: CalendarEvent) {
  if (event.editable) {
    openEditDialog(event)
    return
  }

  dialogMode.value = 'view'
  editingId.value = event.id
  todoForm.value = {
    date: event.date,
    time: event.time,
    title: event.title,
    owner: event.owner,
    assigneeId: event.assigneeId ?? props.currentUser.id,
    assigneeName: event.assigneeName ?? event.owner,
    source: event.source ?? '',
    completionIdeas: event.completionIdeas ?? '',
  }
  isDialogOpen.value = true
}

function closeDialog() {
  isDialogOpen.value = false
  editingId.value = ''
}

function submitTodo(payload: CalendarTodoForm) {
  if (dialogMode.value === 'view') {
    closeDialog()
    return
  }

  if (!payload.title.trim()) return

  if (dialogMode.value === 'edit' && editingId.value) {
    emit('updateTodo', {
      id: editingId.value,
      date: payload.date,
      time: payload.time,
      title: payload.title,
      owner: payload.owner || '未指定',
      source: payload.source,
      completionIdeas: payload.completionIdeas,
      assigneeId: payload.assigneeId,
      assigneeName: payload.assigneeName,
    })
  } else {
    emit('createTodo', {
      date: payload.date,
      time: payload.time,
      title: payload.title,
      owner: payload.owner,
      source: payload.source,
      completionIdeas: payload.completionIdeas,
      assigneeId: payload.assigneeId,
      assigneeName: payload.assigneeName,
    })
  }

  closeDialog()
}

function toggleStatus(event: CalendarEvent) {
  if (!event.completable) return
  emit('updateStatus', event.id, event.status === 'done' ? 'todo' : 'done')
}

function shouldShowEventMeta(event: CalendarEvent) {
  return Boolean((event.scope === 'assigned_to_me' && event.creatorName) || event.source)
}
</script>

<template>
  <section class="preview-panel">
    <header class="preview-head">
      <div>
        <p>这一天</p>
        <h2>{{ props.dateLabel }}</h2>
      </div>
      <div class="preview-actions">
        <span class="event-count">{{ events.length ? `${events.length} 个安排` : '空闲' }}</span>
        <button class="add-btn" type="button" @click="openCreateDialog">新增</button>
        <button v-if="showClose" class="close-btn" type="button" aria-label="关闭当天待办" @click="emit('close')">
          ×
        </button>
      </div>
    </header>

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
        @click="openDetailDialog(event)"
        @keydown.enter.prevent="openDetailDialog(event)"
      >
        <time>{{ event.time }}</time>
        <div class="event-body">
          <div class="event-topline">
            <span class="event-type">{{ typeText[event.type] }}</span>
            <span v-if="event.scope === 'assigned_by_me'" class="dispatch-target">
              派发：{{ event.assigneeName ?? event.owner }}
            </span>
            <span
              v-if="event.priority === 'urgent' && event.status !== 'done'"
              class="event-priority"
              >优先</span
            >
            <span v-if="event.completionIdeas" class="event-ideas-chip">已有完成思路</span>
          </div>
          <div class="event-title-row">
            <h3>{{ event.title }}</h3>
            <div class="item-actions">
              <button
                v-if="event.completable"
                class="status-toggle"
                type="button"
                :class="{ 'is-done': event.status === 'done' }"
                @click.stop="toggleStatus(event)"
              >
                <span aria-hidden="true">{{ event.status === 'done' ? '✓' : '' }}</span>
                {{ event.status === 'done' ? '已完成' : '完成' }}
              </button>
              <button v-if="event.editable" type="button" @click.stop="openEditDialog(event)">
                编辑
              </button>
            </div>
          </div>
          <div v-if="shouldShowEventMeta(event)" class="event-note">
            <p v-if="event.scope === 'assigned_to_me' && event.creatorName">
              派发人：{{ event.creatorName }}.
            </p>
            <p v-if="event.source">备注：{{ event.source }}</p>
          </div>
        </div>
      </article>
    </div>

    <div v-else class="empty">
      <h3>这一天暂时很清爽</h3>
      <p>可以安排一个待办，或者先浏览本月日程。</p>
    </div>

    <TodoDialog
      v-model:show="isDialogOpen"
      :mode="dialogMode"
      :form="todoForm"
      :current-user="currentUser"
      :assignable-users="assignableUsers"
      @save="submitTodo"
      @closed="closeDialog"
    />
  </section>
</template>

<style scoped>
.preview-panel {
  padding: 2px 2px 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.preview-head {
  padding: 2px 0 16px;
  border-bottom: 1px dashed rgba(148, 163, 184, 0.46);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.preview-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.preview-head p {
  margin: 0 0 7px;
  font-size: 12px;
  font-weight: 700;
  color: #8a6a35;
}

.preview-head h2 {
  margin: 0;
  color: #1f2937;
  font-size: 24px;
  font-weight: 850;
  line-height: 1.05;
}

.event-count {
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: #fff7ed;
  color: #9a3412;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.add-btn,
.close-btn,
.item-actions button {
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
    color 0.18s ease;
}

.add-btn {
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
}

.add-btn:hover,
.close-btn:hover,
.item-actions button:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
  color: #111827;
}

.special-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.special-chip {
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 900;
}

.special-holiday {
  background: rgba(254, 226, 226, 0.62);
  border-color: rgba(185, 28, 28, 0.12);
  color: #b91c1c;
}

.special-workday {
  background: rgba(226, 232, 240, 0.72);
  border-color: rgba(75, 85, 99, 0.1);
  color: #4b5563;
}

.special-solar-term {
  background: rgba(204, 251, 241, 0.64);
  border-color: rgba(15, 118, 110, 0.12);
  color: #0f766e;
}

.timeline {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.timeline-item {
  position: relative;
  padding: 12px 0;
  display: grid;
  grid-template-columns: 50px minmax(0, 1fr);
  gap: 14px;
  cursor: pointer;
}

.timeline-item + .timeline-item {
  border-top: 1px dashed rgba(203, 213, 225, 0.78);
}

.timeline-item:focus-visible {
  outline: 2px solid rgba(79, 124, 255, 0.36);
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
  padding: 0 0 0 16px;
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
  opacity: 0.72;
}

.event-topline {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
  flex-wrap: wrap;
}

.event-type,
.dispatch-target,
.event-priority,
.event-ideas-chip {
  min-height: 19px;
  padding: 0 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 750;
  display: inline-flex;
  align-items: center;
}

.event-type {
  background: rgba(255, 251, 235, 0.78);
  border: 1px solid rgba(251, 191, 36, 0.22);
}

.dispatch-target {
  background: #ecfeff;
  color: #0e7490;
}

.event-priority {
  background: #fee2e2;
  color: #b91c1c;
}

.event-ideas-chip {
  background: #eef6ff;
  color: #2456a6;
}

.timeline-item.scope-assigned_by_me {
  margin: 2px 0;
  border-radius: 14px;
  background: linear-gradient(90deg, rgba(236, 254, 255, 0.82), rgba(255, 255, 255, 0));
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
  line-height: 1.3;
  min-width: 0;
  flex: 1;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.item-actions {
  display: flex;
  gap: 8px;
  margin-top: 0;
  flex: 0 0 auto;
  flex-wrap: wrap;
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

.type-meeting .event-type {
  color: #2563eb;
}
.type-meeting .event-body::before {
  background: #93c5fd;
}
.type-task .event-type {
  color: #047857;
}
.type-task .event-body::before {
  background: #86efac;
}
.type-approval .event-type {
  color: #b45309;
}
.type-approval .event-body::before {
  background: #fcd34d;
}
.type-ai .event-type {
  color: #7c3aed;
}
.type-ai .event-body::before {
  background: #c4b5fd;
}

.empty {
  min-height: 150px;
  border-left: 2px solid rgba(148, 163, 184, 0.55);
  background: linear-gradient(90deg, rgba(248, 250, 252, 0.84), rgba(248, 250, 252, 0));
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 18px 0 18px 18px;
}

.empty h3 {
  font-size: 15px;
}

@media (max-width: 760px) {
  .preview-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .event-title-row {
    align-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>
