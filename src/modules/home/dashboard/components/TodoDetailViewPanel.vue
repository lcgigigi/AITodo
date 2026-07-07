<script setup lang="ts">
import IconClock3 from '~icons/lucide/clock-3'
import IconTag from '~icons/lucide/tag'
import IconUser from '~icons/lucide/user'
import IconUserCheck from '~icons/lucide/user-check'
import IconX from '~icons/lucide/x'
import type { TodoDetailPanelViewModel } from '../todoDetailPanel.helpers'

defineProps<{
  panel: TodoDetailPanelViewModel | null
  loading?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <section class="todo-detail-view-panel">
    <header class="detail-panel-head">
      <div class="detail-panel-head-main">
        <span class="detail-panel-kicker">任务详情</span>
        <div v-if="panel" class="detail-panel-badges">
          <span class="detail-type-badge" :class="panel.typeTone">
            {{ panel.typeLabel }}
          </span>
          <span class="detail-status-badge" :class="panel.statusTone">
            {{ panel.statusLabel }}
          </span>
        </div>
      </div>
      <button type="button" class="detail-panel-close" aria-label="关闭详情" @click="emit('close')">
        <IconX aria-hidden="true" />
      </button>
    </header>

    <div class="detail-panel-body" :class="{ 'is-loading': loading }" :aria-busy="loading">
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
      </div>

      <template v-else-if="panel">
        <h2 class="detail-panel-title">{{ panel.title }}</h2>
        <p class="detail-panel-desc">{{ panel.content }}</p>

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
      </template>
    </div>

    <footer v-if="$slots.footer" class="detail-panel-footer">
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
  align-items: flex-start;
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
  display: block;
  color: var(--detail-blue);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1.1px;
}

.detail-panel-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.detail-type-badge,
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

.detail-type-badge.meeting {
  color: #1d4fbf;
  background: rgba(47, 124, 255, 0.12);
  border: 1px solid rgba(47, 124, 255, 0.16);
}

.detail-type-badge.todo {
  color: #08724f;
  background: rgba(218, 247, 232, 0.86);
  border: 1px solid rgba(16, 185, 129, 0.16);
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
  gap: 14px;
  padding: 18px 20px 12px;
  overflow-y: auto;
  scrollbar-width: thin;
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
  color: #5c6b82;
  font-size: 14px;
  line-height: 1.75;
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

.detail-time-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 15px 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(47, 124, 255, 0.1), rgba(47, 124, 255, 0.03));
  border: 1px solid rgba(47, 124, 255, 0.12);
}

.detail-time-icon {
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  color: var(--detail-blue);
  background: rgba(255, 255, 255, 0.78);
  display: grid;
  place-items: center;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.detail-time-icon svg {
  width: 18px;
  height: 18px;
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
  font-size: 15px;
  font-weight: 700;
  line-height: 1.45;
}

.detail-time-separator {
  color: #94a3b8;
  font-size: 14px;
  font-weight: 700;
}

.detail-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.detail-meta-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
  padding: 14px;
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.78);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.detail-meta-icon {
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  color: #60708d;
  background: rgba(241, 245, 249, 0.92);
  display: grid;
  place-items: center;
}

.detail-meta-icon svg {
  width: 15px;
  height: 15px;
}

.detail-meta-copy {
  min-width: 0;
}

.detail-meta-copy strong {
  display: block;
  color: #101936;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.45;
  word-break: break-word;
}

.detail-panel-footer {
  flex: 0 0 auto;
  padding: 14px 20px 18px;
  border-top: 1px solid rgba(226, 232, 240, 0.72);
  background: rgba(255, 255, 255, 0.48);
}

.detail-panel-footer-slot :deep(.detail-panel-actions) {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.detail-panel-footer-slot :deep(.detail-panel-actions.is-pending-inbox),
.detail-panel-footer-slot :deep(.detail-panel-actions.is-completed-detail) {
  grid-template-columns: 1fr 1fr;
}

.detail-panel-footer-slot :deep(.detail-panel-actions.is-delete-confirm) {
  grid-template-columns: minmax(0, 1.1fr) 1fr 1fr;
  align-items: center;
}

.detail-panel-footer-slot :deep(.detail-delete-confirm) {
  color: #64748b;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.35;
}

.detail-panel-footer-slot :deep(.detail-action) {
  height: 46px;
  border: 0;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    opacity 0.18s ease;
}

.detail-panel-footer-slot :deep(.detail-action:hover:not(:disabled)) {
  transform: translateY(-1px);
}

.detail-panel-footer-slot :deep(.detail-action.accept) {
  color: #047857;
  background: rgba(220, 252, 231, 0.96);
  border: 1px solid rgba(16, 185, 129, 0.14);
}

.detail-panel-footer-slot :deep(.detail-action.reject),
.detail-panel-footer-slot :deep(.detail-action.delete) {
  color: #b91c1c;
  background: rgba(254, 226, 226, 0.96);
  border: 1px solid rgba(239, 68, 68, 0.12);
}

.detail-panel-footer-slot :deep(.detail-action.secondary) {
  color: #475569;
  background: rgba(241, 245, 249, 0.96);
  border: 1px solid rgba(226, 232, 240, 0.92);
}

.detail-panel-footer-slot :deep(.detail-action.primary) {
  color: #fff;
  background: linear-gradient(135deg, #2f72ed, #4d91ff);
  box-shadow: 0 10px 20px rgba(52, 120, 246, 0.24);
}

.detail-panel-footer-slot :deep(.detail-action:disabled) {
  opacity: 0.48;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.detail-panel-footer-slot :deep(.detail-action.is-syncing:disabled) {
  opacity: 0.72;
  cursor: wait;
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
