<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import IconLoaderCircle from '~icons/lucide/loader-circle'
import IconPencil from '~icons/lucide/pencil'
import IconSend from '~icons/lucide/send'
import type { TodoProcessSection } from '../helpers/todoDetailPanel.helpers'

const props = defineProps<{
  section: TodoProcessSection
  submitting?: boolean
  composeResetKey?: number
}>()

const emit = defineEmits<{
  submit: [payload: { todoId: string; todoProcess: string }]
  update: [payload: { processId: string; todoProcess: string }]
}>()

const draft = ref('')
const editingProcessId = ref('')
const editingDraft = ref('')

const remainingCount = computed(() => props.section.maxLength - draft.value.length)
const editingRemainingCount = computed(
  () => props.section.maxLength - editingDraft.value.length,
)

watch(
  () => [props.section.targetTodoId, props.composeResetKey] as const,
  () => {
    draft.value = ''
    editingProcessId.value = ''
    editingDraft.value = ''
  },
)

function startEdit(processId: string, content: string) {
  editingProcessId.value = processId
  editingDraft.value = content
}

function cancelEdit() {
  editingProcessId.value = ''
  editingDraft.value = ''
}

function submitDraft() {
  const todoProcess = draft.value.trim()
  if (!todoProcess || props.submitting) return

  emit('submit', {
    todoId: props.section.targetTodoId,
    todoProcess,
  })
}

function submitEdit() {
  const todoProcess = editingDraft.value.trim()
  if (!todoProcess || !editingProcessId.value || props.submitting) return

  emit('update', {
    processId: editingProcessId.value,
    todoProcess,
  })
}
</script>

<template>
  <section class="todo-process-section" aria-label="待办进展">
    <div class="todo-process-head">
      <span class="todo-process-label">待办进展</span>
      <span v-if="section.items.length" class="todo-process-count">{{ section.items.length }} 条</span>
    </div>

    <ul v-if="section.items.length" class="todo-process-list">
      <li v-for="item in section.items" :key="item.processId" class="todo-process-item">
        <template v-if="editingProcessId === item.processId">
          <textarea
            v-model="editingDraft"
            class="todo-process-textarea"
            rows="3"
            :maxlength="section.maxLength"
            :disabled="submitting"
            placeholder="编辑进展内容"
          />
          <div class="todo-process-edit-meta">
            <span class="todo-process-char-count" :class="{ 'is-limit': editingRemainingCount < 0 }">
              {{ editingDraft.length }}/{{ section.maxLength }}
            </span>
            <div class="todo-process-edit-actions">
              <button
                type="button"
                class="todo-process-btn secondary"
                :disabled="submitting"
                @click="cancelEdit"
              >
                取消
              </button>
              <button
                type="button"
                class="todo-process-btn primary"
                :disabled="submitting || !editingDraft.trim()"
                @click="submitEdit"
              >
                <IconLoaderCircle v-if="submitting" class="todo-process-btn-icon is-spinning" />
                保存
              </button>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="todo-process-item-head">
            <div class="todo-process-item-meta">
              <strong>{{ item.creatorName }}</strong>
              <time :datetime="item.createTime">{{ item.createTime }}</time>
            </div>
            <button
              v-if="item.editable"
              type="button"
              class="todo-process-edit-btn"
              :disabled="submitting"
              aria-label="编辑进展"
              @click="startEdit(item.processId, item.todoProcess)"
            >
              <IconPencil aria-hidden="true" />
            </button>
          </div>
          <p class="todo-process-content">{{ item.todoProcess }}</p>
          <p
            v-if="item.updateTime && item.updateTime !== item.createTime"
            class="todo-process-updated"
          >
            更新于 {{ item.updateTime }}
          </p>
        </template>
      </li>
    </ul>

    <p v-else class="todo-process-empty">暂无进展记录</p>

    <div v-if="section.canAdd" class="todo-process-compose">
      <div class="todo-process-compose-head">
        <label class="todo-process-compose-label" for="todo-process-draft">添加进展</label>
        <span class="todo-process-compose-hint">可多次提交，每次新增一条记录</span>
      </div>
      <textarea
        id="todo-process-draft"
        v-model="draft"
        class="todo-process-textarea"
        rows="3"
        :maxlength="section.maxLength"
        :disabled="submitting"
        placeholder="填写当前进展，例如：已完成需求梳理，正在推进开发联调。"
      />
      <div class="todo-process-compose-foot">
        <span class="todo-process-char-count" :class="{ 'is-limit': remainingCount < 0 }">
          {{ draft.length }}/{{ section.maxLength }}
        </span>
        <button
          type="button"
          class="todo-process-btn primary"
          :disabled="submitting || !draft.trim()"
          @click="submitDraft"
        >
          <IconLoaderCircle v-if="submitting" class="todo-process-btn-icon is-spinning" />
          <IconSend v-else class="todo-process-btn-icon" aria-hidden="true" />
          {{ submitting ? '提交中…' : '提交进展' }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.todo-process-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(226, 232, 240, 0.92);
}

.todo-process-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.todo-process-label {
  color: #8795aa;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
}

.todo-process-count {
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.todo-process-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.todo-process-item {
  padding: 12px;
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid rgba(226, 232, 240, 0.88);
}

.todo-process-item-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.todo-process-item-meta {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.todo-process-item-meta strong {
  color: #101936;
  font-size: 13px;
  font-weight: 700;
}

.todo-process-item-meta time {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 600;
}

.todo-process-edit-btn {
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  border: 1px solid rgba(226, 232, 240, 0.92);
  border-radius: 10px;
  color: #60708d;
  background: rgba(255, 255, 255, 0.88);
  display: grid;
  place-items: center;
  cursor: pointer;
}

.todo-process-edit-btn svg {
  width: 14px;
  height: 14px;
}

.todo-process-content {
  margin: 8px 0 0;
  color: #334155;
  font-size: 14px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.todo-process-updated {
  margin: 6px 0 0;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
}

.todo-process-empty {
  margin: 0;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 600;
}

.todo-process-compose {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px dashed rgba(226, 232, 240, 0.92);
}

.todo-process-compose-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.todo-process-compose-label {
  color: #475569;
  font-size: 12px;
  font-weight: 700;
}

.todo-process-compose-hint {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
}

.todo-process-textarea {
  width: 100%;
  min-height: 88px;
  padding: 12px 14px;
  border: 1px solid rgba(203, 213, 225, 0.96);
  border-radius: 12px;
  color: #101936;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  background: rgba(255, 255, 255, 0.92);
  box-sizing: border-box;
}

.todo-process-textarea:focus {
  outline: none;
  border-color: rgba(47, 124, 255, 0.42);
  box-shadow: 0 0 0 3px rgba(47, 124, 255, 0.12);
}

.todo-process-textarea:disabled {
  opacity: 0.72;
  cursor: not-allowed;
}

.todo-process-compose-foot,
.todo-process-edit-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.todo-process-edit-meta {
  margin-top: 8px;
}

.todo-process-edit-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.todo-process-char-count {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 600;
}

.todo-process-char-count.is-limit {
  color: #dc2626;
}

.todo-process-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 88px;
  height: 36px;
  padding: 0 14px;
  border-radius: 12px;
  border: 0;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.todo-process-btn.primary {
  color: #fff;
  background: linear-gradient(135deg, #2f72ed, #4d91ff);
  box-shadow: 0 8px 18px rgba(52, 120, 246, 0.2);
}

.todo-process-btn.secondary {
  color: #475569;
  background: rgba(241, 245, 249, 0.96);
  border: 1px solid rgba(226, 232, 240, 0.92);
}

.todo-process-btn:disabled {
  opacity: 0.56;
  cursor: not-allowed;
  box-shadow: none;
}

.todo-process-btn-icon {
  width: 14px;
  height: 14px;
}

.todo-process-btn-icon.is-spinning {
  animation: todo-process-spin 0.9s linear infinite;
}

@keyframes todo-process-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
