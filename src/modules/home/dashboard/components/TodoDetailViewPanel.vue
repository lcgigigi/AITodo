<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import IconClock3 from '~icons/lucide/clock-3'
import IconTag from '~icons/lucide/tag'
import IconUser from '~icons/lucide/user'
import IconUserCheck from '~icons/lucide/user-check'
import IconX from '~icons/lucide/x'
import TodoProcessSection, {
  type ProcessFocusMode,
} from './TodoProcessSection.vue'
import type { TodoDetailPanelViewModel } from '../helpers/todoDetailPanel.helpers'

const props = defineProps<{
  panel: TodoDetailPanelViewModel | null
  loading?: boolean
  processSubmitting?: boolean
  processComposeResetKey?: number
}>()

const emit = defineEmits<{
  close: []
  submitProcess: [payload: { todoId: string; todoProcess: string }]
  updateProcess: [payload: { processId: string; todoProcess: string }]
}>()

const processFocusMode = ref<ProcessFocusMode>('none')

const panelHeadTitle = computed(() => {
  if (processFocusMode.value === 'read') return '进展详情'
  if (processFocusMode.value === 'compose') return '添加进展'
  return '任务详情'
})

const isProcessFocused = computed(() => processFocusMode.value !== 'none')

watch(
  () => props.panel?.processSection?.targetTodoId ?? props.panel?.title,
  () => {
    processFocusMode.value = 'none'
  },
)
</script>

<template>
  <section class="todo-detail-view-panel">
    <header class="detail-panel-head">
      <div class="detail-panel-head-main">
        <h2 class="detail-panel-kicker">{{ panelHeadTitle }}</h2>
      </div>
      <button type="button" class="detail-panel-close" aria-label="关闭详情" @click="emit('close')">
        <IconX aria-hidden="true" />
      </button>
    </header>

    <div
      class="detail-panel-body"
      :class="{ 'is-loading': loading, 'is-process-focused': isProcessFocused }"
      :aria-busy="loading"
    >
      <div v-if="loading" class="detail-panel-skeleton" aria-hidden="true">
        <div class="detail-skeleton-title detail-skeleton-block"></div>
        <div class="detail-skeleton-desc detail-skeleton-block"></div>
        <div class="detail-skeleton-desc detail-skeleton-block is-short"></div>

        <div class="detail-skeleton-time-card">
          <div class="detail-skeleton-icon detail-skeleton-block"></div>
          <div class="detail-skeleton-time-copy">
            <div class="detail-skeleton-label detail-skeleton-block"></div>
            <div class="detail-skeleton-line detail-skeleton-block"></div>
          </div>
        </div>

        <div class="detail-skeleton-meta-grid">
          <div v-for="index in 2" :key="index" class="detail-skeleton-meta-item">
            <div class="detail-skeleton-icon detail-skeleton-block"></div>
            <div class="detail-skeleton-meta-copy">
              <div class="detail-skeleton-label detail-skeleton-block"></div>
              <div class="detail-skeleton-line detail-skeleton-block"></div>
            </div>
          </div>
        </div>

        <div class="detail-skeleton-progress">
          <div class="detail-skeleton-label detail-skeleton-block is-short"></div>
          <div v-for="index in 2" :key="`progress-${index}`" class="detail-skeleton-progress-item">
            <div class="detail-skeleton-line detail-skeleton-block"></div>
          </div>
        </div>
      </div>

      <template v-else-if="panel">
        <div v-show="!isProcessFocused" class="detail-panel-main">
          <h2 class="detail-panel-title" :class="{ 'is-empty': panel.contentIsEmpty }">{{ panel.content }}</h2>
          <p v-if="!panel.remarkIsEmpty" class="detail-panel-desc">{{ panel.remark }}</p>

          <p v-if="panel.rejectionNote" class="detail-rejection-note">{{ panel.rejectionNote }}</p>

          <section class="detail-time-card" aria-label="时间安排">
            <span class="detail-time-icon" aria-hidden="true">
              <IconClock3 />
            </span>
            <div class="detail-time-main">
              <span class="detail-field-label">时间安排</span>
              <div class="detail-time-lines">
                <template v-if="Array.isArray(panel.time)">
                  <span class="detail-time-line">{{ panel.time[0] }}</span>
                  <span class="detail-time-separator" aria-hidden="true">→</span>
                  <span class="detail-time-line">{{ panel.time[1] }}</span>
                </template>
                <span v-else class="detail-time-line">{{ panel.time }}</span>
              </div>
            </div>
          </section>

          <section class="detail-meta-grid" aria-label="任务信息">
            <article v-for="item in panel.meta" :key="item.key" class="detail-meta-item">
              <span class="detail-meta-icon" aria-hidden="true">
                <IconTag v-if="item.key === 'type'" />
                <IconUser v-else-if="item.key === 'assigner'" />
                <IconUserCheck v-else />
              </span>
              <div class="detail-meta-copy">
                <span class="detail-field-label">{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </article>
          </section>

          <section
            v-if="panel.assigneeProgress?.length && panel.assigneeProgressBreakdown"
            class="detail-assignee-progress"
            aria-label="接受人进度"
          >
            <div class="detail-assignee-progress-head">
              <span class="detail-field-label">接受人进度</span>
              <span
                v-if="panel.assigneeProgressBreakdown.segments.length"
                class="detail-assignee-progress-divider"
                aria-hidden="true"
              />
              <span
                v-if="panel.assigneeProgressBreakdown.segments.length"
                class="detail-assignee-progress-summary"
                :aria-label="`接受人状态汇总：${panel.assigneeProgressBreakdown.text}`"
              >
                <span
                  v-for="segment in panel.assigneeProgressBreakdown.segments"
                  :key="segment.label"
                  class="detail-assignee-progress-chip"
                  :class="segment.tone"
                >
                  <span class="detail-assignee-progress-chip-count">{{ segment.count }}</span>
                  <span class="detail-assignee-progress-chip-label">{{ segment.label }}</span>
                </span>
              </span>
              <span class="detail-assignee-progress-total">
                共
                <strong>{{ panel.assigneeProgressBreakdown.total }}</strong>
                人
              </span>
            </div>
            <ul class="detail-assignee-progress-list">
              <li
                v-for="item in panel.assigneeProgress"
                :key="item.id"
                class="detail-assignee-progress-item"
              >
                <div class="detail-assignee-progress-main">
                  <strong>{{ item.name }}</strong>
                  <span class="detail-status-badge is-compact" :class="item.statusTone">
                    {{ item.statusLabel }}
                  </span>
                </div>
                <p v-if="item.note" class="detail-assignee-progress-note is-rejected">{{ item.note }}</p>
                <ul
                  v-if="item.processHistory?.length"
                  class="detail-assignee-process-history"
                  :aria-label="`${item.name}的进展记录`"
                >
                  <li
                    v-for="history in item.processHistory"
                    :key="history.processId"
                    class="detail-assignee-process-history-item"
                  >
                    <time :datetime="history.createTime">{{ history.createTime }}</time>
                    <p>{{ history.todoProcess }}</p>
                  </li>
                </ul>
                <p
                  v-else-if="item.lastProcess"
                  class="detail-assignee-progress-note is-process"
                >
                  最新进展：{{ item.lastProcess }}
                </p>
              </li>
            </ul>
          </section>
        </div>

        <TodoProcessSection
          v-if="panel.processSection"
          :section="panel.processSection"
          :submitting="processSubmitting"
          :compose-reset-key="processComposeResetKey"
          :panel-focused="isProcessFocused"
          @submit="emit('submitProcess', $event)"
          @update="emit('updateProcess', $event)"
          @focus-change="processFocusMode = $event"
        />
      </template>
    </div>

    <footer v-if="$slots.footer && !isProcessFocused" class="detail-panel-footer">
      <div class="detail-panel-footer-slot">
        <slot name="footer" />
      </div>
    </footer>
  </section>
</template>

<style scoped>
.todo-detail-view-panel {
  --detail-blue: #2f7cff;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 22px;
  background: linear-gradient(165deg, rgba(255, 255, 255, 0.78), rgba(246, 250, 255, 0.56));
  border: 1px solid rgba(255, 255, 255, 0.82);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 18px 36px -28px rgba(38, 67, 109, 0.22);
  overflow: hidden;
  box-sizing: border-box;
}

.detail-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px 16px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.72);
  background: rgba(255, 255, 255, 0.42);
}

.detail-panel-head-main {
  min-width: 0;
}

.detail-panel-kicker {
  margin: 0;
  color: var(--detail-blue);
  font-size: 17px;
  font-weight: 850;
  letter-spacing: 0.2px;
  line-height: 1.2;
}

.detail-status-badge {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 11px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}

.detail-status-badge.accepted {
  color: #1d4fbf;
  background: rgba(219, 234, 254, 0.92);
}

.detail-status-badge.done {
  color: #166534;
  background: rgba(220, 252, 231, 0.94);
  border: 1px solid rgba(22, 163, 74, 0.22);
}

.detail-status-badge.done::before {
  content: '✓';
  margin-right: 5px;
  font-weight: 900;
}

.detail-status-badge.rejected {
  color: #b91c1c;
  background: rgba(254, 226, 226, 0.92);
}

.detail-status-badge.pending {
  color: #b45309;
  background: rgba(254, 243, 199, 0.96);
}

.detail-status-badge.waiting {
  color: #475569;
  background: rgba(241, 245, 249, 0.96);
}

.detail-panel-close {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 12px;
  color: #60708d;
  background: rgba(255, 255, 255, 0.82);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    transform 0.18s ease;
}

.detail-panel-close:hover {
  background: #fff;
  border-color: rgba(47, 124, 255, 0.18);
  transform: translateY(-1px);
}

.detail-panel-close svg {
  width: 18px;
  height: 18px;
}

.detail-panel-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 20px 12px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.detail-panel-body.is-process-focused {
  overflow: hidden;
}

.detail-panel-main {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-panel-title {
  margin: 0;
  font-size: 24px;
  line-height: 1.42;
  letter-spacing: -0.35px;
  color: #101936;
  font-weight: 800;
}

.detail-panel-desc {
  margin: -6px 0 0;
  color: #334155;
  font-size: 14px;
  font-weight: 650;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
}

.detail-panel-desc.is-empty {
  color: #5c6d84;
  font-weight: 600;
}

.detail-rejection-note {
  margin: -2px 0 0;
  padding: 10px 12px;
  border-radius: 12px;
  color: #b91c1c;
  background: rgba(254, 226, 226, 0.72);
  border: 1px solid rgba(248, 113, 113, 0.18);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.detail-field-label {
  display: block;
  margin-bottom: 6px;
  color: #8795aa;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
}

.detail-time-card .detail-field-label,
.detail-meta-copy .detail-field-label {
  margin-bottom: 4px;
}

.detail-time-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(47, 124, 255, 0.1), rgba(47, 124, 255, 0.03));
  border: 1px solid rgba(47, 124, 255, 0.12);
}

.detail-time-icon {
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  color: var(--detail-blue);
  background: rgba(255, 255, 255, 0.78);
  display: grid;
  place-items: center;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.detail-time-icon svg {
  width: 16px;
  height: 16px;
}

.detail-time-main {
  min-width: 0;
  flex: 1;
}

.detail-time-lines {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.detail-time-line {
  color: #101936;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.35;
}

.detail-time-separator {
  color: #94a3b8;
  font-size: 14px;
  font-weight: 700;
}

.detail-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.detail-meta-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(244, 245, 247, 0.96);
  border: 1px solid rgba(220, 223, 228, 0.92);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.detail-meta-icon {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: #60708d;
  background: rgba(241, 245, 249, 0.92);
  display: grid;
  place-items: center;
}

.detail-meta-icon svg {
  width: 14px;
  height: 14px;
}

.detail-meta-copy {
  min-width: 0;
}

.detail-meta-copy strong {
  display: block;
  color: #101936;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
  word-break: break-word;
}

.detail-assignee-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(226, 232, 240, 0.92);
}

.detail-assignee-progress-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.detail-assignee-progress-head .detail-field-label {
  margin-bottom: 0;
  flex: 0 0 auto;
}

.detail-assignee-progress-divider {
  flex: 0 0 auto;
  width: 1px;
  height: 12px;
  background: rgba(203, 213, 225, 0.92);
}

.detail-assignee-progress-summary {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  min-width: 0;
  flex: 1;
}

.detail-assignee-progress-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  padding: 0 7px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
}

.detail-assignee-progress-chip.accepted {
  color: #3568d4;
  background: rgba(239, 246, 255, 0.96);
  border-color: rgba(191, 219, 254, 0.72);
}

.detail-assignee-progress-chip.done {
  color: #15803d;
  background: rgba(240, 253, 244, 0.96);
  border-color: rgba(187, 247, 208, 0.72);
}

.detail-assignee-progress-chip.rejected {
  color: #c24141;
  background: rgba(254, 242, 242, 0.96);
  border-color: rgba(254, 202, 202, 0.72);
}

.detail-assignee-progress-chip.pending {
  color: #b45309;
  background: rgba(255, 251, 235, 0.96);
  border-color: rgba(253, 230, 138, 0.72);
}

.detail-assignee-progress-chip.waiting {
  color: #64748b;
  background: rgba(248, 250, 252, 0.96);
  border-color: rgba(226, 232, 240, 0.92);
}

.detail-assignee-progress-chip-count {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.detail-assignee-progress-chip-label {
  font-weight: 600;
}

.detail-assignee-progress-total {
  flex: 0 0 auto;
  margin-left: auto;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.detail-assignee-progress-total strong {
  margin: 0 1px;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.detail-assignee-progress-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: min(240px, 36vh);
  overflow-x: hidden;
  overflow-y: auto;
  padding-right: 2px;
  scrollbar-width: thin;
  scrollbar-color: #e2e8f0 transparent;
}

.detail-assignee-progress-list::-webkit-scrollbar {
  width: 4px;
}

.detail-assignee-progress-list::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: #e2e8f0;
}

.detail-assignee-progress-item {
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid rgba(226, 232, 240, 0.88);
}

.detail-assignee-progress-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.detail-assignee-progress-main strong {
  min-width: 0;
  color: #101936;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
}

.detail-status-badge.is-compact {
  flex: 0 0 auto;
  padding: 4px 10px;
  font-size: 11px;
}

.detail-assignee-progress-note {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.45;
}

.detail-assignee-progress-note.is-rejected {
  color: #b91c1c;
}

.detail-assignee-progress-note.is-process {
  color: #1d4fbf;
}

.detail-assignee-process-history {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-assignee-process-history-item {
  padding: 6px 8px;
  border-radius: 8px;
  background: rgba(239, 246, 255, 0.88);
  border: 1px solid rgba(191, 219, 254, 0.72);
}

.detail-assignee-process-history-item time {
  display: block;
  color: #64748b;
  font-size: 11px;
  font-weight: 600;
}

.detail-assignee-process-history-item p {
  margin: 4px 0 0;
  color: #1e3a8a;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.detail-panel-footer {
  flex: 0 0 auto;
  padding: 0;
  border-top: 0;
  background: transparent;
}

.detail-panel-footer-slot {
  padding: 10px 12px 12px;
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(248, 250, 252, 0.82));
  border: 1px solid rgba(226, 232, 240, 0.9);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.96),
    0 10px 24px rgba(15, 23, 42, 0.05);
}

.detail-panel-skeleton {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.detail-skeleton-block {
  border-radius: 10px;
  background: linear-gradient(
    90deg,
    rgba(226, 232, 240, 0.52) 0%,
    rgba(248, 250, 252, 0.96) 50%,
    rgba(226, 232, 240, 0.52) 100%
  );
  background-size: 240px 100%;
  animation: detail-skeleton-shimmer 1.15s ease-in-out infinite;
}

.detail-skeleton-title {
  width: 58%;
  height: 28px;
  border-radius: 12px;
}

.detail-skeleton-desc {
  width: 100%;
  height: 14px;
}

.detail-skeleton-desc.is-short {
  width: 72%;
}

.detail-skeleton-time-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 15px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.42);
  border: 1px solid rgba(226, 232, 240, 0.72);
}

.detail-skeleton-icon {
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  border-radius: 12px;
}

.detail-skeleton-time-copy,
.detail-skeleton-meta-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 2px;
}

.detail-skeleton-label {
  width: 56px;
  height: 10px;
  border-radius: 6px;
}

.detail-skeleton-line {
  width: 78%;
  height: 16px;
  border-radius: 8px;
}

.detail-skeleton-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.detail-skeleton-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.56);
  border: 1px solid rgba(226, 232, 240, 0.88);
}

.detail-skeleton-progress-item {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.92);
}

.detail-skeleton-label.is-short {
  width: 36%;
}

.detail-skeleton-meta-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
  padding: 14px;
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.72);
}

.detail-skeleton-meta-item .detail-skeleton-icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
}

.detail-skeleton-meta-item .detail-skeleton-line {
  width: 64%;
  height: 14px;
}

@keyframes detail-skeleton-shimmer {
  0% {
    background-position: -240px 0;
  }

  100% {
    background-position: calc(240px + 100%) 0;
  }
}

@media (max-width: 760px) {
  .detail-meta-grid,
  .detail-skeleton-meta-grid {
    grid-template-columns: 1fr;
  }
}
</style>
