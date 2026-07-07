<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { Component } from 'vue'
import { useRouter } from 'vue-router'
import IconBuilding2 from '~icons/lucide/building-2'
import IconCheck from '~icons/lucide/check'
import IconMail from '~icons/lucide/mail'
import { Button } from '@/components/ui/button'
import bgMorning from '@/assets/morning.png'
import bgNoon from '@/assets/noon.png'
import bgAfternoon from '@/assets/afternoon.png'
import bgNight from '@/assets/night.png'
import { useFeedbackStore } from '@/stores/feedback.store'
import { useDashboardTodosStore } from '@/stores/dashboard-todos.store'
import { useUserStore } from '@/stores/user.store'
import CalendarWorkspace from './dashboard/CalendarWorkspace.vue'
import DashboardTopBar from './dashboard/DashboardTopBar.vue'
import DetailedDashboardWorkspace from './dashboard/DetailedDashboardWorkspace.vue'
import OnboardingTour from './dashboard/components/OnboardingTour.vue'
import { navigateDashboardTool, type DashboardToolTarget } from './dashboard/dashboardTools'
import { getHomeTimePeriod } from './dashboard/homeTimeOfDay'
import { useHomeClock } from './dashboard/useHomeClock'
import { ymd } from './dashboard/todoDisplay'
import { dispatchDashboardOnboardingTourStart } from './dashboard/onboardingTour'
import {
  selectEmailProvider as submitEmailProvider,
  type SmartTodoEmailProvider,
} from './dashboard/todo.service'

type CalendarWorkspaceExpose = {
  refreshTodos: () => Promise<void>
  openTodoFromNotification: (payload: { id: string; date?: string }) => Promise<void>
}

type DetailedDashboardWorkspaceExpose = {
  refreshTodos: () => Promise<void>
  openTodoFromNotification: (payload: { id: string; date?: string }) => Promise<void>
}

type HomeViewMode = 'simple' | 'detail'

type EmailProviderOption = {
  value: SmartTodoEmailProvider
  title: string
  label: string
  description: string
  icon: Component
  step: string
  accent: string
  soft: string
  ink: string
}

const emailProviderOptions: EmailProviderOption[] = [
  {
    value: 'outlook',
    title: 'Outlook 邮箱',
    label: '协作日程',
    description: '适合 Exchange、Teams 与 Outlook 日历同步',
    icon: IconMail,
    step: '01',
    accent: '#2563eb',
    soft: '#dbeafe',
    ink: '#1e3a8a',
  },
  {
    value: 'coremail',
    title: 'Coremail 邮箱',
    label: '企业邮箱',
    description: '适合 Coremail 企业邮箱与内部会议通知',
    icon: IconBuilding2,
    step: '02',
    accent: '#0f766e',
    soft: '#ccfbf1',
    ink: '#134e4a',
  },
]

const calendarWorkspaceRef = ref<CalendarWorkspaceExpose | null>(null)
const detailedDashboardWorkspaceRef = ref<DetailedDashboardWorkspaceExpose | null>(null)
const homeViewMode = ref<HomeViewMode>('simple')
const sharedSelectedDate = ref(ymd(new Date()))
const selectedEmailProvider = ref<SmartTodoEmailProvider | ''>('')
const isEmailProviderSaving = ref(false)
const userStore = useUserStore()
const feedbackStore = useFeedbackStore()
const dashboardTodosStore = useDashboardTodosStore()
const router = useRouter()
const { now } = useHomeClock()

const bgImages = {
  morning: bgMorning,
  noon: bgNoon,
  afternoon: bgAfternoon,
  night: bgNight,
} as const

const currentBgImage = computed(() => bgImages[getHomeTimePeriod(now.value)])

const shouldShowEmailProviderGate = computed(() => {
  const checkEmail = userStore.profile?.checkEmail
  return userStore.isLoggedIn && Boolean(userStore.profile) && !String(checkEmail ?? '').trim()
})

function handleCalendarRefresh() {
  void dashboardTodosStore.reloadCurrentRange()
}

async function handleOpenTodo(payload: { id: string; date?: string }) {
  if (homeViewMode.value === 'detail') {
    await detailedDashboardWorkspaceRef.value?.openTodoFromNotification(payload)
    return
  }

  await calendarWorkspaceRef.value?.openTodoFromNotification(payload)
}

async function startOnboardingTour() {
  if (homeViewMode.value !== 'simple') {
    homeViewMode.value = 'simple'
    await nextTick()
  }

  dispatchDashboardOnboardingTourStart()
}

function setHomeViewMode(mode: HomeViewMode) {
  homeViewMode.value = mode
}

function handleTopbarToolSelect(tool: DashboardToolTarget) {
  void navigateDashboardTool(router, tool)
}

function selectEmailProvider(provider: SmartTodoEmailProvider) {
  if (isEmailProviderSaving.value) return
  selectedEmailProvider.value = provider
}

async function confirmEmailProvider() {
  if (!selectedEmailProvider.value || isEmailProviderSaving.value) return

  isEmailProviderSaving.value = true

  try {
    await submitEmailProvider(selectedEmailProvider.value)
    userStore.setCheckEmail(selectedEmailProvider.value)
    feedbackStore.success('邮箱类型已确认')
  } catch (error) {
    feedbackStore.error(error instanceof Error ? error.message : '邮箱类型确认失败')
  } finally {
    isEmailProviderSaving.value = false
  }
}
</script>

<template>
  <div class="page-container">
    <div class="home-bg" aria-hidden="true">
      <img :src="currentBgImage" alt="" />
    </div>

    <main class="dashboard-shell">
      <DashboardTopBar
        v-if="homeViewMode === 'detail'"
        show-tool-dock
        view-mode="detail"
        @calendar-refresh="handleCalendarRefresh"
        @open-todo="handleOpenTodo"
        @start-onboarding="startOnboardingTour"
        @select-tool="handleTopbarToolSelect"
        @switch-mode="setHomeViewMode"
      />
      <div class="dashboard-content">
        <KeepAlive>
          <CalendarWorkspace
            v-if="homeViewMode === 'simple'"
            ref="calendarWorkspaceRef"
            v-model:selected-date="sharedSelectedDate"
            @switch-mode="setHomeViewMode"
            @start-onboarding="startOnboardingTour"
          />
          <DetailedDashboardWorkspace
            v-else
            ref="detailedDashboardWorkspaceRef"
            v-model:selected-date="sharedSelectedDate"
            @switch-mode="setHomeViewMode"
          />
        </KeepAlive>
      </div>
    </main>

    <OnboardingTour :enabled="userStore.isLoggedIn && !shouldShowEmailProviderGate" />

    <Transition name="email-provider-gate">
      <div
        v-if="shouldShowEmailProviderGate"
        class="email-provider-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-provider-title"
      >
        <section class="email-provider-card">
          <header class="email-provider-header">
            <div class="email-provider-header-top">
              <span class="email-provider-icon" aria-hidden="true">
                <IconMail />
              </span>
              <span class="email-provider-chip">首次确认</span>
            </div>
            <p class="email-provider-kicker">Mail Sync Setup</p>
            <h2 id="email-provider-title">选择你的邮箱入口</h2>
            <p class="email-provider-desc">选好之后，工作台会按对应邮箱系统同步日程与待办提醒。</p>
          </header>

          <div class="email-provider-options" role="radiogroup" aria-label="邮箱类型">
            <button
              v-for="option in emailProviderOptions"
              :key="option.value"
              type="button"
              class="email-provider-option"
              :class="{ 'is-selected': selectedEmailProvider === option.value }"
              :disabled="isEmailProviderSaving"
              :style="{
                '--provider-accent': option.accent,
                '--provider-soft': option.soft,
                '--provider-ink': option.ink,
              }"
              role="radio"
              :aria-checked="selectedEmailProvider === option.value"
              @click="selectEmailProvider(option.value)"
            >
              <span class="option-icon" aria-hidden="true">
                <component :is="option.icon" />
              </span>
              <span class="option-copy">
                <span class="option-title-row">
                  <strong>{{ option.title }}</strong>
                  <em>{{ option.label }}</em>
                </span>
                <span>{{ option.description }}</span>
              </span>
              <span class="option-check" aria-hidden="true">
                <IconCheck />
              </span>
            </button>
          </div>

          <Button
            type="button"
            class="email-confirm-button"
            :disabled="!selectedEmailProvider || isEmailProviderSaving"
            @click="confirmEmailProvider"
          >
            {{ isEmailProviderSaving ? '确认中...' : '确认选择' }}
          </Button>
        </section>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.page-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #e6edf5;
  color: #111827;
  font-family:
    'Inter',
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    sans-serif;
}

.home-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.home-bg::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(245, 250, 255, 0.08), rgba(226, 237, 248, 0.08));
  content: '';
}

.home-bg img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center bottom;
}

.dashboard-shell {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: transparent;
}

.dashboard-content {
  position: relative;
  min-height: 0;
  flex: 1;
}

.email-provider-overlay {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.3);
  backdrop-filter: blur(12px);
}

.email-provider-card {
  position: relative;
  overflow: hidden;
  width: min(100%, 520px);
  border-radius: 32px;
  background: #ffffff;
  box-shadow:
    0 24px 48px -12px rgba(15, 23, 42, 0.15),
    0 0 0 1px rgba(15, 23, 42, 0.04) inset;
  padding: 40px;
  color: #0f172a;
}

.email-provider-card::before {
  content: '';
  position: absolute;
  top: -120px;
  right: -120px;
  width: 360px;
  height: 360px;
  background: radial-gradient(circle, rgba(224, 242, 254, 0.8) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}

.email-provider-card::after {
  content: '';
  position: absolute;
  bottom: -120px;
  left: -120px;
  width: 360px;
  height: 360px;
  background: radial-gradient(circle, rgba(204, 251, 241, 0.6) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}

.email-provider-header {
  position: relative;
  z-index: 1;
  margin-bottom: 36px;
}

.email-provider-header-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
}

.email-provider-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: linear-gradient(135deg, #e0f2fe, #ccfbf1);
  color: #0369a1;
  box-shadow:
    0 8px 16px -6px rgba(14, 116, 144, 0.15),
    0 0 0 1px rgba(255, 255, 255, 0.5) inset;
}

.email-provider-icon svg {
  width: 28px;
  height: 28px;
}

.email-provider-chip {
  padding: 6px 12px;
  border-radius: 999px;
  background: #e0f2fe;
  color: #0369a1;
  font-size: 13px;
  font-weight: 600;
}

.email-provider-kicker {
  margin: 0 0 8px;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.email-provider-header h2 {
  margin: 0 0 12px;
  font-size: 28px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.email-provider-desc {
  margin: 0;
  color: #64748b;
  font-size: 15px;
  line-height: 1.6;
}

.email-provider-options {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 36px;
}

.email-provider-option {
  --provider-accent: #2563eb;
  --provider-soft: #dbeafe;
  --provider-ink: #1e3a8a;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  background: #ffffff;
  color: #0f172a;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(15, 23, 42, 0.02);
  -webkit-tap-highlight-color: transparent;
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
}

.email-provider-option:hover {
  background: #ffffff;
  border-color: #cbd5e1;
  transform: translateY(-2px);
  box-shadow: 0 8px 16px -4px rgba(15, 23, 42, 0.05);
}

.email-provider-option.is-selected {
  background: color-mix(in srgb, var(--provider-soft) 30%, #ffffff);
  border-color: var(--provider-accent);
  box-shadow: 0 12px 24px -8px color-mix(in srgb, var(--provider-accent) 30%, transparent);
}

.option-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: var(--provider-soft);
  color: var(--provider-accent);
  box-shadow: 0 2px 8px -2px rgba(15, 23, 42, 0.05);
  transition: all 250ms ease;
}

.email-provider-option.is-selected .option-icon {
  background: var(--provider-accent);
  color: #ffffff;
  box-shadow: 0 8px 16px -4px color-mix(in srgb, var(--provider-accent) 40%, transparent);
}

.option-icon svg {
  width: 24px;
  height: 24px;
}

.option-copy {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.option-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.option-title-row strong {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  transition: color 250ms ease;
}

.email-provider-option.is-selected .option-title-row strong {
  color: var(--provider-accent);
}

.option-title-row em {
  padding: 4px 8px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--provider-soft) 50%, #f1f5f9);
  color: var(--provider-ink);
  font-size: 12px;
  font-style: normal;
  font-weight: 600;
  transition: all 250ms ease;
}

.email-provider-option.is-selected .option-title-row em {
  background: var(--provider-soft);
  color: var(--provider-ink);
}

.option-copy > span:last-child {
  color: #64748b;
  font-size: 14px;
  line-height: 1.5;
}

.option-check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--provider-accent);
  color: #ffffff;
  opacity: 0;
  transform: scale(0.5);
  transition: all 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.email-provider-option.is-selected .option-check {
  opacity: 1;
  transform: scale(1);
}

.option-check svg {
  width: 14px;
  height: 14px;
}

.email-confirm-button {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 52px;
  border-radius: 16px;
  background: #0f172a;
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
  border: none;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color 250ms ease,
    transform 250ms ease,
    box-shadow 250ms ease;
}

.email-confirm-button:hover:not(:disabled) {
  background: #1e293b;
  transform: translateY(-2px);
  box-shadow: 0 12px 24px -8px rgba(15, 23, 42, 0.4);
}

.email-confirm-button:active:not(:disabled) {
  background: #0f172a;
  transform: translateY(0);
  box-shadow: 0 4px 12px -4px rgba(15, 23, 42, 0.3);
  transition: all 100ms ease;
}

.email-confirm-button:disabled {
  background: #f1f5f9;
  color: #94a3b8;
  box-shadow: none;
  cursor: not-allowed;
}

.email-provider-gate-enter-active,
.email-provider-gate-leave-active {
  transition: opacity 240ms ease;
}

.email-provider-gate-enter-from,
.email-provider-gate-leave-to {
  opacity: 0;
}

.email-provider-gate-enter-active .email-provider-card,
.email-provider-gate-leave-active .email-provider-card {
  transition:
    opacity 240ms ease,
    transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.email-provider-gate-enter-from .email-provider-card,
.email-provider-gate-leave-to .email-provider-card {
  opacity: 0;
  transform: translateY(16px) scale(0.96);
}

@media (max-width: 640px) {
  .email-provider-overlay {
    padding: 16px;
  }

  .email-provider-card {
    padding: 32px 24px;
    border-radius: 28px;
  }

  .email-provider-header-top {
    margin-bottom: 20px;
  }

  .email-provider-header h2 {
    font-size: 24px;
  }

  .email-provider-icon {
    width: 48px;
    height: 48px;
    border-radius: 16px;
  }

  .email-provider-icon svg {
    width: 24px;
    height: 24px;
  }

  .email-provider-option {
    padding: 14px;
    gap: 12px;
  }

  .option-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
  }

  .option-icon svg {
    width: 20px;
    height: 20px;
  }
}
</style>
