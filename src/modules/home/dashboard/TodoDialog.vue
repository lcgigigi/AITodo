<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDialog } from 'naive-ui'
import type { CalendarTodoForm, CalendarUser } from './types'
import { formatFormDateTime } from './todoDisplay'
import { parseTodoText as mockParseTodoText } from './todoMock'

export type TodoDialogMode = 'create' | 'edit' | 'view'

const props = defineProps<{
  show: boolean
  mode: TodoDialogMode
  form: CalendarTodoForm
  currentUser: CalendarUser
  assignableUsers: CalendarUser[]
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  save: [payload: CalendarTodoForm]
  closed: []
}>()

const dialog = useDialog()
const aiPrompt = ref('')
const isParsing = ref(false)
const todoForm = ref<CalendarTodoForm>(createFormCopy(props.form))
const initialSnapshot = ref('')

const dialogTitle = computed(() => {
  if (props.mode === 'create') return '新增待办'
  if (props.mode === 'edit') return '编辑待办'
  return '待办详情'
})
const canEditDialog = computed(() => props.mode !== 'view')
const canSubmit = computed(() => canEditDialog.value && Boolean(todoForm.value.title.trim()))
const formDateTimeLabel = computed(() => formatFormDateTime(todoForm.value))

watch(
  () => props.show,
  (show) => {
    if (!show) return

    aiPrompt.value = ''
    isParsing.value = false
    todoForm.value = createFormCopy(props.form)
    initialSnapshot.value = getSnapshot()
  },
)

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
    completionIdeas: form.completionIdeas,
  }
}

function getSnapshot() {
  return JSON.stringify({
    form: todoForm.value,
    aiPrompt: aiPrompt.value,
  })
}

function hasUnsavedChanges() {
  return getSnapshot() !== initialSnapshot.value
}

function closeNow() {
  emit('update:show', false)
  emit('closed')
  isParsing.value = false
}

function requestClose() {
  if (!hasUnsavedChanges()) {
    closeNow()
    return
  }

  dialog.warning({
    title: '放弃未保存的修改？',
    content: '当前待办内容还没有保存，关闭后本次填写的内容不会保留。',
    positiveText: '继续编辑',
    negativeText: '放弃并关闭',
    onNegativeClick: closeNow,
  })
}

function handleShowUpdate(show: boolean) {
  if (show) {
    emit('update:show', true)
    return
  }

  requestClose()
}

async function parseTodoText() {
  if (!aiPrompt.value.trim()) return

  isParsing.value = true
  const parsed = await mockParseTodoText(
    aiPrompt.value,
    props.currentUser,
    props.assignableUsers,
    todoForm.value,
  )
  todoForm.value = {
    ...todoForm.value,
    ...parsed,
    endDate: parsed.endDate ?? parsed.date ?? todoForm.value.endDate,
    time: parsed.time ?? todoForm.value.time,
    completionIdeas: todoForm.value.completionIdeas,
  }
  isParsing.value = false
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
  if (!canEditDialog.value) {
    closeNow()
    return
  }

  if (!todoForm.value.title.trim()) return

  const payload = createFormCopy(todoForm.value)

  emit('save', payload)
  initialSnapshot.value = getSnapshot()
}
</script>

<template>
  <n-modal :show="show" :mask-closable="true" @update:show="handleShowUpdate">
    <n-card class="todo-dialog" :bordered="false" role="dialog" aria-modal="true">
      <header class="dialog-head">
        <div>
          <p>{{ mode === 'view' ? '查看安排' : '整理安排' }}</p>
          <h2>{{ dialogTitle }}</h2>
        </div>
        <span v-if="canEditDialog" class="dialog-badge">可编辑</span>
        <span v-else class="dialog-badge is-readonly">只读</span>
      </header>

      <form class="todo-dialog-form" @submit.prevent="submitTodo">
        <section v-if="canEditDialog" class="dialog-section ai-section">
          <label class="field field-full">
            <span>AI 辅助描述</span>
            <textarea
              v-model="aiPrompt"
              rows="3"
              placeholder="例如：明天下午给刘畅布置一项开发任务，任务内容为“开发公司官方网站”"
            ></textarea>
          </label>
          <div class="ai-actions">
            <button type="button" :disabled="isParsing || !aiPrompt.trim()" @click="parseTodoText">
              {{ isParsing ? '解析中...' : 'AI 解析并填入' }}
            </button>
          </div>
        </section>

        <section class="dialog-section">
          <div class="section-title">
            <h3>基础信息</h3>
            <span>{{ formDateTimeLabel }}</span>
          </div>
          <div class="form-grid">
            <label class="field">
              <span>日期</span>
              <n-date-picker
                v-model:formatted-value="todoForm.date"
                class="soft-picker"
                type="date"
                value-format="yyyy-MM-dd"
                format="yyyy/MM/dd"
                :clearable="false"
                :disabled="!canEditDialog"
              />
            </label>
            <label class="field">
              <span>时间</span>
              <n-time-picker
                v-model:formatted-value="todoForm.time"
                class="soft-picker"
                value-format="HH:mm"
                format="HH:mm"
                :clearable="true"
                :disabled="!canEditDialog"
              />
            </label>
            <label class="field field-full">
              <span>待办内容</span>
              <textarea v-if="!canEditDialog" v-model="todoForm.title" rows="3" readonly></textarea>
              <input
                v-else
                v-model="todoForm.title"
                type="text"
                required
                placeholder="输入待办内容"
              />
            </label>
            <label class="field">
              <span>负责人</span>
              <select
                v-model="todoForm.assigneeId"
                :disabled="!canEditDialog"
                @change="onAssigneeChange"
              >
                <option v-for="user in assignableUsers" :key="user.id" :value="user.id">
                  {{ user.name }}
                </option>
              </select>
            </label>
            <label class="field">
              <span>备注</span>
              <textarea
                v-if="!canEditDialog"
                v-model="todoForm.source"
                rows="3"
                readonly
              ></textarea>
              <input v-else v-model="todoForm.source" type="text" placeholder="备注或来源" />
            </label>
          </div>
        </section>

        <div class="modal-actions">
          <button type="button" @click="requestClose">取消</button>
          <button v-if="canEditDialog" type="submit" :disabled="!canSubmit">保存</button>
        </div>
      </form>
    </n-card>
  </n-modal>
</template>

<style scoped>
.todo-dialog {
  width: min(700px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  border-radius: 14px;
}

.todo-dialog :deep(.n-card__content) {
  padding: 28px 32px 24px;
}

.dialog-head {
  margin: 0 0 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e8eef7;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.dialog-head p {
  margin: 0 0 4px;
  color: #8a6a35;
  font-size: 12px;
  font-weight: 850;
}

.dialog-head h2 {
  margin: 0;
  color: #111827;
  font-size: 26px;
  font-weight: 900;
  line-height: 1.15;
}

.dialog-badge {
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  background: #ecfdf5;
  color: #047857;
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 850;
}

.dialog-badge.is-readonly {
  background: #f8fafc;
  color: #64748b;
}

.todo-dialog-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dialog-section {
  border: 0;
  background: transparent;
  padding: 0;
  display: grid;
  gap: 10px;
}

.dialog-section + .dialog-section {
  padding-top: 12px;
  border-top: 1px solid #eef2f7;
}

.ai-section {
  background: transparent;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-title h3 {
  margin: 0;
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
  border-radius: 8px;
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
  width: 100%;
}

.soft-picker :deep(.n-input) {
  height: 38px;
  border-radius: 10px;
  background: #ffffff;
  --n-border: 1px solid #dfe8f3 !important;
  --n-border-hover: 1px solid #c9d6e6 !important;
  --n-border-focus: 1px solid #111827 !important;
  --n-box-shadow-focus: 0 0 0 3px rgba(17, 24, 39, 0.07) !important;
  --n-caret-color: #111827 !important;
  --n-color-disabled: #f8fafc !important;
  --n-text-color-disabled: #475569 !important;
}

.soft-picker :deep(.n-input__input-el) {
  color: #111827;
  font-size: 13px;
  font-weight: 500;
}

.soft-picker :deep(.n-input__suffix) {
  color: #475569;
}

.soft-picker :deep(.n-input__border),
.soft-picker :deep(.n-input__state-border) {
  border-radius: 10px;
}

.field textarea {
  min-height: 74px;
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

.field input:disabled,
.field select:disabled,
.field textarea[readonly] {
  background: #f8fafc;
  color: #475569;
  cursor: default;
}

.ai-actions,
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.modal-actions {
  padding-top: 2px;
}

.ai-actions button,
.modal-actions button {
  min-height: 34px;
  border: 1px solid #e5edf6;
  border-radius: 999px;
  background: #ffffff;
  color: #475569;
  padding: 0 14px;
  font: inherit;
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
}

.ai-actions button,
.modal-actions button[type='submit'] {
  border-color: #111827;
  background: #111827;
  color: #ffffff;
}

.ai-actions button:hover,
.modal-actions button:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
  color: #111827;
}

.ai-actions button:disabled,
.modal-actions button:disabled {
  border-color: #e5edf6;
  background: #f1f5f9;
  color: #94a3b8;
  cursor: not-allowed;
}

@media (max-width: 760px) {
  .todo-dialog {
    width: calc(100vw - 24px);
    max-height: calc(100vh - 24px);
  }

  .todo-dialog :deep(.n-card__content) {
    padding: 22px 20px 20px;
  }

  .dialog-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .dialog-head h2 {
    font-size: 23px;
  }

  .dialog-section {
    padding: 0;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .section-title {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
