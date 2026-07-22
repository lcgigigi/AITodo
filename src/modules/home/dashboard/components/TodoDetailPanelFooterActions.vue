<script setup lang="ts">
import { computed } from 'vue'
import IconCheck from '~icons/lucide/check'
import IconPencil from '~icons/lucide/pencil'
import IconRotateCcw from '~icons/lucide/rotate-ccw'
import IconTrash2 from '~icons/lucide/trash-2'
import IconX from '~icons/lucide/x'

const props = defineProps<{
  mode: 'actions' | 'pending-inbox' | 'delete-confirm'
  showDelete?: boolean
  showEdit?: boolean
  isDone?: boolean
  completable?: boolean
  loading?: boolean
  pendingProcessing?: boolean
  deleteProcessing?: boolean
  syncing?: boolean
}>()

defineEmits<{
  delete: []
  edit: []
  toggleStatus: []
  accept: []
  reject: []
  cancelDelete: []
  confirmDelete: []
}>()

const primaryLabel = computed(() => {
  if (props.syncing) return '处理中...'
  return props.isDone ? '恢复待处理' : '标记完成'
})

const visibleSideActionCount = computed(() => {
  let count = 0
  if (props.showDelete) count += 1
  if (props.showEdit) count += 1
  return count
})
</script>

<template>
  <div
    class="detail-panel-actions"
    :class="{
      'is-pending-inbox': mode === 'pending-inbox',
      'is-completed-detail':
        mode === 'actions' && (showDelete || showEdit) && !deleteProcessing,
      'is-two-actions': mode === 'actions' && visibleSideActionCount === 1,
      'is-delete-confirm': mode === 'delete-confirm',
    }"
  >
    <template v-if="mode === 'pending-inbox'">
      <button
        type="button"
        class="detail-action accept"
        :disabled="pendingProcessing || loading"
        @click="$emit('accept')"
      >
        <span class="detail-action-icon" aria-hidden="true">
          <IconCheck />
        </span>
        <span>{{ pendingProcessing ? '处理中…' : '接受' }}</span>
      </button>
      <button
        type="button"
        class="detail-action reject"
        :disabled="pendingProcessing || loading"
        @click="$emit('reject')"
      >
        <span class="detail-action-icon" aria-hidden="true">
          <IconX />
        </span>
        <span>拒绝</span>
      </button>
    </template>

    <template v-else-if="mode === 'delete-confirm'">
      <span class="detail-delete-confirm">确定删除？</span>
      <button
        type="button"
        class="detail-action secondary"
        :disabled="deleteProcessing"
        @click="$emit('cancelDelete')"
      >
        取消
      </button>
      <button
        type="button"
        class="detail-action delete is-solid"
        :disabled="deleteProcessing"
        @click="$emit('confirmDelete')"
      >
        <span class="detail-action-icon" aria-hidden="true">
          <IconTrash2 />
        </span>
        <span>{{ deleteProcessing ? '删除中…' : '确认删除' }}</span>
      </button>
    </template>

    <template v-else>
      <button
        v-if="showDelete"
        type="button"
        class="detail-action delete"
        :disabled="loading"
        @click="$emit('delete')"
      >
        <span class="detail-action-icon" aria-hidden="true">
          <IconTrash2 />
        </span>
        <span>删除</span>
      </button>
      <button
        v-if="showEdit"
        type="button"
        class="detail-action secondary"
        :disabled="loading"
        @click="$emit('edit')"
      >
        <span class="detail-action-icon" aria-hidden="true">
          <IconPencil />
        </span>
        <span>编辑</span>
      </button>
      <button
        type="button"
        class="detail-action primary complete-action"
        :class="{ 'is-syncing': syncing, 'is-done': isDone }"
        :disabled="completable === false || loading || syncing"
        :aria-busy="syncing"
        @click="$emit('toggleStatus')"
      >
        <span class="detail-action-complete-check" aria-hidden="true">
          <span v-if="syncing" class="detail-action-primary-spinner" />
          <IconRotateCcw v-else-if="isDone" />
          <IconCheck v-else />
        </span>
        <span class="detail-action-primary-text">{{ primaryLabel }}</span>
      </button>
    </template>
  </div>
</template>

<style scoped>
@import './detail-action-buttons.css';

.detail-panel-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.detail-panel-actions.is-pending-inbox {
  grid-template-columns: 1fr 1fr;
}

.detail-panel-actions.is-completed-detail {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.detail-panel-actions.is-completed-detail .detail-action.delete,
.detail-panel-actions.is-completed-detail .detail-action.secondary {
  flex: 0 0 auto;
}

.detail-panel-actions.is-completed-detail .detail-action.primary {
  flex: 1 1 auto;
  min-width: 0;
}

.detail-panel-actions.is-completed-detail.is-two-actions .detail-action {
  flex: 1 1 0;
  min-width: 0;
}

.detail-panel-actions.is-delete-confirm {
  grid-template-columns: minmax(0, 1.1fr) auto auto;
  align-items: center;
  gap: 8px;
}

.detail-delete-confirm {
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
}

@media (max-width: 360px) {
  .detail-panel-actions.is-completed-detail:not(.is-two-actions) {
    flex-wrap: wrap;
  }

  .detail-panel-actions.is-completed-detail:not(.is-two-actions) .detail-action.primary {
    flex: 1 1 100%;
  }
}
</style>
