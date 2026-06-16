<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import TodoAssigneeSelect from './components/TodoAssigneeSelect.vue'
import { Textarea } from '@/components/ui/textarea'
import TodoDatePicker from './components/TodoDatePicker.vue'
import TodoTimePicker from './components/TodoTimePicker.vue'
import type { CalendarTodoForm, CalendarUser } from './types'
import { formatFormDateTime } from './todoDisplay'
import { parseTodoText as serviceParseTodoText } from './todo.service'

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
    endTime: form.endTime,
    title: form.title,
    owner: form.owner,
    assigneeId: form.assigneeId,
    assigneeName: form.assigneeName,
    source: form.source,
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

  if (window.confirm('当前待办内容还没有保存，确定放弃并关闭吗？')) {
    closeNow()
  }
}

async function parseTodoText() {
  if (!aiPrompt.value.trim()) return

  isParsing.value = true
  const parsed = await serviceParseTodoText(
    aiPrompt.value,
    props.currentUser,
    props.assignableUsers,
    todoForm.value,
  )
  todoForm.value = {
    ...todoForm.value,
    ...parsed,
    mode:
      parsed.mode ?? (parsed.endDate && parsed.endDate !== parsed.date ? 'deadline' : 'scheduled'),
    endDate: parsed.endDate ?? parsed.date ?? todoForm.value.endDate,
    time: parsed.time ?? todoForm.value.time,
  }
  isParsing.value = false
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
  <div v-if="show" class="todo-dialog-backdrop" @click.self="requestClose">
    <div class="todo-dialog" role="dialog" aria-modal="true">
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
            <Textarea
              v-model="aiPrompt"
              rows="3"
              placeholder="例如：明天下午给刘畅布置一项开发任务，任务内容为“开发公司官方网站”"
            />
          </label>
          <div class="ai-actions">
            <Button type="button" :disabled="isParsing || !aiPrompt.trim()" @click="parseTodoText">
              {{ isParsing ? '解析中...' : 'AI 解析并填入' }}
            </Button>
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
              <TodoDatePicker
                v-model="todoForm.date"
                class="soft-picker"
                :disabled="!canEditDialog"
                aria-label="选择待办日期"
              />
            </label>
            <label class="field">
              <span>时间</span>
              <TodoTimePicker
                v-model="todoForm.time"
                class="soft-picker"
                :disabled="!canEditDialog"
                aria-label="选择待办时间"
              />
            </label>
            <label class="field field-full">
              <span>待办内容</span>
              <Textarea v-if="!canEditDialog" v-model="todoForm.title" rows="3" readonly />
              <Input
                v-else
                v-model="todoForm.title"
                type="text"
                required
                placeholder="输入待办内容"
              />
            </label>
            <label class="field">
              <span>负责人</span>
              <TodoAssigneeSelect
                :model-value="parseAssigneeIds(todoForm.assigneeId)"
                :users="assignableUsers"
                :disabled="!canEditDialog"
                @update:model-value="selectAssignees"
              />
            </label>
            <label class="field">
              <span>备注</span>
              <Textarea v-if="!canEditDialog" v-model="todoForm.source" rows="3" readonly />
              <Input v-else v-model="todoForm.source" type="text" placeholder="备注或来源" />
            </label>
          </div>
        </section>

        <div class="modal-actions">
          <Button type="button" @click="requestClose">取消</Button>
          <Button v-if="canEditDialog" type="submit" :disabled="!canSubmit">保存</Button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.todo-dialog {
  width: min(700px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  overflow: auto;
  border-radius: 14px;
  background: #fff;
  padding: 28px 32px 24px;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.18);
}

.todo-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.36);
  backdrop-filter: blur(8px);
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
  height: 38px;
  border-radius: 10px;
  background: #ffffff;
  color: #111827;
  font-size: 13px;
  font-weight: 500;
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
