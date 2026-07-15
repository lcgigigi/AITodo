<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import IconArrowLeft from '~icons/lucide/arrow-left'
import IconArrowRight from '~icons/lucide/arrow-right'
import IconCheck from '~icons/lucide/check'
import IconRocket from '~icons/lucide/rocket'
import IconSparkles from '~icons/lucide/sparkles'
import IconX from '~icons/lucide/x'
import {
  DASHBOARD_ONBOARDING_TOUR_EVENT,
  dispatchDashboardOnboardingTourCloseDayPreview,
} from '@/modules/home/dashboard/helpers/onboardingTour'

type TourAnchor = 'left' | 'right' | 'top' | 'bottom' | 'center'
type DashboardViewMode = 'simple' | 'detail'

type TourStep = {
  target: string
  fallbackTarget?: string
  openTarget?: string
  placement?: TourAnchor
  viewMode?: DashboardViewMode
  eyebrow: string
  title: string
  description: string
  action: string
  accent: string
  closeDayPreview?: boolean
  closeNotificationPanel?: boolean
  spotlightPadding?: number
  spotlightRadius?: number
}

type SpotlightRect = {
  top: number
  left: number
  width: number
  height: number
  radius: number
  visible: boolean
}

const props = withDefaults(
  defineProps<{
    enabled?: boolean
  }>(),
  {
    enabled: true,
  },
)

const emit = defineEmits<{
  'request-view-mode': [mode: DashboardViewMode]
}>()

const CARD_WIDTH = 380
const CARD_ESTIMATED_HEIGHT = 360
const VIEWPORT_PADDING = 16

const steps: TourStep[] = [
  {
    target: 'today-panel',
    eyebrow: '第一站',
    title: '今天先看这块工作面板',
    description:
      '问候、模式切换、本周日期、今日统计和待办列表都集中在这张卡片里，点日期或统计卡就能打开当天详情。',
    action: '从这里判断今天先处理什么，避免在多个入口之间来回找。',
    accent: '#2f7cff',
    placement: 'center',
    spotlightPadding: 0,
    spotlightRadius: 24,
  },
  {
    target: 'home-calendar',
    fallbackTarget: 'today-panel',
    eyebrow: '日期导航',
    title: '先选中你要处理的一天',
    description: '顶部周日历可以前后切换周次，日期下方的色点会提示当天是否有待办或会议。',
    action: '点击日期后，下方统计和列表会同步切换。',
    accent: '#2563eb',
    spotlightPadding: 4,
    spotlightRadius: 16,
  },
  {
    target: 'home-todo-overview',
    fallbackTarget: 'today-panel',
    eyebrow: '待办总览',
    title: '统计、筛选和待办列表在同一区域',
    description: '可以按全部、待办、会议以及派发关系快速筛选；点击待办查看详情，也可直接标记完成。',
    action: '先用统计缩小范围，再在列表里集中处理。',
    accent: '#8b5cf6',
    spotlightPadding: 0,
    spotlightRadius: 18,
  },
  {
    target: 'quick-create',
    fallbackTarget: 'home-todo-overview',
    eyebrow: '快速创建',
    title: '一句话创建，或进入完整表单',
    description: '直接输入一句待办后回车，系统会先预填创建卡片；需要精确设置时，点「完整创建」。',
    action: '下一步会自动打开创建卡片，不会保存数据。',
    accent: '#10b981',
    spotlightPadding: 4,
    spotlightRadius: 14,
  },
  {
    target: 'todo-create-panel',
    fallbackTarget: 'today-panel',
    openTarget: 'add-todo',
    eyebrow: '创建卡片',
    title: '在一张卡片里补齐所有关键信息',
    description: '可先用 AI 解析自然语言，再确认事项类型、日期时间、负责人、内容和备注。',
    action: '导览只展示编辑流程；离开这一步时会关闭草稿，不会自动保存。',
    accent: '#2f7cff',
    spotlightPadding: 0,
    spotlightRadius: 24,
  },
  {
    target: 'tool-dock',
    fallbackTarget: 'today-panel',
    eyebrow: '工具坞',
    title: '常用 AI 能力在卡片底部',
    description: '力宝百问、图文分析、会议纪要、智能 PPT 和更多工具都放在工作台底部。',
    action: '把它当成工作台的快捷启动器，少走菜单层级。',
    accent: '#f59e0b',
    closeDayPreview: true,
    spotlightPadding: 6,
    spotlightRadius: 18,
  },
  {
    target: 'detail-mode',
    fallbackTarget: 'today-panel',
    viewMode: 'simple',
    eyebrow: '深度工作台',
    title: '需要全量复盘时切换深度工作台',
    description:
      '顶栏展开/收起图标可在总览卡片与深度工作台之间直接切换，适合按日期筛选、复盘和批量处理。',
    action: '总览视角负责快速判断，深度工作台负责深挖和整理。',
    accent: '#ef4444',
    closeDayPreview: true,
    spotlightPadding: 4,
    spotlightRadius: 12,
  },
  {
    target: 'detail-workspace',
    viewMode: 'detail',
    placement: 'center',
    eyebrow: '详细模式',
    title: '这就是展开后的深度工作台',
    description:
      '左侧用月历或周历选择日期，右侧会展示当天待办，并可按类型、状态和派发关系进一步筛选。',
    action: '适合集中复盘、跨日查看和批量整理；下一步会自动回到总览。',
    accent: '#ef4444',
    closeDayPreview: true,
    spotlightPadding: 0,
    spotlightRadius: 22,
  },
  {
    target: 'notifications',
    fallbackTarget: 'today-panel',
    viewMode: 'simple',
    eyebrow: '协作提醒',
    title: '消息中心会收住协作变更',
    description: '别人派发给你的待办、站内消息和会议通知会在这里聚合，未读数会主动提示。',
    action: '每天开始工作时扫一眼，先处理需要确认的事项。',
    accent: '#06b6d4',
    closeDayPreview: true,
    spotlightPadding: 6,
    spotlightRadius: 18,
  },
  {
    target: 'notification-panel',
    fallbackTarget: 'notifications',
    openTarget: 'notifications',
    eyebrow: '消息弹层',
    title: '消息中心会在当前工作台内展开',
    description:
      '可在「待处理」和「全部」之间筛选；派发给你的待办可直接接受或拒绝，其他消息也可标记已读。',
    action: '处理完后可留在当前页面，不需要来回跳转。',
    accent: '#06b6d4',
    closeDayPreview: true,
    spotlightPadding: 0,
    spotlightRadius: 22,
  },
  {
    target: 'work-report',
    fallbackTarget: 'dashboard-topbar',
    eyebrow: '工作回顾',
    title: '从日常待办中直接生成工作总结',
    description: '「工作总结」提供经典阅读和分镜回顾两种呈现方式，适合不同的回看场景。',
    action: '需要周报、阶段复盘或年终回顾时，从这里开始。',
    accent: '#7c3aed',
    closeNotificationPanel: true,
    spotlightPadding: 4,
    spotlightRadius: 14,
  },
  {
    target: 'suggestion-entry',
    fallbackTarget: 'dashboard-topbar',
    eyebrow: '体验反馈',
    title: '用「悄悄说」随时留下问题和建议',
    description: '使用中遇到问题、有功能建议或想补充细节，都可以从顶部入口快速反馈。',
    action: '导览到这里就完成了，之后可在设置菜单里随时重新打开。',
    accent: '#ec4899',
    spotlightPadding: 4,
    spotlightRadius: 14,
  },
]

const isOpen = ref(false)
const stepIndex = ref(0)
const dialogRef = ref<HTMLElement | null>(null)
const spotlight = ref<SpotlightRect>({
  top: 0,
  left: 0,
  width: 0,
  height: 0,
  radius: 20,
  visible: false,
})
const cardPosition = ref({
  top: VIEWPORT_PADDING,
  left: VIEWPORT_PADDING,
  anchor: 'center' as TourAnchor,
})

let positionFrame = 0
let previousFocus: HTMLElement | null = null
let positionResizeObserver: ResizeObserver | null = null
let stepSequence = 0
const delayedPositionTimers = new Set<number>()

const currentStep = computed(() => steps[stepIndex.value])
const isFirstStep = computed(() => stepIndex.value === 0)
const isLastStep = computed(() => stepIndex.value === steps.length - 1)
const progressPercent = computed(() => Math.round(((stepIndex.value + 1) / steps.length) * 100))
const progressWidth = computed(() => `${progressPercent.value}%`)
const cardAnchorClass = computed(() => `anchor-${cardPosition.value.anchor}`)

const spotlightStyle = computed(() => ({
  top: `${spotlight.value.top}px`,
  left: `${spotlight.value.left}px`,
  width: `${spotlight.value.width}px`,
  height: `${spotlight.value.height}px`,
  borderRadius: `${spotlight.value.radius}px`,
  '--tour-accent': currentStep.value.accent,
}))

const cardStyle = computed(() => ({
  top: `${cardPosition.value.top}px`,
  left: `${cardPosition.value.left}px`,
  '--tour-accent': currentStep.value.accent,
}))

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function isVisibleElement(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  const style = window.getComputedStyle(element)

  return (
    rect.width > 8 &&
    rect.height > 8 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    Number(style.opacity) !== 0
  )
}

function findTourTarget(target: string) {
  const element = document.querySelector<HTMLElement>(`[data-tour-target="${target}"]`)
  return element && isVisibleElement(element) ? element : null
}

function findStepTarget(step: TourStep) {
  const primary = findTourTarget(step.target)
  if (primary) return primary

  if (!step.fallbackTarget) return null

  return findTourTarget(step.fallbackTarget)
}

function prepareStep(step: TourStep) {
  if (step.viewMode) {
    emit('request-view-mode', step.viewMode)
  }

  if (step.closeDayPreview) {
    dispatchDashboardOnboardingTourCloseDayPreview()
  }

  if (step.closeNotificationPanel && findTourTarget('notification-panel')) {
    findTourTarget('notifications')?.click()
  }

  if (!step.openTarget || findTourTarget(step.target)) return

  findTourTarget(step.openTarget)?.click()
}

function getDialogSize() {
  const rect = dialogRef.value?.getBoundingClientRect()

  return {
    width: rect?.width || CARD_WIDTH,
    height: rect?.height || CARD_ESTIMATED_HEIGHT,
  }
}

function calculateCardPosition(targetRect: DOMRect | null, placement?: TourAnchor) {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const dialogSize = getDialogSize()
  const cardWidth = Math.min(dialogSize.width, viewportWidth - VIEWPORT_PADDING * 2)
  const cardHeight = Math.min(dialogSize.height, viewportHeight - VIEWPORT_PADDING * 2)

  if (!targetRect || placement === 'center') {
    return {
      top: Math.max(VIEWPORT_PADDING, (viewportHeight - cardHeight) / 2),
      left: Math.max(VIEWPORT_PADDING, (viewportWidth - cardWidth) / 2),
      anchor: 'center' as TourAnchor,
    }
  }

  const gap = 28
  const candidates = [
    {
      anchor: 'left' as TourAnchor,
      top: targetRect.top + (targetRect.height - cardHeight) / 2,
      left: targetRect.right + gap,
    },
    {
      anchor: 'right' as TourAnchor,
      top: targetRect.top + (targetRect.height - cardHeight) / 2,
      left: targetRect.left - cardWidth - gap,
    },
    {
      anchor: 'top' as TourAnchor,
      top: targetRect.bottom + gap,
      left: targetRect.left + (targetRect.width - cardWidth) / 2,
    },
    {
      anchor: 'bottom' as TourAnchor,
      top: targetRect.top - cardHeight - gap,
      left: targetRect.left + (targetRect.width - cardWidth) / 2,
    },
  ]

  if (placement) {
    candidates.sort((a, b) => Number(b.anchor === placement) - Number(a.anchor === placement))
  }

  const fitsViewport = (candidate: (typeof candidates)[number]) =>
    candidate.top >= VIEWPORT_PADDING &&
    candidate.left >= VIEWPORT_PADDING &&
    candidate.top + cardHeight <= viewportHeight - VIEWPORT_PADDING &&
    candidate.left + cardWidth <= viewportWidth - VIEWPORT_PADDING

  const visibleArea = (candidate: (typeof candidates)[number]) => {
    const visibleWidth = Math.max(
      0,
      Math.min(candidate.left + cardWidth, viewportWidth - VIEWPORT_PADDING) -
        Math.max(candidate.left, VIEWPORT_PADDING),
    )
    const visibleHeight = Math.max(
      0,
      Math.min(candidate.top + cardHeight, viewportHeight - VIEWPORT_PADDING) -
        Math.max(candidate.top, VIEWPORT_PADDING),
    )
    return visibleWidth * visibleHeight
  }

  const selected =
    candidates.find(fitsViewport) ??
    candidates.reduce((best, candidate) =>
      visibleArea(candidate) > visibleArea(best) ? candidate : best,
    )

  return {
    top: clamp(selected.top, VIEWPORT_PADDING, viewportHeight - cardHeight - VIEWPORT_PADDING),
    left: clamp(selected.left, VIEWPORT_PADDING, viewportWidth - cardWidth - VIEWPORT_PADDING),
    anchor: selected.anchor,
  }
}

function updatePosition() {
  if (!isOpen.value) return

  const target = findStepTarget(currentStep.value)
  const targetRect = target?.getBoundingClientRect() ?? null

  const targetIntersectsViewport = Boolean(
    targetRect &&
      targetRect.bottom > 8 &&
      targetRect.right > 8 &&
      targetRect.top < window.innerHeight - 8 &&
      targetRect.left < window.innerWidth - 8,
  )

  if (target && targetRect && targetIntersectsViewport) {
    const padding = currentStep.value.spotlightPadding ?? (targetRect.height < 44 ? 10 : 14)
    const top = Math.max(8, targetRect.top - padding)
    const left = Math.max(8, targetRect.left - padding)
    const right = Math.min(window.innerWidth - 8, targetRect.right + padding)
    const bottom = Math.min(window.innerHeight - 8, targetRect.bottom + padding)

    spotlight.value = {
      top,
      left,
      width: Math.max(32, right - left),
      height: Math.max(32, bottom - top),
      radius: currentStep.value.spotlightRadius ?? (targetRect.height < 48 ? 18 : 24),
      visible: true,
    }
  } else {
    spotlight.value = {
      top: 0,
      left: 0,
      width: 0,
      height: 0,
      radius: 20,
      visible: false,
    }
  }

  cardPosition.value = calculateCardPosition(targetRect, currentStep.value.placement)
}

function schedulePositionUpdate() {
  if (positionFrame) return

  positionFrame = window.requestAnimationFrame(() => {
    positionFrame = 0
    updatePosition()
  })
}

function scheduleDelayedPositionUpdate(delay: number) {
  const timer = window.setTimeout(() => {
    delayedPositionTimers.delete(timer)
    schedulePositionUpdate()
  }, delay)
  delayedPositionTimers.add(timer)
}

function clearDelayedPositionUpdates() {
  delayedPositionTimers.forEach((timer) => window.clearTimeout(timer))
  delayedPositionTimers.clear()
}

function observePositionElements(target: HTMLElement | null) {
  positionResizeObserver?.disconnect()
  if (!positionResizeObserver) return

  if (dialogRef.value) positionResizeObserver.observe(dialogRef.value)
  if (target && target !== dialogRef.value) positionResizeObserver.observe(target)
}

function syncCurrentStep() {
  const target = findStepTarget(currentStep.value)
  observePositionElements(target)

  if (target) {
    target.scrollIntoView({
      block: 'center',
      inline: 'center',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }

  schedulePositionUpdate()
  scheduleDelayedPositionUpdate(prefersReducedMotion() ? 0 : 260)
}

function focusDialog() {
  void nextTick(() => {
    const primaryAction = dialogRef.value?.querySelector<HTMLElement>('.tour-primary')
    if (primaryAction) {
      primaryAction.focus()
      return
    }

    dialogRef.value?.focus()
  })
}

function enterCurrentStep(shouldFocus = false) {
  const sequence = ++stepSequence
  clearDelayedPositionUpdates()

  void nextTick(async () => {
    prepareStep(currentStep.value)
    await nextTick()
    if (sequence !== stepSequence || !isOpen.value) return

    syncCurrentStep()
    if (shouldFocus) focusDialog()

    scheduleDelayedPositionUpdate(prefersReducedMotion() ? 0 : 120)
    scheduleDelayedPositionUpdate(prefersReducedMotion() ? 0 : 280)
    scheduleDelayedPositionUpdate(prefersReducedMotion() ? 0 : 480)
  })
}

function startTour() {
  if (!props.enabled) return

  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  emit('request-view-mode', 'simple')
  dispatchDashboardOnboardingTourCloseDayPreview()
  if (findTourTarget('notification-panel')) findTourTarget('notifications')?.click()
  stepIndex.value = 0
  isOpen.value = true
  enterCurrentStep(true)
}

function finishTour() {
  if (!isOpen.value) return

  stepSequence += 1
  clearDelayedPositionUpdates()
  positionResizeObserver?.disconnect()
  emit('request-view-mode', 'simple')
  dispatchDashboardOnboardingTourCloseDayPreview()
  if (findTourTarget('notification-panel')) findTourTarget('notifications')?.click()
  isOpen.value = false

  void nextTick(() => {
    if (previousFocus && document.contains(previousFocus)) previousFocus.focus()
    previousFocus = null
  })
}

function skipTour() {
  finishTour()
}

function nextStep() {
  if (isLastStep.value) {
    finishTour()
    return
  }

  stepIndex.value += 1
  enterCurrentStep()
}

function previousStep() {
  if (isFirstStep.value) return

  stepIndex.value -= 1
  enterCurrentStep()
}

function trapFocus(event: KeyboardEvent) {
  if (!dialogRef.value || event.key !== 'Tab') return

  const focusable = Array.from(
    dialogRef.value.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute('disabled') && isVisibleElement(element))

  if (!focusable.length) return

  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
    return
  }

  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (!isOpen.value) return

  if (event.key === 'Escape') {
    event.preventDefault()
    skipTour()
    return
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    nextStep()
    return
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    previousStep()
    return
  }

  trapFocus(event)
}

function handleStartTourEvent() {
  startTour()
}

watch(
  () => props.enabled,
  (enabled) => {
    if (!enabled) finishTour()
  },
)

watch(stepIndex, () => {
  if (!isOpen.value) return
  schedulePositionUpdate()
})

onMounted(() => {
  if ('ResizeObserver' in window) {
    positionResizeObserver = new ResizeObserver(schedulePositionUpdate)
  }

  window.addEventListener(DASHBOARD_ONBOARDING_TOUR_EVENT, handleStartTourEvent)
  window.addEventListener('resize', schedulePositionUpdate)
  window.addEventListener('scroll', schedulePositionUpdate, true)
  document.addEventListener('keydown', handleDocumentKeydown)
})

onBeforeUnmount(() => {
  stepSequence += 1
  clearDelayedPositionUpdates()
  positionResizeObserver?.disconnect()
  if (positionFrame) window.cancelAnimationFrame(positionFrame)
  window.removeEventListener(DASHBOARD_ONBOARDING_TOUR_EVENT, handleStartTourEvent)
  window.removeEventListener('resize', schedulePositionUpdate)
  window.removeEventListener('scroll', schedulePositionUpdate, true)
  document.removeEventListener('keydown', handleDocumentKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="tour-layer">
      <div v-if="isOpen" class="tour-layer" :class="{ 'has-spotlight': spotlight.visible }">
        <div v-if="spotlight.visible" class="tour-spotlight" :style="spotlightStyle" />

        <section
          ref="dialogRef"
          class="tour-card"
          :class="cardAnchorClass"
          :style="cardStyle"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dashboard-tour-title"
          aria-describedby="dashboard-tour-description"
          tabindex="-1"
        >
          <button
            type="button"
            class="tour-close"
            aria-label="关闭新手引导"
            title="关闭新手引导"
            @click="skipTour"
          >
            <IconX aria-hidden="true" />
          </button>

          <div class="tour-kicker">
            <span class="tour-step-pill">
              <IconSparkles aria-hidden="true" />
              {{ stepIndex + 1 }} / {{ steps.length }}
            </span>
            <span>{{ currentStep.eyebrow }}</span>
          </div>

          <Transition name="tour-copy" mode="out-in">
            <div :key="currentStep.target" class="tour-copy" aria-live="polite" aria-atomic="true">
              <h2 id="dashboard-tour-title">{{ currentStep.title }}</h2>
              <p id="dashboard-tour-description">{{ currentStep.description }}</p>

              <div class="tour-action-note">
                <span class="tour-action-icon" aria-hidden="true">
                  <IconRocket />
                </span>
                <span>{{ currentStep.action }}</span>
              </div>
            </div>
          </Transition>

          <div
            class="tour-progress"
            role="progressbar"
            :aria-valuenow="stepIndex + 1"
            aria-valuemin="1"
            :aria-valuemax="steps.length"
            :aria-valuetext="`第 ${stepIndex + 1} 步，共 ${steps.length} 步`"
            aria-label="新手引导进度"
          >
            <span :style="{ width: progressWidth }" />
          </div>

          <footer class="tour-footer">
            <button type="button" class="tour-skip" @click="skipTour">跳过</button>

            <div class="tour-nav">
              <button
                type="button"
                class="tour-icon-button"
                :disabled="isFirstStep"
                aria-label="上一步"
                title="上一步"
                @click="previousStep"
              >
                <IconArrowLeft aria-hidden="true" />
              </button>

              <button type="button" class="tour-primary" @click="nextStep">
                <span>{{ isLastStep ? '开始使用' : '下一步' }}</span>
                <IconCheck v-if="isLastStep" aria-hidden="true" />
                <IconArrowRight v-else aria-hidden="true" />
              </button>
            </div>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.tour-layer {
  position: fixed;
  inset: 0;
  z-index: 140;
  background: rgba(8, 17, 31, 0.58);
  color: #0f172a;
  pointer-events: auto;
  transition: background 180ms ease;
}

.tour-layer.has-spotlight {
  background: transparent;
}

.tour-spotlight {
  position: fixed;
  box-sizing: border-box;
  border: 2px solid var(--tour-accent);
  overflow: hidden;
  pointer-events: none;
  box-shadow:
    0 0 0 9999px rgba(8, 17, 31, 0.58),
    0 22px 52px -24px color-mix(in srgb, var(--tour-accent) 70%, transparent),
    inset 0 0 0 1px rgba(255, 255, 255, 0.72);
  animation: tour-frame-pulse 1.8s ease-in-out infinite;
  transition:
    top 260ms cubic-bezier(0.2, 0.8, 0.2, 1),
    left 260ms cubic-bezier(0.2, 0.8, 0.2, 1),
    width 260ms cubic-bezier(0.2, 0.8, 0.2, 1),
    height 260ms cubic-bezier(0.2, 0.8, 0.2, 1),
    border-radius 260ms ease;
}

.tour-card {
  position: fixed;
  width: min(380px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  box-sizing: border-box;
  border: 1px solid rgba(226, 232, 240, 0.86);
  border-top: 3px solid var(--tour-accent);
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.94)), #ffffff;
  padding: 20px;
  outline: none;
  box-shadow:
    0 30px 70px -32px rgba(3, 7, 18, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition:
    top 260ms cubic-bezier(0.2, 0.8, 0.2, 1),
    left 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.tour-card::before {
  position: absolute;
  width: 14px;
  height: 14px;
  border: inherit;
  border-right: 0;
  border-bottom: 0;
  background: #ffffff;
  content: '';
}

.tour-card.anchor-left::before {
  top: 50%;
  left: -8px;
  transform: translateY(-50%) rotate(-45deg);
}

.tour-card.anchor-right::before {
  top: 50%;
  right: -8px;
  transform: translateY(-50%) rotate(135deg);
}

.tour-card.anchor-top::before {
  top: -8px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
}

.tour-card.anchor-bottom::before {
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%) rotate(225deg);
}

.tour-card.anchor-center::before {
  display: none;
}

.tour-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 999px;
  background: rgba(241, 245, 249, 0.86);
  color: #64748b;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background 180ms ease,
    color 180ms ease,
    transform 180ms ease;
}

.tour-close:hover,
.tour-close:focus-visible {
  background: #e2e8f0;
  color: #0f172a;
  transform: translateY(-1px);
}

.tour-close:focus-visible,
.tour-skip:focus-visible,
.tour-icon-button:focus-visible:not(:disabled),
.tour-primary:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--tour-accent) 42%, #ffffff);
  outline-offset: 2px;
}

.tour-close svg {
  width: 17px;
  height: 17px;
}

.tour-kicker {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-right: 42px;
  color: #64748b;
  font-size: 12px;
  line-height: 1;
  font-weight: 850;
}

.tour-step-pill {
  min-height: 30px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--tour-accent) 14%, #ffffff);
  color: color-mix(in srgb, var(--tour-accent) 78%, #0f172a);
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tour-step-pill svg {
  width: 14px;
  height: 14px;
}

.tour-copy {
  padding-top: 18px;
}

.tour-copy h2 {
  margin: 0;
  color: #0f172a;
  font-size: 24px;
  line-height: 1.18;
  font-weight: 950;
}

.tour-copy p {
  margin: 12px 0 0;
  color: #475569;
  font-size: 14px;
  line-height: 1.7;
  font-weight: 700;
}

.tour-action-note {
  margin-top: 16px;
  border: 1px solid color-mix(in srgb, var(--tour-accent) 18%, #e2e8f0);
  border-radius: 16px;
  background: color-mix(in srgb, var(--tour-accent) 8%, #ffffff);
  padding: 12px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: flex-start;
  gap: 10px;
  color: #1e293b;
  font-size: 13px;
  line-height: 1.55;
  font-weight: 800;
}

.tour-action-icon {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  background: var(--tour-accent);
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 18px -12px color-mix(in srgb, var(--tour-accent) 72%, transparent);
}

.tour-action-icon svg {
  width: 16px;
  height: 16px;
}

.tour-progress {
  position: relative;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #e2e8f0;
  margin-top: 18px;
}

.tour-progress span {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--tour-accent) 78%, #ffffff),
    var(--tour-accent)
  );
  transition: width 260ms ease;
}

.tour-progress span::after {
  position: absolute;
  top: 50%;
  right: 2px;
  width: 12px;
  height: 12px;
  border: 2px solid #ffffff;
  border-radius: 999px;
  background: var(--tour-accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--tour-accent) 18%, transparent);
  transform: translateY(-50%);
  content: '';
}

.tour-footer {
  margin-top: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.tour-nav {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.tour-skip,
.tour-icon-button,
.tour-primary {
  min-height: 44px;
  border: 0;
  font: inherit;
  cursor: pointer;
}

.tour-skip {
  border-radius: 999px;
  background: transparent;
  color: #64748b;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 850;
}

.tour-skip:hover,
.tour-skip:focus-visible {
  background: #f1f5f9;
  color: #0f172a;
}

.tour-icon-button {
  width: 44px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #334155;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tour-icon-button:hover:not(:disabled),
.tour-icon-button:focus-visible:not(:disabled) {
  background: #e2e8f0;
}

.tour-icon-button:disabled {
  color: #cbd5e1;
  cursor: not-allowed;
}

.tour-icon-button svg,
.tour-primary svg {
  width: 17px;
  height: 17px;
}

.tour-primary {
  border-radius: 999px;
  background: var(--tour-accent);
  color: #ffffff;
  padding: 0 16px 0 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 900;
  box-shadow: 0 14px 26px -16px color-mix(in srgb, var(--tour-accent) 86%, #0f172a);
  transition:
    transform 180ms ease,
    box-shadow 180ms ease;
}

.tour-primary:hover,
.tour-primary:focus-visible {
  transform: translateY(-1px);
  box-shadow: 0 18px 30px -16px color-mix(in srgb, var(--tour-accent) 92%, #0f172a);
}

.tour-layer-enter-active,
.tour-layer-leave-active {
  transition: opacity 220ms ease;
}

.tour-layer-enter-from,
.tour-layer-leave-to {
  opacity: 0;
}

.tour-copy-enter-active,
.tour-copy-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.tour-copy-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.tour-copy-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@keyframes tour-frame-pulse {
  0%,
  100% {
    box-shadow:
      0 0 0 9999px rgba(8, 17, 31, 0.58),
      0 18px 42px -26px color-mix(in srgb, var(--tour-accent) 60%, transparent),
      inset 0 0 0 1px rgba(255, 255, 255, 0.72);
  }

  50% {
    box-shadow:
      0 0 0 9999px rgba(8, 17, 31, 0.6),
      0 24px 56px -22px color-mix(in srgb, var(--tour-accent) 90%, transparent),
      inset 0 0 0 1px rgba(255, 255, 255, 0.92);
  }
}

@media (max-width: 640px) {
  .tour-card {
    padding: 18px;
    border-radius: 20px;
  }

  .tour-copy h2 {
    font-size: 21px;
  }

  .tour-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .tour-nav {
    width: 100%;
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
  }

  .tour-primary {
    width: 100%;
  }
}

@media (max-height: 520px) {
  .tour-card {
    overflow-y: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tour-spotlight,
  .tour-card,
  .tour-progress span,
  .tour-layer-enter-active,
  .tour-layer-leave-active,
  .tour-copy-enter-active,
  .tour-copy-leave-active,
  .tour-close,
  .tour-primary {
    transition: none;
  }

  .tour-spotlight {
    animation: none;
  }
}
</style>
