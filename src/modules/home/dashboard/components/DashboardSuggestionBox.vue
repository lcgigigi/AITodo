<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import IconChevronDown from '~icons/lucide/chevron-down'
import IconChevronUp from '~icons/lucide/chevron-up'
import IconMailbox from '~icons/lucide/mailbox'
import IconSend from '~icons/lucide/send'
import IconSparkles from '~icons/lucide/sparkles'
import IconX from '~icons/lucide/x'
import { Button } from '@/components/ui/button'
import {
  DAILY_OPINION_LIMIT,
  loadTodayOpinionCount,
  submitOpinion,
  toOpinionType,
  type OpinionCategory,
} from '@/modules/home/dashboard/opinion-box.service'
import { useFeedbackStore } from '@/stores/feedback.store'
import { useUserStore } from '@/stores/user.store'

const props = defineProps<{
  open: boolean
  viewMode?: 'simple' | 'detail' | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const feedbackStore = useFeedbackStore()
const userStore = useUserStore()

const panelRef = ref<HTMLElement | null>(null)
const panelX = ref(24)
const panelY = ref(24)
const isDragging = ref(false)
const isCollapsed = ref(false)

const category = ref<OpinionCategory>('feature')
const content = ref('')
const isSubmitting = ref(false)
const todaySubmittedCount = ref(0)
const isLoadingTodayCount = ref(false)

let dragPointerId: number | null = null
let dragOffsetX = 0
let dragOffsetY = 0

const categoryOptions: Array<{ value: OpinionCategory; label: string; emoji: string }> = [
  { value: 'feature', label: '功能建议', emoji: '💡' },
  { value: 'experience', label: '体验感受', emoji: '✨' },
  { value: 'bug', label: '发现问题', emoji: '🐛' },
  { value: 'other', label: '其他想法', emoji: '💬' },
]

const displayName = computed(() => userStore.profile?.name ?? '体验用户')
const remainingSubmissions = computed(() =>
  Math.max(0, DAILY_OPINION_LIMIT - todaySubmittedCount.value),
)
const hasReachedDailyLimit = computed(() => todaySubmittedCount.value >= DAILY_OPINION_LIMIT)
const contentLength = computed(() => content.value.trim().length)
const canSubmit = computed(
  () =>
    contentLength.value > 0 &&
    !isSubmitting.value &&
    !hasReachedDailyLimit.value &&
    !isLoadingTodayCount.value,
)
const submissionHint = computed(() => {
  if (isLoadingTodayCount.value) return '正在同步今日投递额度…'
  if (hasReachedDailyLimit.value) return '今日已达 3 条上限，明天再来～'
  return `今日还可投递 ${remainingSubmissions.value} 条`
})
const hasDraft = computed(() => contentLength.value > 0)
const collapsedSummary = computed(() => {
  if (!hasDraft.value) return '点开继续写'
  if (contentLength.value < 18) return content.value.trim()
  return `${content.value.trim().slice(0, 18)}…`
})

const panelStyle = computed(() => ({
  left: `${panelX.value}px`,
  top: `${panelY.value}px`,
}))

function close() {
  emit('update:open', false)
}

function collapse() {
  isCollapsed.value = true
  void syncPanelPosition()
}

function expand() {
  isCollapsed.value = false
  void syncPanelPosition()
}

async function syncPanelPosition() {
  await nextTick()
  const position = clampPosition(panelX.value, panelY.value)
  panelX.value = position.x
  panelY.value = position.y
}

defineExpose({
  expand,
})

function resetForm() {
  category.value = 'feature'
  content.value = ''
}

async function refreshTodayOpinionCount() {
  isLoadingTodayCount.value = true

  try {
    todaySubmittedCount.value = await loadTodayOpinionCount()
  } finally {
    isLoadingTodayCount.value = false
  }
}

function clampPosition(x: number, y: number) {
  const panel = panelRef.value
  const margin = 12
  const width = panel?.offsetWidth ?? (isCollapsed.value ? 280 : 560)
  const height = panel?.offsetHeight ?? (isCollapsed.value ? 56 : 520)
  const maxX = Math.max(margin, window.innerWidth - width - margin)
  const maxY = Math.max(margin, window.innerHeight - height - margin)

  return {
    x: Math.min(Math.max(margin, x), maxX),
    y: Math.min(Math.max(margin, y), maxY),
  }
}

function setDefaultPosition() {
  const panel = panelRef.value
  const width = panel?.offsetWidth ?? 560
  const height = panel?.offsetHeight ?? 520

  const position = clampPosition((window.innerWidth - width) / 2, (window.innerHeight - height) / 2)

  panelX.value = position.x
  panelY.value = position.y
}

function handleWindowResize() {
  if (!props.open) return

  const position = clampPosition(panelX.value, panelY.value)
  panelX.value = position.x
  panelY.value = position.y
}

function startDrag(event: PointerEvent) {
  const target = event.target as HTMLElement
  if (target.closest('button, a, input, textarea, select, label')) return

  dragPointerId = event.pointerId
  dragOffsetX = event.clientX - panelX.value
  dragOffsetY = event.clientY - panelY.value
  isDragging.value = true
  event.preventDefault()
}

function handleDragMove(event: PointerEvent) {
  if (dragPointerId === null || event.pointerId !== dragPointerId) return

  const position = clampPosition(event.clientX - dragOffsetX, event.clientY - dragOffsetY)

  panelX.value = position.x
  panelY.value = position.y
}

function stopDrag(event: PointerEvent) {
  if (dragPointerId === null || event.pointerId !== dragPointerId) return

  dragPointerId = null
  isDragging.value = false
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      isCollapsed.value = false
      await nextTick()
      setDefaultPosition()
      void refreshTodayOpinionCount()
      return
    }

    isCollapsed.value = false
    isSubmitting.value = false
    isDragging.value = false
    dragPointerId = null
    todaySubmittedCount.value = 0
    isLoadingTodayCount.value = false
    resetForm()
  },
)

onMounted(() => {
  window.addEventListener('resize', handleWindowResize)
  document.addEventListener('pointermove', handleDragMove)
  document.addEventListener('pointerup', stopDrag)
  document.addEventListener('pointercancel', stopDrag)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize)
  document.removeEventListener('pointermove', handleDragMove)
  document.removeEventListener('pointerup', stopDrag)
  document.removeEventListener('pointercancel', stopDrag)
})

async function handleSubmit() {
  const text = content.value.trim()
  if (!text || isSubmitting.value || hasReachedDailyLimit.value) return

  isSubmitting.value = true

  try {
    await submitOpinion({
      content: text,
      type: toOpinionType(category.value),
    })
    feedbackStore.success('心声已投递，感谢你的真诚反馈！')
    resetForm()
    await refreshTodayOpinionCount()
  } catch (error) {
    const message = error instanceof Error ? error.message : '建议提交失败，请稍后再试'
    if (message.includes('3') || message.includes('上限') || message.includes('最多')) {
      todaySubmittedCount.value = DAILY_OPINION_LIMIT
    }
    feedbackStore.error(message)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="suggestion-panel">
      <section
        v-if="open"
        ref="panelRef"
        class="suggestion-panel"
        :class="{
          'is-dragging': isDragging,
          'is-collapsed': isCollapsed,
        }"
        :style="panelStyle"
        role="complementary"
        :aria-labelledby="isCollapsed ? undefined : 'suggestion-box-title'"
        :aria-label="isCollapsed ? '已收起的体验建议箱' : undefined"
      >
        <div v-if="isCollapsed" class="suggestion-dock">
          <div class="suggestion-dock__drag" @pointerdown="startDrag">
            <span class="suggestion-dock__icon" aria-hidden="true">
              <IconMailbox />
            </span>
            <div class="suggestion-dock__copy">
              <strong>心声草稿</strong>
              <span>{{ collapsedSummary }}</span>
            </div>
            <span v-if="hasDraft" class="suggestion-dock__badge">{{ contentLength }} 字</span>
          </div>

          <div class="suggestion-dock__actions">
            <button
              type="button"
              class="suggestion-dock__action"
              aria-label="展开建议箱"
              title="展开"
              @click="expand"
            >
              <IconChevronUp aria-hidden="true" />
            </button>
            <button
              type="button"
              class="suggestion-dock__action is-danger"
              aria-label="关闭建议箱"
              title="关闭"
              @click="close"
            >
              <IconX aria-hidden="true" />
            </button>
          </div>
        </div>

        <template v-else>
          <div class="suggestion-panel__toolbar">
            <button
              type="button"
              class="suggestion-panel__icon-btn"
              aria-label="暂时收起建议箱"
              title="暂时收起"
              @click="collapse"
            >
              <IconChevronDown aria-hidden="true" />
            </button>
            <button
              type="button"
              class="suggestion-panel__icon-btn is-danger"
              aria-label="关闭建议箱"
              title="关闭"
              @click="close"
            >
              <IconX aria-hidden="true" />
            </button>
          </div>

          <header class="suggestion-panel__header" @pointerdown="startDrag">
            <div class="suggestion-panel__hero" aria-hidden="true">
              <span class="suggestion-panel__mailbox">
                <IconMailbox />
              </span>
              <span class="suggestion-panel__sparkle suggestion-panel__sparkle--one">
                <IconSparkles />
              </span>
              <span class="suggestion-panel__sparkle suggestion-panel__sparkle--two">
                <IconSparkles />
              </span>
            </div>
            <p class="suggestion-panel__kicker">Beta Feedback</p>
            <h2 id="suggestion-box-title">体验建议箱</h2>
            <p class="suggestion-panel__desc">
              内测阶段，{{ displayName }} 的每一条想法都会被认真读完。吐槽、点赞、脑洞都欢迎～
            </p>
            <p class="suggestion-panel__drag-hint">拖到这里可移动，边用边写</p>
          </header>

          <div class="suggestion-panel__body">
            <fieldset class="suggestion-categories">
              <legend>你想聊什么？</legend>
              <div class="suggestion-categories__list" role="radiogroup" aria-label="建议类型">
                <button
                  v-for="option in categoryOptions"
                  :key="option.value"
                  type="button"
                  class="suggestion-category"
                  :class="{ 'is-selected': category === option.value }"
                  role="radio"
                  :aria-checked="category === option.value"
                  @click="category = option.value"
                >
                  <span class="suggestion-category__emoji" aria-hidden="true">{{
                    option.emoji
                  }}</span>
                  <span>{{ option.label }}</span>
                </button>
              </div>
            </fieldset>

            <label class="suggestion-field">
              <span>写下你的想法</span>
              <textarea
                v-model="content"
                class="suggestion-textarea"
                rows="5"
                maxlength="800"
                placeholder="比如：某个按钮找不到、希望增加某某功能、哪里用着特别顺手…"
              />
              <em :class="{ 'is-ready': contentLength > 0 }">{{ contentLength }} / 800</em>
            </label>
          </div>

          <footer class="suggestion-panel__footer">
            <p class="suggestion-panel__hint" :class="{ 'is-limit': hasReachedDailyLimit }">
              {{ submissionHint }}
            </p>
            <Button
              type="button"
              class="suggestion-submit"
              :disabled="!canSubmit"
              @click="handleSubmit"
            >
              <IconSend aria-hidden="true" />
              <span>{{ isSubmitting ? '投递中…' : '投递心声' }}</span>
            </Button>
          </footer>
        </template>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.suggestion-panel {
  position: fixed;
  z-index: 130;
  overflow: hidden;
  width: min(calc(100vw - 24px), 560px);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(18px) saturate(1.08);
  box-shadow:
    0 24px 48px -20px rgba(15, 23, 42, 0.38),
    0 0 0 1px rgba(15, 23, 42, 0.05) inset;
  padding: 28px 28px 24px;
  color: #0f172a;
}

.suggestion-panel.is-collapsed {
  width: min(calc(100vw - 24px), 360px);
  padding: 8px;
  border-radius: 999px;
}

.suggestion-panel.is-dragging {
  cursor: grabbing;
  user-select: none;
}

.suggestion-panel::before {
  content: '';
  position: absolute;
  top: -100px;
  right: -80px;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(254, 215, 170, 0.72) 0%, transparent 70%);
  pointer-events: none;
}

.suggestion-panel::after {
  content: '';
  position: absolute;
  bottom: -120px;
  left: -100px;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(191, 219, 254, 0.62) 0%, transparent 70%);
  pointer-events: none;
}

.suggestion-panel__toolbar {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.suggestion-panel__icon-btn,
.suggestion-dock__action {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 999px;
  background: rgba(241, 245, 249, 0.92);
  color: #64748b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.suggestion-panel__icon-btn:hover,
.suggestion-panel__icon-btn:focus-visible,
.suggestion-dock__action:hover,
.suggestion-dock__action:focus-visible {
  background: rgba(226, 232, 240, 0.96);
  color: #0f172a;
  transform: scale(1.04);
  outline: none;
}

.suggestion-panel__icon-btn.is-danger,
.suggestion-dock__action.is-danger {
  color: #dc2626;
}

.suggestion-panel__icon-btn.is-danger:hover,
.suggestion-panel__icon-btn.is-danger:focus-visible,
.suggestion-dock__action.is-danger:hover,
.suggestion-dock__action.is-danger:focus-visible {
  background: rgba(254, 226, 226, 0.82);
  color: #b91c1c;
}

.suggestion-panel__icon-btn svg,
.suggestion-dock__action svg {
  width: 16px;
  height: 16px;
}

.suggestion-dock {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.suggestion-dock__drag {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px 6px 6px;
  border-radius: 999px;
  cursor: grab;
  touch-action: none;
}

.suggestion-panel.is-dragging .suggestion-dock__drag,
.suggestion-panel.is-dragging .suggestion-panel__header {
  cursor: grabbing;
}

.suggestion-dock__icon {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: linear-gradient(135deg, #fde68a, #fdba74);
  color: #c2410c;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.suggestion-dock__icon svg {
  width: 18px;
  height: 18px;
}

.suggestion-dock__copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.suggestion-dock__copy strong {
  color: #9a3412;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.1;
}

.suggestion-dock__copy span {
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.suggestion-dock__badge {
  flex: 0 0 auto;
  border-radius: 999px;
  background: rgba(255, 237, 213, 0.92);
  color: #c2410c;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
}

.suggestion-dock__actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}

.suggestion-panel__header {
  position: relative;
  z-index: 1;
  margin-bottom: 20px;
  padding-right: 78px;
  cursor: grab;
  touch-action: none;
}

.suggestion-panel.is-dragging .suggestion-panel__header {
  cursor: grabbing;
}

.suggestion-panel__hero {
  position: relative;
  width: 72px;
  height: 56px;
  margin-bottom: 12px;
}

.suggestion-panel__mailbox {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: linear-gradient(135deg, #fde68a, #fdba74);
  color: #c2410c;
  box-shadow:
    0 10px 20px -10px rgba(234, 88, 12, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
  animation: suggestion-mailbox-bob 2.8s ease-in-out infinite;
}

.suggestion-panel__mailbox svg {
  width: 28px;
  height: 28px;
}

.suggestion-panel__sparkle {
  position: absolute;
  color: #f59e0b;
  opacity: 0.9;
}

.suggestion-panel__sparkle svg {
  width: 14px;
  height: 14px;
}

.suggestion-panel__sparkle--one {
  top: 2px;
  right: 2px;
  animation: suggestion-sparkle-twinkle 2.2s ease-in-out infinite;
}

.suggestion-panel__sparkle--two {
  bottom: 4px;
  right: 18px;
  animation: suggestion-sparkle-twinkle 2.2s ease-in-out 0.8s infinite;
}

.suggestion-panel__kicker {
  margin: 0 0 6px;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.suggestion-panel__header h2 {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 950;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.suggestion-panel__desc {
  margin: 0;
  color: #64748b;
  font-size: 14px;
  line-height: 1.55;
  font-weight: 600;
}

.suggestion-panel__drag-hint {
  margin: 10px 0 0;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 700;
}

.suggestion-panel__body {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.suggestion-categories {
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}

.suggestion-categories legend {
  margin-bottom: 10px;
  color: #334155;
  font-size: 13px;
  font-weight: 850;
}

.suggestion-categories__list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.suggestion-category {
  border: 1px solid rgba(226, 232, 240, 0.96);
  border-radius: 999px;
  background: rgba(248, 250, 252, 0.92);
  color: #475569;
  padding: 8px 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.suggestion-category:hover,
.suggestion-category:focus-visible {
  border-color: rgba(251, 191, 36, 0.72);
  background: rgba(255, 251, 235, 0.96);
  color: #b45309;
  transform: translateY(-1px);
  outline: none;
}

.suggestion-category.is-selected {
  border-color: rgba(245, 158, 11, 0.88);
  background: linear-gradient(135deg, rgba(254, 243, 199, 0.96), rgba(254, 215, 170, 0.88));
  color: #9a3412;
  box-shadow: 0 10px 24px -18px rgba(234, 88, 12, 0.55);
}

.suggestion-category__emoji {
  font-size: 14px;
  line-height: 1;
}

.suggestion-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.suggestion-field > span {
  color: #334155;
  font-size: 13px;
  font-weight: 850;
}

.suggestion-textarea {
  width: 100%;
  min-height: 120px;
  resize: vertical;
  box-sizing: border-box;
  border: 1px solid rgba(226, 232, 240, 0.96);
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.88);
  color: #0f172a;
  padding: 12px 14px;
  font: inherit;
  font-size: 14px;
  line-height: 1.55;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

.suggestion-textarea::placeholder {
  color: #94a3b8;
}

.suggestion-textarea:focus {
  outline: none;
  border-color: rgba(59, 130, 246, 0.72);
  background: #ffffff;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12);
}

.suggestion-field em {
  align-self: flex-end;
  color: #94a3b8;
  font-size: 12px;
  font-style: normal;
  font-weight: 700;
}

.suggestion-field em.is-ready {
  color: #16a34a;
}

.suggestion-panel__footer {
  position: relative;
  z-index: 1;
  margin-top: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.suggestion-panel__hint {
  margin: 0;
  flex: 1;
  min-width: 0;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.45;
  font-weight: 650;
}

.suggestion-panel__hint.is-limit {
  color: #dc2626;
}

.suggestion-submit {
  flex: 0 0 auto;
  min-width: 132px;
  height: 42px;
  border-radius: 999px;
  background: linear-gradient(135deg, #fb923c, #f97316);
  color: #ffffff;
  font-weight: 900;
  box-shadow: 0 14px 28px -16px rgba(234, 88, 12, 0.72);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.suggestion-submit:hover:not(:disabled) {
  background: linear-gradient(135deg, #f97316, #ea580c);
}

.suggestion-submit:disabled {
  opacity: 0.58;
  cursor: not-allowed;
  box-shadow: none;
}

.suggestion-submit svg {
  width: 16px;
  height: 16px;
}

.suggestion-panel-enter-active,
.suggestion-panel-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.suggestion-panel-enter-from,
.suggestion-panel-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}

@keyframes suggestion-mailbox-bob {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-4px) rotate(-2deg);
  }
}

@keyframes suggestion-sparkle-twinkle {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.86) rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: scale(1.08) rotate(12deg);
  }
}

@media (max-width: 640px) {
  .suggestion-panel {
    width: calc(100vw - 20px);
    padding: 22px 18px 18px;
  }

  .suggestion-panel__footer {
    flex-direction: column;
    align-items: stretch;
  }

  .suggestion-submit {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .suggestion-panel__mailbox,
  .suggestion-panel__sparkle {
    animation: none;
  }

  .suggestion-panel-enter-active,
  .suggestion-panel-leave-active {
    transition: none;
  }
}
</style>
