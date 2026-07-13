<script setup lang="ts">
import type { Component } from 'vue'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import IconAward from '~icons/lucide/award'
import IconCalendarDays from '~icons/lucide/calendar-days'
import IconChevronLeft from '~icons/lucide/chevron-left'
import IconChevronRight from '~icons/lucide/chevron-right'
import IconLoaderCircle from '~icons/lucide/loader-circle'
import IconQuote from '~icons/lucide/quote'
import IconRefreshCw from '~icons/lucide/refresh-cw'
import IconRotateCcw from '~icons/lucide/rotate-ccw'
import IconSparkles from '~icons/lucide/sparkles'
import IconX from '~icons/lucide/x'
import AppStateBlock from '@/shared/components/state/AppStateBlock.vue'
import { fetchWorkReportStorySource } from '@/modules/home/dashboard/helpers/workReport.shared'
import {
  buildWorkReportStorySlides,
  type StorySlide,
  type StorySlideKind,
} from '@/modules/home/dashboard/helpers/workReportStory.helpers'
import type { WorkReportSource } from '@/modules/home/dashboard/services/todo.service'

const SLIDE_ICON_MAP: Record<StorySlideKind, Component> = {
  cover: IconSparkles,
  intro: IconCalendarDays,
  content: IconSparkles,
  closing: IconAward,
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
const reportSource = ref<WorkReportSource>('')
const isLoading = ref(false)
const loadError = ref(false)
const currentSlideIndex = ref(0)
const slideDirection = ref<'forward' | 'backward'>('forward')
const isSlideReady = ref(false)
const visibleTagCount = ref(0)

let requestId = 0
let touchStartX = 0
let touchStartY = 0

const storySlides = computed<StorySlide[]>(() =>
  reportSource.value ? buildWorkReportStorySlides(reportSource.value, props.displayName) : [],
)

const currentSlide = computed(() => storySlides.value[currentSlideIndex.value] ?? null)
const totalSlides = computed(() => storySlides.value.length)
const isCoverSlide = computed(() => currentSlide.value?.kind === 'cover')
const isIntroSlide = computed(() => currentSlide.value?.kind === 'intro')
const isClosingSlide = computed(() => currentSlide.value?.kind === 'closing')
const canGoBack = computed(() => currentSlideIndex.value > 0)
const canGoForward = computed(() => currentSlideIndex.value < totalSlides.value - 1)
const displayInitials = computed(() => props.displayName.trim().slice(0, 1) || '你')
const currentSlideIcon = computed(() =>
  currentSlide.value ? SLIDE_ICON_MAP[currentSlide.value.kind] : IconSparkles,
)

const progressPercent = computed(() => {
  if (totalSlides.value <= 1) return 0
  return (currentSlideIndex.value / (totalSlides.value - 1)) * 100
})

function getTagTone(index: number) {
  return ['tone-blue', 'tone-amber', 'tone-violet', 'tone-teal', 'tone-rose', 'tone-gold'][index % 6]
}

function closeDialog() {
  emit('update:open', false)
}

function handleBackdropClick(event: MouseEvent) {
  if (event.target === event.currentTarget) closeDialog()
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.open) return

  if (event.key === 'Escape') {
    closeDialog()
    return
  }

  if (event.key === 'ArrowRight' || event.key === ' ') {
    event.preventDefault()
    goForward()
    return
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    goBack()
  }
}

function resetStoryState() {
  currentSlideIndex.value = 0
  slideDirection.value = 'forward'
  isSlideReady.value = false
  visibleTagCount.value = 0
}

function animateTags(tags: string[] = []) {
  visibleTagCount.value = 0
  if (tags.length === 0) return

  tags.forEach((_, index) => {
    window.setTimeout(() => {
      if (!props.open) return
      visibleTagCount.value = Math.max(visibleTagCount.value, index + 1)
    }, 180 + index * 140)
  })
}

function prepareSlideAnimations() {
  isSlideReady.value = false
  visibleTagCount.value = 0

  window.setTimeout(() => {
    if (!props.open) return
    isSlideReady.value = true

    const slide = currentSlide.value
    if (!slide) return

    if (slide.tags?.length) {
      animateTags(slide.tags)
    }

  }, 120)
}

function goToSlide(index: number) {
  if (index < 0 || index >= totalSlides.value || index === currentSlideIndex.value) return

  slideDirection.value = index > currentSlideIndex.value ? 'forward' : 'backward'
  currentSlideIndex.value = index
  prepareSlideAnimations()
}

function goForward() {
  if (!canGoForward.value) return

  if (isCoverSlide.value) {
    goToSlide(1)
    return
  }

  slideDirection.value = 'forward'
  currentSlideIndex.value += 1
  prepareSlideAnimations()
}

function goBack() {
  if (!canGoBack.value) return
  slideDirection.value = 'backward'
  currentSlideIndex.value -= 1
  prepareSlideAnimations()
}

function replayStory() {
  goToSlide(0)
}

function handleSlideZoneClick(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const ratio = (event.clientX - rect.left) / rect.width

  if (ratio < 0.34) {
    goBack()
    return
  }

  if (ratio > 0.66) {
    goForward()
  }
}

function handleTouchStart(event: TouchEvent) {
  const touch = event.changedTouches[0]
  touchStartX = touch.clientX
  touchStartY = touch.clientY
}

function handleTouchEnd(event: TouchEvent) {
  const touch = event.changedTouches[0]
  const deltaX = touch.clientX - touchStartX
  const deltaY = touch.clientY - touchStartY

  if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY)) return

  if (deltaX < 0) {
    goForward()
  } else {
    goBack()
  }
}

async function loadReport() {
  const activeRequest = ++requestId
  isLoading.value = true
  loadError.value = false
  resetStoryState()

  try {
    const source = await fetchWorkReportStorySource()
    if (activeRequest !== requestId) return
    reportSource.value = source
    await nextTick()
    prepareSlideAnimations()
  } catch {
    if (activeRequest !== requestId) return
    loadError.value = true
    reportSource.value = ''
  } finally {
    if (activeRequest === requestId) isLoading.value = false
  }
}

function refreshReport() {
  void loadReport()
}

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      resetStoryState()
      return
    }

    await nextTick()
    dialogRef.value?.focus()
    void loadReport()
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
    <Transition name="work-report-story">
      <div v-if="open" class="work-report-story-backdrop" @click="handleBackdropClick">
        <div class="work-report-story-backdrop__glow work-report-story-backdrop__glow--left" aria-hidden="true" />
        <div class="work-report-story-backdrop__glow work-report-story-backdrop__glow--right" aria-hidden="true" />

        <section
          ref="dialogRef"
          class="work-report-story-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="work-report-story-title"
          tabindex="-1"
          @click.stop
        >
          <header class="work-report-story-dialog__header">
            <div class="work-report-story-dialog__header-orb" aria-hidden="true" />
            <h2 id="work-report-story-title" class="work-report-story-dialog__title">这是你的今年回顾</h2>

            <div class="work-report-story-dialog__actions">
              <button
                type="button"
                class="work-report-story-icon-btn"
                :disabled="isLoading"
                aria-label="刷新工作总结"
                title="刷新工作总结"
                @click="refreshReport"
              >
                <IconRefreshCw :class="{ 'is-spinning': isLoading }" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="work-report-story-icon-btn"
                aria-label="关闭工作总结"
                title="关闭"
                @click="closeDialog"
              >
                <IconX aria-hidden="true" />
              </button>
            </div>
          </header>

          <div
            v-if="!isLoading && !loadError && totalSlides > 0"
            class="work-report-story-dialog__segments"
            aria-hidden="true"
          >
            <button
              v-for="(slide, index) in storySlides"
              :key="slide.id"
              type="button"
              class="work-report-story-segment"
              :class="{ 'is-active': index === currentSlideIndex, 'is-done': index < currentSlideIndex }"
              :aria-label="`跳转到第 ${index + 1} 屏`"
              @click="goToSlide(index)"
            >
              <span class="work-report-story-segment__fill" />
            </button>
          </div>

          <main class="work-report-story-dialog__body" :aria-busy="isLoading">
            <div v-if="isLoading" class="work-report-story-loading" role="status" aria-live="polite">
              <div class="work-report-story-loading__orb" aria-hidden="true">
                <IconLoaderCircle />
              </div>
              <strong>正在编排你的分镜故事</strong>
              <span>把每一段投入，都变成值得回看的画面</span>
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
              v-else-if="!currentSlide"
              type="empty"
              title="还没有生成工作总结"
              description="有新的总结后，会在这里为你呈现。"
              size="sm"
              variant="inline"
            />

            <div
              v-else
              class="work-report-story-stage"
              :class="[
                `is-accent-${currentSlide.accent}`,
                `is-kind-${currentSlide.kind}`,
                { 'is-ready': isSlideReady },
              ]"
              @click="handleSlideZoneClick"
              @touchstart.passive="handleTouchStart"
              @touchend.passive="handleTouchEnd"
            >
              <div class="work-report-story-stage__backdrop" aria-hidden="true">
                <span class="work-report-story-stage__grid" />
                <span class="work-report-story-stage__orb work-report-story-stage__orb--one" />
                <span class="work-report-story-stage__orb work-report-story-stage__orb--two" />
                <span class="work-report-story-stage__orb work-report-story-stage__orb--three" />
                <span class="work-report-story-stage__ring" />
                <span
                  v-if="isClosingSlide"
                  class="work-report-story-stage__confetti"
                />
              </div>

              <Transition
                :name="slideDirection === 'forward' ? 'story-slide-forward' : 'story-slide-backward'"
                mode="out-in"
              >
                <article :key="currentSlide.id" class="work-report-story-slide">
                  <div
                    class="work-report-story-slide__panel"
                    :class="{ 'is-cover': isCoverSlide, 'is-hero': isIntroSlide }"
                  >
                    <div v-if="!isCoverSlide" class="work-report-story-slide__badge-row">
                      <span class="work-report-story-slide__icon-badge" aria-hidden="true">
                        <component :is="currentSlideIcon" />
                      </span>
                      <p v-if="currentSlide.eyebrow" class="work-report-story-slide__eyebrow">
                        {{ currentSlide.eyebrow }}
                      </p>
                    </div>

                    <div v-if="isIntroSlide" class="work-report-story-avatar" aria-hidden="true">
                      <span class="work-report-story-avatar__ring" />
                      <span class="work-report-story-avatar__core">{{ displayInitials }}</span>
                    </div>

                    <h3
                      class="work-report-story-slide__title"
                      :class="{ 'is-gradient': isCoverSlide || isClosingSlide }"
                    >
                      {{ currentSlide.title }}
                    </h3>

                    <p v-if="currentSlide.subtitle" class="work-report-story-slide__subtitle">
                      {{ currentSlide.subtitle }}
                    </p>

                    <p
                      v-if="currentSlide.body"
                      class="work-report-story-slide__body"
                    >
                      {{ currentSlide.body }}
                    </p>

                    <div v-if="currentSlide.tags?.length" class="work-report-story-tags">
                      <span
                        v-for="(tag, index) in currentSlide.tags"
                        :key="tag"
                        class="work-report-story-tag"
                        :class="[getTagTone(index), { 'is-visible': index < visibleTagCount }]"
                        :style="{ transitionDelay: `${index * 80}ms` }"
                      >
                        {{ tag }}
                      </span>
                    </div>

                    <blockquote v-if="currentSlide.quote" class="work-report-story-quote">
                      <IconQuote class="work-report-story-quote__icon" aria-hidden="true" />
                      <span>「{{ currentSlide.quote }}」</span>
                    </blockquote>

                    <div
                      v-if="isCoverSlide || isClosingSlide"
                      class="work-report-story-slide__footer"
                    >
                      <button
                        v-if="isCoverSlide"
                        type="button"
                        class="work-report-story-primary-btn"
                        @click.stop="goForward()"
                      >
                        <IconSparkles aria-hidden="true" />
                        开始回顾
                        <IconChevronRight aria-hidden="true" />
                      </button>

                      <button
                        v-else
                        type="button"
                        class="work-report-story-primary-btn is-soft"
                        @click.stop="replayStory"
                      >
                        <IconRotateCcw aria-hidden="true" />
                        再看一遍
                      </button>
                    </div>
                  </div>
                </article>
              </Transition>

              <div class="work-report-story-stage__nav" aria-hidden="true">
                <button
                  type="button"
                  class="work-report-story-stage__nav-btn"
                  :disabled="!canGoBack"
                  aria-label="上一屏"
                  @click.stop="goBack"
                >
                  <IconChevronLeft />
                </button>
                <button
                  type="button"
                  class="work-report-story-stage__nav-btn"
                  :disabled="!canGoForward"
                  aria-label="下一屏"
                  @click.stop="goForward()"
                >
                  <IconChevronRight />
                </button>
              </div>
            </div>
          </main>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.work-report-story-backdrop {
  --story-glow-blue: rgba(59, 130, 246, 0.34);
  --story-glow-amber: rgba(245, 158, 11, 0.28);
  position: fixed;
  inset: 0;
  z-index: 220;
  padding: 24px 16px;
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at 18% 16%, rgba(37, 99, 235, 0.2), transparent 28%),
    radial-gradient(circle at 82% 78%, rgba(245, 158, 11, 0.16), transparent 30%),
    rgba(8, 15, 31, 0.62);
  backdrop-filter: blur(14px);
}

.work-report-story-backdrop__glow {
  position: absolute;
  border-radius: 999px;
  filter: blur(48px);
  pointer-events: none;
}

.work-report-story-backdrop__glow--left {
  left: 8%;
  top: 18%;
  width: 220px;
  height: 220px;
  background: var(--story-glow-blue);
}

.work-report-story-backdrop__glow--right {
  right: 10%;
  bottom: 14%;
  width: 260px;
  height: 260px;
  background: var(--story-glow-amber);
}

.work-report-story-dialog {
  position: relative;
  width: min(780px, 100%);
  height: min(880px, calc(100vh - 48px));
  max-height: min(880px, calc(100vh - 48px));
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.42);
  border-radius: 30px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 250, 255, 0.96)),
    #f5f9ff;
  box-shadow:
    0 48px 120px -44px rgba(2, 8, 23, 0.82),
    inset 0 1px 0 rgba(255, 255, 255, 0.92);
  color: #172033;
  outline: none;
  display: flex;
  flex-direction: column;
}

.work-report-story-dialog__header {
  position: relative;
  overflow: hidden;
  min-height: 72px;
  padding: 18px 26px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background:
    radial-gradient(circle at 88% 18%, rgba(251, 191, 36, 0.22), transparent 24%),
    radial-gradient(circle at 72% 120%, rgba(37, 99, 235, 0.18), transparent 38%),
    linear-gradient(135deg, #edf4ff, #f8fbff 58%, #fff8ec);
  border-bottom: 1px solid rgba(214, 226, 244, 0.82);
}

.work-report-story-dialog__header-orb {
  position: absolute;
  right: 118px;
  bottom: -42px;
  width: 148px;
  height: 148px;
  border: 1px solid rgba(96, 165, 250, 0.22);
  border-radius: 50%;
  box-shadow:
    0 0 0 16px rgba(96, 165, 250, 0.05),
    0 0 0 32px rgba(96, 165, 250, 0.03);
}

.work-report-story-dialog__title,
.work-report-story-dialog__actions {
  position: relative;
  z-index: 1;
}

.work-report-story-dialog__title {
  margin: 0;
  min-width: 0;
  color: #152342;
  font-size: clamp(20px, 3.4vw, 26px);
  font-weight: 950;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.work-report-story-dialog__actions {
  display: inline-flex;
  gap: 8px;
}

.work-report-story-icon-btn {
  width: 38px;
  height: 38px;
  border: 1px solid rgba(191, 210, 238, 0.74);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.82);
  color: #466284;
  display: inline-grid;
  place-items: center;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.work-report-story-icon-btn:hover:not(:disabled),
.work-report-story-icon-btn:focus-visible {
  background: #ffffff;
  color: #2563eb;
  transform: translateY(-1px);
  outline: 2px solid rgba(37, 99, 235, 0.28);
  outline-offset: 2px;
}

.work-report-story-icon-btn:disabled {
  opacity: 0.58;
  cursor: wait;
}

.work-report-story-icon-btn svg {
  width: 18px;
  height: 18px;
}

.work-report-story-icon-btn svg.is-spinning,
.work-report-story-loading__orb svg {
  animation: work-report-story-spin 0.82s linear infinite;
}

.work-report-story-dialog__segments {
  display: flex;
  gap: 6px;
  padding: 12px 22px 0;
}

.work-report-story-segment {
  flex: 1;
  height: 5px;
  border: 0;
  border-radius: 999px;
  background: rgba(191, 210, 238, 0.42);
  overflow: hidden;
  cursor: pointer;
  padding: 0;
}

.work-report-story-segment__fill {
  display: block;
  width: 0;
  height: 100%;
  border-radius: inherit;
  background: #5b8fd9;
  transition: width 0.28s ease;
}

.work-report-story-segment.is-done .work-report-story-segment__fill,
.work-report-story-segment.is-active .work-report-story-segment__fill {
  width: 100%;
}

.work-report-story-dialog__body {
  flex: 1;
  min-height: 0;
  padding: 14px 18px 20px;
}

.work-report-story-loading {
  min-height: 100%;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 8px;
  text-align: center;
}

.work-report-story-loading__orb {
  width: 58px;
  height: 58px;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.14), rgba(251, 191, 36, 0.16));
  display: grid;
  place-items: center;
  color: #3b82f6;
  box-shadow: inset 0 0 0 1px rgba(147, 180, 238, 0.42);
}

.work-report-story-loading__orb svg {
  width: 28px;
  height: 28px;
}

.work-report-story-loading strong {
  color: #334155;
  font-size: 15px;
  font-weight: 900;
}

.work-report-story-loading span {
  color: #6b7c98;
  font-size: 13px;
  font-weight: 650;
}

.work-report-story-stage {
  --stage-accent: #3b82f6;
  --stage-accent-soft: rgba(59, 130, 246, 0.14);
  --stage-accent-glow: rgba(59, 130, 246, 0.24);
  position: relative;
  height: 100%;
  min-height: 540px;
  border-radius: 24px;
  overflow: hidden;
  box-shadow:
    inset 0 0 0 1px rgba(214, 226, 244, 0.72),
    0 24px 48px -36px rgba(15, 23, 42, 0.45);
}

.work-report-story-stage.is-accent-blue {
  --stage-accent: #3b82f6;
  --stage-accent-soft: rgba(59, 130, 246, 0.16);
  --stage-accent-glow: rgba(59, 130, 246, 0.28);
}

.work-report-story-stage.is-accent-amber {
  --stage-accent: #f59e0b;
  --stage-accent-soft: rgba(245, 158, 11, 0.18);
  --stage-accent-glow: rgba(245, 158, 11, 0.28);
}

.work-report-story-stage.is-accent-violet {
  --stage-accent: #7c6cf0;
  --stage-accent-soft: rgba(124, 108, 240, 0.18);
  --stage-accent-glow: rgba(124, 108, 240, 0.28);
}

.work-report-story-stage.is-accent-teal {
  --stage-accent: #14b8a6;
  --stage-accent-soft: rgba(20, 184, 166, 0.18);
  --stage-accent-glow: rgba(20, 184, 166, 0.28);
}

.work-report-story-stage.is-accent-gold {
  --stage-accent: #d97706;
  --stage-accent-soft: rgba(217, 119, 6, 0.18);
  --stage-accent-glow: rgba(217, 119, 6, 0.28);
}

.work-report-story-stage__backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 84% 12%, var(--stage-accent-glow), transparent 28%),
    radial-gradient(circle at 12% 88%, rgba(255, 255, 255, 0.42), transparent 34%),
    linear-gradient(155deg, rgba(255, 255, 255, 0.92), rgba(248, 251, 255, 0.88));
}

.work-report-story-stage__grid {
  position: absolute;
  inset: 0;
  opacity: 0.42;
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.12) 1px, transparent 1px);
  background-size: 24px 24px;
  mask-image: radial-gradient(circle at 50% 42%, black, transparent 78%);
}

.work-report-story-stage__orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(2px);
  opacity: 0.72;
}

.work-report-story-stage__orb--one {
  top: 8%;
  right: 10%;
  width: 120px;
  height: 120px;
  background: radial-gradient(circle, var(--stage-accent-soft), transparent 70%);
  animation: story-orb-float 7s ease-in-out infinite;
}

.work-report-story-stage__orb--two {
  left: 8%;
  bottom: 16%;
  width: 160px;
  height: 160px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.72), transparent 72%);
  animation: story-orb-float 9s ease-in-out infinite reverse;
}

.work-report-story-stage__orb--three {
  top: 42%;
  left: 54%;
  width: 88px;
  height: 88px;
  background: radial-gradient(circle, var(--stage-accent-glow), transparent 72%);
  animation: story-orb-float 6.5s ease-in-out infinite;
}

.work-report-story-stage__ring {
  position: absolute;
  right: -28px;
  top: 48px;
  width: 180px;
  height: 180px;
  border: 1px solid color-mix(in srgb, var(--stage-accent) 18%, transparent);
  border-radius: 50%;
  box-shadow:
    0 0 0 18px color-mix(in srgb, var(--stage-accent) 5%, transparent),
    0 0 0 36px color-mix(in srgb, var(--stage-accent) 3%, transparent);
}

.work-report-story-stage__confetti {
  position: absolute;
  inset: 0;
  opacity: 0.55;
  background-image:
    radial-gradient(circle at 12% 18%, rgba(245, 158, 11, 0.8) 0 2px, transparent 3px),
    radial-gradient(circle at 78% 22%, rgba(59, 130, 246, 0.75) 0 2px, transparent 3px),
    radial-gradient(circle at 64% 72%, rgba(236, 72, 153, 0.7) 0 2px, transparent 3px),
    radial-gradient(circle at 24% 68%, rgba(20, 184, 166, 0.7) 0 2px, transparent 3px),
    radial-gradient(circle at 88% 58%, rgba(124, 108, 240, 0.7) 0 2px, transparent 3px);
  animation: story-confetti-twinkle 3.6s ease-in-out infinite;
}

.work-report-story-slide {
  position: relative;
  z-index: 1;
  height: 100%;
  padding: 24px 22px 92px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.work-report-story-slide__panel {
  width: min(100%, 620px);
  padding: 24px 24px 20px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.88);
  box-shadow:
    0 24px 48px -32px rgba(15, 23, 42, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(16px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  transform: translateY(8px);
  opacity: 0;
  transition:
    opacity 0.34s ease,
    transform 0.34s ease;
}

.work-report-story-stage.is-ready .work-report-story-slide__panel {
  opacity: 1;
  transform: translateY(0);
}

.work-report-story-slide__panel.is-cover,
.work-report-story-slide__panel.is-hero {
  padding-top: 28px;
}

.work-report-story-slide__panel.is-cover {
  text-align: center;
  align-items: center;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(255, 255, 255, 0.68)),
    rgba(255, 255, 255, 0.72);
}

.work-report-story-slide__badge-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.work-report-story-slide__icon-badge {
  width: 38px;
  height: 38px;
  border-radius: 14px;
  background: var(--stage-accent-soft);
  color: var(--stage-accent);
  display: grid;
  place-items: center;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--stage-accent) 16%, transparent);
}

.work-report-story-slide__icon-badge svg {
  width: 18px;
  height: 18px;
}

.work-report-story-slide__eyebrow {
  margin: 0;
  color: var(--stage-accent);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.work-report-story-avatar {
  position: relative;
  width: 72px;
  height: 72px;
  margin-bottom: 4px;
}

.work-report-story-avatar__ring {
  position: absolute;
  inset: 0;
  border-radius: 24px;
  background: linear-gradient(135deg, var(--stage-accent), #f59e0b);
  transform: rotate(8deg);
  opacity: 0.88;
}

.work-report-story-avatar__core {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.96);
  color: #17305d;
  display: grid;
  place-items: center;
  font-size: 28px;
  font-weight: 950;
  box-shadow: inset 0 0 0 1px rgba(214, 226, 244, 0.82);
}

.work-report-story-slide__title {
  margin: 0;
  color: #152342;
  font-size: clamp(30px, 5vw, 46px);
  font-weight: 950;
  letter-spacing: -0.045em;
  line-height: 1.06;
}

.work-report-story-slide__title.is-gradient {
  background: linear-gradient(135deg, #17305d 10%, var(--stage-accent) 58%, #f59e0b 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.work-report-story-slide__subtitle {
  margin: 0;
  color: #5d6f8d;
  font-size: 15px;
  font-weight: 750;
  line-height: 1.55;
}

.work-report-story-slide__body {
  margin: 4px 0 0;
  padding: 14px 16px;
  border-radius: 16px;
  background: linear-gradient(90deg, var(--stage-accent-soft), rgba(255, 255, 255, 0.42));
  color: #4d607e;
  font-size: 14px;
  font-weight: 650;
  line-height: 1.8;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 6;
  overflow: hidden;
}

.work-report-story-slide__body.is-compact {
  -webkit-line-clamp: 3;
}

.work-report-story-metrics {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.work-report-story-metric {
  position: relative;
  overflow: hidden;
  padding: 16px 18px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow:
    inset 0 0 0 1px rgba(214, 226, 244, 0.78),
    0 16px 30px -24px rgba(15, 23, 42, 0.45);
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16px;
}

.work-report-story-metric::after {
  position: absolute;
  inset: auto -20px -28px auto;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  background: var(--stage-accent-soft);
  content: '';
}

.work-report-story-metric.is-metric-1 {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(239, 246, 255, 0.88));
}

.work-report-story-metric.is-metric-2 {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(255, 247, 237, 0.9));
}

.work-report-story-metric.is-metric-3 {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(240, 253, 250, 0.9));
}

.work-report-story-metric__icon {
  position: relative;
  z-index: 1;
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: var(--stage-accent-soft);
  color: var(--stage-accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 56px;
}

.work-report-story-metric__icon svg {
  display: block;
  width: 26px;
  height: 26px;
}

.work-report-story-metric__content {
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.work-report-story-metric__value {
  display: block;
  color: #17305d;
  font-size: clamp(24px, 4vw, 32px);
  font-weight: 950;
  letter-spacing: -0.02em;
  line-height: 1.2;
  white-space: nowrap;
}

.work-report-story-metric__label {
  display: block;
  color: #64748f;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.4;
}

.work-report-story-hero-metric strong {
  display: block;
  color: #17305d;
  font-size: clamp(24px, 3.6vw, 34px);
  font-weight: 950;
  letter-spacing: -0.03em;
  line-height: 1.08;
  white-space: nowrap;
}

.work-report-story-hero-metric span {
  display: block;
  margin-top: 6px;
  color: #64748f;
  font-size: 12px;
  font-weight: 800;
}

.work-report-story-hero-metric {
  position: relative;
  align-self: flex-start;
  min-width: 210px;
  padding: 18px 20px;
  border-radius: 22px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(255, 247, 237, 0.92));
  box-shadow:
    inset 0 0 0 1px rgba(251, 191, 36, 0.28),
    0 20px 36px -24px rgba(245, 158, 11, 0.42);
}

.work-report-story-hero-metric__halo {
  position: absolute;
  inset: -16px;
  border-radius: 28px;
  background: radial-gradient(circle, rgba(245, 158, 11, 0.18), transparent 68%);
}

.work-report-story-hero-metric__icon {
  position: absolute;
  top: 12px;
  right: 14px;
  color: rgba(245, 158, 11, 0.42);
}

.work-report-story-hero-metric__icon svg {
  width: 34px;
  height: 34px;
}

.work-report-story-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 4px;
}

.work-report-story-tag {
  padding: 8px 13px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 850;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.42);
  opacity: 0;
  transform: translateY(12px) scale(0.94) rotate(-2deg);
  transition:
    opacity 0.28s ease,
    transform 0.28s ease;
}

.work-report-story-tag.is-visible {
  opacity: 1;
  transform: translateY(0) scale(1) rotate(0deg);
}

.work-report-story-tag.tone-blue {
  background: rgba(219, 234, 254, 0.92);
  color: #1d4ed8;
}

.work-report-story-tag.tone-amber {
  background: rgba(254, 243, 199, 0.94);
  color: #b45309;
}

.work-report-story-tag.tone-violet {
  background: rgba(237, 233, 254, 0.94);
  color: #6d28d9;
}

.work-report-story-tag.tone-teal {
  background: rgba(204, 251, 241, 0.94);
  color: #0f766e;
}

.work-report-story-tag.tone-rose {
  background: rgba(255, 228, 230, 0.94);
  color: #be123c;
}

.work-report-story-tag.tone-gold {
  background: rgba(254, 249, 195, 0.94);
  color: #a16207;
}

.work-report-story-quote {
  margin: 6px 0 0;
  padding: 16px 18px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(255, 247, 237, 0.94), rgba(255, 255, 255, 0.84));
  color: #8a5b16;
  font-size: 17px;
  font-weight: 900;
  line-height: 1.55;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  box-shadow: inset 0 0 0 1px rgba(251, 191, 36, 0.28);
}

.work-report-story-quote__icon {
  width: 20px;
  height: 20px;
  color: #f59e0b;
  flex: 0 0 auto;
  margin-top: 2px;
}

.work-report-story-slide__footer {
  margin-top: auto;
  padding-top: 8px;
}

.work-report-story-primary-btn {
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #2563eb, #3b82f6 58%, #60a5fa);
  color: #ffffff;
  min-height: 46px;
  padding: 0 20px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font: inherit;
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
  box-shadow:
    0 18px 34px -18px rgba(37, 99, 235, 0.82),
    inset 0 1px 0 rgba(255, 255, 255, 0.28);
  transition: transform 0.18s ease;
}

.work-report-story-primary-btn.is-soft {
  background: linear-gradient(135deg, #f59e0b, #fbbf24 58%, #fde68a);
  color: #7c4a03;
  box-shadow:
    0 18px 34px -18px rgba(245, 158, 11, 0.72),
    inset 0 1px 0 rgba(255, 255, 255, 0.42);
}

.work-report-story-primary-btn:hover,
.work-report-story-primary-btn:focus-visible {
  transform: translateY(-2px);
  outline: 2px solid rgba(37, 99, 235, 0.28);
  outline-offset: 2px;
}

.work-report-story-primary-btn svg {
  width: 16px;
  height: 16px;
}

.work-report-story-stage__nav {
  position: absolute;
  inset: auto 18px 18px;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  pointer-events: none;
}

.work-report-story-stage__nav-btn {
  width: 38px;
  height: 38px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.84);
  color: #4b6287;
  display: inline-grid;
  place-items: center;
  pointer-events: auto;
  cursor: pointer;
  box-shadow: 0 12px 24px -18px rgba(15, 23, 42, 0.42);
  transition:
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.work-report-story-stage__nav-btn:hover:not(:disabled),
.work-report-story-stage__nav-btn:focus-visible {
  background: #ffffff;
  color: #2563eb;
  transform: translateY(-1px);
}

.work-report-story-stage__nav-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.work-report-story-stage__nav-btn svg {
  width: 18px;
  height: 18px;
}

.story-slide-forward-enter-active,
.story-slide-forward-leave-active,
.story-slide-backward-enter-active,
.story-slide-backward-leave-active {
  transition:
    opacity 0.28s ease,
    transform 0.28s ease,
    filter 0.28s ease;
}

.story-slide-forward-enter-from {
  opacity: 0;
  transform: translateX(34px) scale(0.98);
  filter: blur(4px);
}

.story-slide-forward-leave-to {
  opacity: 0;
  transform: translateX(-28px) scale(0.98);
  filter: blur(4px);
}

.story-slide-backward-enter-from {
  opacity: 0;
  transform: translateX(-34px) scale(0.98);
  filter: blur(4px);
}

.story-slide-backward-leave-to {
  opacity: 0;
  transform: translateX(28px) scale(0.98);
  filter: blur(4px);
}

.work-report-story-enter-active,
.work-report-story-leave-active {
  transition: opacity 0.22s ease;
}

.work-report-story-enter-active .work-report-story-dialog,
.work-report-story-leave-active .work-report-story-dialog {
  transition:
    transform 0.24s ease,
    opacity 0.22s ease;
}

.work-report-story-enter-from,
.work-report-story-leave-to {
  opacity: 0;
}

.work-report-story-enter-from .work-report-story-dialog,
.work-report-story-leave-to .work-report-story-dialog {
  opacity: 0;
  transform: translateY(16px) scale(0.98);
}

@keyframes work-report-story-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes story-orb-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes story-confetti-twinkle {
  0%,
  100% {
    opacity: 0.42;
  }
  50% {
    opacity: 0.72;
  }
}

@media (max-width: 640px) {
  .work-report-story-backdrop {
    padding: 10px;
  }

  .work-report-story-dialog {
    height: auto;
    max-height: calc(100vh - 20px);
    border-radius: 24px;
  }

  .work-report-story-dialog__header {
    min-height: 64px;
    padding: 16px 16px;
  }

  .work-report-story-dialog__title {
    font-size: 20px;
  }

  .work-report-story-dialog__segments,
  .work-report-story-dialog__body {
    padding-left: 12px;
    padding-right: 12px;
  }

  .work-report-story-slide {
    padding: 16px 12px 84px;
  }

  .work-report-story-slide__panel {
    padding: 18px 16px 16px;
    border-radius: 20px;
  }

  .work-report-story-slide__body {
    -webkit-line-clamp: 8;
  }
}

@media (prefers-reduced-motion: reduce) {
  .work-report-story-enter-active,
  .work-report-story-leave-active,
  .work-report-story-enter-active .work-report-story-dialog,
  .work-report-story-leave-active .work-report-story-dialog,
  .story-slide-forward-enter-active,
  .story-slide-forward-leave-active,
  .story-slide-backward-enter-active,
  .story-slide-backward-leave-active,
  .work-report-story-icon-btn svg.is-spinning,
  .work-report-story-loading__orb svg,
  .work-report-story-tag,
  .work-report-story-segment__fill,
  .work-report-story-stage__orb,
  .work-report-story-stage__confetti,
  .work-report-story-slide__panel {
    animation: none;
    transition: none;
    filter: none;
  }
}
</style>
