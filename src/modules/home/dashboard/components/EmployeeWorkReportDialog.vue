<script setup lang="ts">
import type { Component } from 'vue'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import IconBrainCircuit from '~icons/lucide/brain-circuit'
import IconCalendarDays from '~icons/lucide/calendar-days'
import IconCheckCircle2 from '~icons/lucide/check-circle-2'
import IconFlame from '~icons/lucide/flame'
import IconLoaderCircle from '~icons/lucide/loader-circle'
import IconQuote from '~icons/lucide/quote'
import IconRefreshCw from '~icons/lucide/refresh-cw'
import IconSparkles from '~icons/lucide/sparkles'
import IconUsersRound from '~icons/lucide/users-round'
import IconX from '~icons/lucide/x'
import AppStateBlock from '@/shared/components/state/AppStateBlock.vue'
import { fetchWorkReportText } from '@/modules/home/dashboard/helpers/workReport.shared'

type ReportSectionKind = 'journey' | 'busiest' | 'focus' | 'collaboration' | 'closing'

interface ReportSection {
  id: string
  kind: ReportSectionKind
  eyebrow: string
  title: string
  icon: Component
  paragraphs: string[]
}

interface TextToken {
  content: string
  strong: boolean
}

const props = withDefaults(
  defineProps<{
    open: boolean
    displayName?: string
  }>(),
  {
    displayName: '你',
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const dialogRef = ref<HTMLElement | null>(null)
const reportText = ref('')
const isLoading = ref(false)
const loadError = ref(false)
let requestId = 0

const reportSections = computed<ReportSection[]>(() => buildReportSections(reportText.value))

function closeDialog() {
  emit('update:open', false)
}

function handleBackdropClick(event: MouseEvent) {
  if (event.target === event.currentTarget) closeDialog()
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeDialog()
}

async function refreshReport() {
  const activeRequest = ++requestId
  isLoading.value = true
  loadError.value = false

  try {
    const text = await fetchWorkReportText()
    if (activeRequest !== requestId) return
    reportText.value = text
  } catch {
    if (activeRequest !== requestId) return
    loadError.value = true
    reportText.value = ''
  } finally {
    if (activeRequest === requestId) isLoading.value = false
  }
}

function getTextTokens(paragraph: string): TextToken[] {
  return paragraph.split(/(\*\*[^*]+\*\*)/g).flatMap((part) => {
    if (!part) return []
    const strong = part.startsWith('**') && part.endsWith('**')
    return [{ content: strong ? part.slice(2, -2) : part, strong }]
  })
}

function splitParagraphs(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\n/g, '').trim())
    .filter(Boolean)
}

function getSectionMeta(paragraph: string, index: number, total: number) {
  if (index === total - 1) {
    return {
      kind: 'closing' as const,
      eyebrow: '下一程',
      title: '把积累带向新的可能',
      icon: IconSparkles,
    }
  }

  if (/忙碌|最为忙|处理了\d+项|高密度/.test(paragraph)) {
    return {
      kind: 'busiest' as const,
      eyebrow: '高光时刻',
      title: '忙碌，也依然从容',
      icon: IconFlame,
    }
  }

  if (/核心精力|数智化|AI技术|数据治理|系统搭建/.test(paragraph)) {
    return {
      kind: 'focus' as const,
      eyebrow: '核心投入',
      title: '向智能化纵深推进',
      icon: IconBrainCircuit,
    }
  }

  if (/会议|协同|沟通|对接|交流|供应商/.test(paragraph)) {
    return {
      kind: 'collaboration' as const,
      eyebrow: '协同连接',
      title: '让共识在行动中落地',
      icon: IconUsersRound,
    }
  }

  return {
    kind: 'journey' as const,
    eyebrow: '工作轨迹',
    title: '每一次投入，都算数',
    icon: index === 0 ? IconCalendarDays : IconCheckCircle2,
  }
}

function buildReportSections(text: string) {
  const paragraphs = splitParagraphs(text)
  const contentParagraphs = paragraphs.filter(
    (paragraph, index) => !(index === 0 && /你好[！!]?$/.test(paragraph)),
  )

  return contentParagraphs.map((paragraph, index) => {
    const meta = getSectionMeta(paragraph, index, contentParagraphs.length)
    return {
      id: `${meta.kind}-${index}`,
      ...meta,
      paragraphs: [paragraph],
    }
  })
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    await nextTick()
    dialogRef.value?.focus()
    void refreshReport()
  },
)

watch(
  () => props.open,
  (open) => {
    if (open) document.addEventListener('keydown', handleKeydown)
    else document.removeEventListener('keydown', handleKeydown)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="work-report-dialog">
      <div v-if="open" class="work-report-backdrop" @click="handleBackdropClick">
        <section
          ref="dialogRef"
          class="work-report-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="work-report-dialog-title"
          tabindex="-1"
        >
          <header class="work-report-dialog__header">
            <h2 id="work-report-dialog-title" class="work-report-dialog__title">这是你的今年回顾</h2>
            <div class="work-report-dialog__actions">
              <button
                type="button"
                class="work-report-icon-btn"
                :disabled="isLoading"
                aria-label="刷新工作总结"
                title="刷新工作总结"
                @click="refreshReport"
              >
                <IconRefreshCw :class="{ 'is-spinning': isLoading }" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="work-report-icon-btn"
                aria-label="关闭工作总结"
                title="关闭"
                @click="closeDialog"
              >
                <IconX aria-hidden="true" />
              </button>
            </div>
          </header>

          <main class="work-report-dialog__body" :aria-busy="isLoading">
            <div v-if="isLoading" class="work-report-loading" role="status" aria-live="polite">
              <IconLoaderCircle aria-hidden="true" />
              <span>正在整理你的工作轨迹…</span>
            </div>

            <AppStateBlock
              v-else-if="loadError"
              type="error"
              title="工作总结暂时未能加载"
              description="请稍后重试，或点击右上角刷新。"
              action-label="重新加载"
              size="sm"
              variant="inline"
              @action="refreshReport"
            />

            <AppStateBlock
              v-else-if="!reportText"
              type="empty"
              title="还没有生成工作总结"
              description="有新的总结后，会在这里为你呈现。"
              size="sm"
              variant="inline"
            />

            <template v-else>
              <aside class="work-report-quote">
                <IconQuote aria-hidden="true" />
                <span>一段段认真投入，汇成了你的工作成长线。</span>
              </aside>

              <article
                v-for="section in reportSections"
                :key="section.id"
                class="work-report-section"
                :class="`is-${section.kind}`"
              >
                <span class="work-report-section__rail" aria-hidden="true" />
                <div class="work-report-section__icon" aria-hidden="true">
                  <component :is="section.icon" />
                </div>
                <div class="work-report-section__content">
                  <p class="work-report-section__eyebrow">{{ section.eyebrow }}</p>
                  <h3>{{ section.title }}</h3>
                  <p
                    v-for="paragraph in section.paragraphs"
                    :key="paragraph"
                    class="work-report-section__text"
                  >
                    <template
                      v-for="(token, tokenIndex) in getTextTokens(paragraph)"
                      :key="tokenIndex"
                    >
                      <strong v-if="token.strong">{{ token.content }}</strong>
                      <template v-else>{{ token.content }}</template>
                    </template>
                  </p>
                </div>
              </article>
            </template>
          </main>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.work-report-backdrop {
  position: fixed;
  inset: 0;
  z-index: 220;
  padding: 32px 20px;
  display: grid;
  place-items: center;
  background: rgba(15, 23, 42, 0.44);
  backdrop-filter: blur(8px);
}

.work-report-dialog {
  --report-ink: #172033;
  --report-muted: #66748e;
  --report-line: rgba(194, 207, 228, 0.72);
  width: min(720px, 100%);
  height: min(860px, calc(100vh - 64px));
  max-height: min(860px, calc(100vh - 64px));
  overflow: hidden;
  border: 1px solid rgba(225, 233, 246, 0.92);
  border-radius: 26px;
  background: #f9fbff;
  box-shadow: 0 36px 96px -40px rgba(15, 23, 42, 0.82);
  color: var(--report-ink);
  outline: none;
}

.work-report-dialog__header {
  position: relative;
  overflow: hidden;
  min-height: 72px;
  padding: 18px 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  background: radial-gradient(circle at 84% 20%, rgba(251, 191, 36, 0.2), transparent 25%),
    radial-gradient(circle at 68% 120%, rgba(37, 99, 235, 0.2), transparent 40%),
    linear-gradient(135deg, #eef5ff, #f8fbff 56%, #fff9ed);
}

.work-report-dialog__header::after {
  position: absolute;
  right: 116px;
  bottom: -44px;
  width: 150px;
  height: 150px;
  border: 1px solid rgba(96, 165, 250, 0.2);
  border-radius: 50%;
  box-shadow:
    0 0 0 18px rgba(96, 165, 250, 0.06),
    0 0 0 36px rgba(96, 165, 250, 0.035);
  content: '';
}

.work-report-dialog__title,
.work-report-dialog__actions {
  position: relative;
  z-index: 1;
}

.work-report-dialog__title {
  margin: 0;
  min-width: 0;
  color: #152342;
  font-size: clamp(20px, 3.4vw, 26px);
  font-weight: 950;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.work-report-dialog__actions {
  display: inline-flex;
  gap: 8px;
  flex: 0 0 auto;
}

.work-report-icon-btn {
  width: 36px;
  height: 36px;
  border: 1px solid rgba(191, 210, 238, 0.74);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.74);
  color: #466284;
  display: inline-grid;
  place-items: center;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.work-report-icon-btn:hover:not(:disabled),
.work-report-icon-btn:focus-visible {
  background: #ffffff;
  color: #2563eb;
  transform: translateY(-1px);
  outline: 2px solid rgba(37, 99, 235, 0.32);
  outline-offset: 2px;
}

.work-report-icon-btn:disabled {
  cursor: wait;
  opacity: 0.58;
}

.work-report-icon-btn svg {
  width: 18px;
  height: 18px;
}

.work-report-icon-btn svg.is-spinning,
.work-report-loading svg {
  animation: work-report-spin 0.82s linear infinite;
}

.work-report-dialog__body {
  max-height: calc(min(860px, 100vh - 64px) - 188px);
  overflow-y: auto;
  padding: 22px 30px 30px;
  scrollbar-color: rgba(148, 163, 184, 0.6) transparent;
}

.work-report-loading {
  min-height: 248px;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 12px;
  color: #60728f;
  font-size: 14px;
  font-weight: 750;
}

.work-report-loading svg {
  width: 28px;
  height: 28px;
  color: #4382e4;
}

.work-report-quote {
  margin: 0 0 18px;
  padding: 12px 15px;
  border-left: 3px solid #70a2ef;
  border-radius: 0 12px 12px 0;
  background: rgba(232, 242, 255, 0.72);
  display: flex;
  align-items: center;
  gap: 8px;
  color: #4e6688;
  font-size: 13px;
  font-weight: 750;
  line-height: 1.5;
}

.work-report-quote svg {
  width: 17px;
  height: 17px;
  color: #4f8ced;
  flex: 0 0 auto;
}

.work-report-section {
  --section-accent: #5e92e8;
  --section-soft: rgba(96, 165, 250, 0.12);
  position: relative;
  padding: 0 0 24px 54px;
}

.work-report-section:not(:last-child)::after {
  position: absolute;
  left: 17px;
  top: 36px;
  bottom: -3px;
  width: 1px;
  background: var(--report-line);
  content: '';
}

.work-report-section.is-busiest {
  --section-accent: #ef8443;
  --section-soft: rgba(251, 146, 60, 0.14);
}

.work-report-section.is-focus {
  --section-accent: #6564dc;
  --section-soft: rgba(129, 140, 248, 0.14);
}

.work-report-section.is-collaboration {
  --section-accent: #1c9a8c;
  --section-soft: rgba(45, 212, 191, 0.14);
}

.work-report-section.is-closing {
  --section-accent: #ba7d1e;
  --section-soft: rgba(251, 191, 36, 0.15);
  padding-bottom: 0;
}

.work-report-section__icon {
  position: absolute;
  left: 0;
  top: 1px;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: var(--section-soft);
  color: var(--section-accent);
  display: grid;
  place-items: center;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--section-accent) 12%, transparent);
}

.work-report-section__icon svg {
  width: 18px;
  height: 18px;
}

.work-report-section__content {
  padding: 2px 0 0;
}

.work-report-section__eyebrow {
  margin: 0 0 4px;
  color: var(--section-accent);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  line-height: 1.2;
}

.work-report-section h3 {
  margin: 0 0 8px;
  color: #23314c;
  font-size: 17px;
  font-weight: 900;
  letter-spacing: -0.015em;
  line-height: 1.3;
}

.work-report-section__text {
  margin: 0;
  color: var(--report-muted);
  font-size: 14px;
  font-weight: 550;
  line-height: 1.78;
}

.work-report-section__text strong {
  color: #364d77;
  font-weight: 900;
}

.work-report-dialog-enter-active,
.work-report-dialog-leave-active {
  transition: opacity 0.2s ease;
}

.work-report-dialog-enter-active .work-report-dialog,
.work-report-dialog-leave-active .work-report-dialog {
  transition:
    transform 0.22s ease,
    opacity 0.2s ease;
}

.work-report-dialog-enter-from,
.work-report-dialog-leave-to {
  opacity: 0;
}

.work-report-dialog-enter-from .work-report-dialog,
.work-report-dialog-leave-to .work-report-dialog {
  opacity: 0;
  transform: translateY(14px) scale(0.98);
}

@keyframes work-report-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .work-report-backdrop {
    padding: 14px;
  }

  .work-report-dialog {
    height: auto;
    max-height: calc(100vh - 28px);
    border-radius: 22px;
  }

  .work-report-dialog__header {
    min-height: 64px;
    padding: 16px 20px;
    gap: 12px;
  }

  .work-report-dialog__title {
    font-size: 20px;
  }

  .work-report-dialog__body {
    max-height: calc(100vh - 178px);
    padding: 18px 20px 24px;
  }

  .work-report-section {
    padding-left: 48px;
  }

  .work-report-section__icon {
    width: 34px;
    height: 34px;
  }

  .work-report-section:not(:last-child)::after {
    left: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .work-report-dialog-enter-active,
  .work-report-dialog-leave-active,
  .work-report-dialog-enter-active .work-report-dialog,
  .work-report-dialog-leave-active .work-report-dialog,
  .work-report-icon-btn,
  .work-report-icon-btn svg.is-spinning,
  .work-report-loading svg {
    animation: none;
    transition: none;
  }
}
</style>
