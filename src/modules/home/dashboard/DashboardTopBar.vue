<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import IconArrowLeft from '~icons/lucide/arrow-left'
import IconChevronDown from '~icons/lucide/chevron-down'
import IconFileText from '~icons/lucide/file-text'
import IconLayoutDashboard from '~icons/lucide/layout-dashboard'
import IconLogOut from '~icons/lucide/log-out'
import IconMailbox from '~icons/lucide/mailbox'
import IconRefreshCw from '~icons/lucide/refresh-cw'
import IconSettings from '~icons/lucide/settings'
import IconSparkles from '~icons/lucide/sparkles'
import DashboardNotificationCenter from '@/modules/home/dashboard/components/DashboardNotificationCenter.vue'
import DashboardSuggestionBox from '@/modules/home/dashboard/components/DashboardSuggestionBox.vue'
import EmployeeWorkReportDialog from '@/modules/home/dashboard/components/EmployeeWorkReportDialog.vue'
import EmployeeWorkReportStoryDialog from '@/modules/home/dashboard/components/EmployeeWorkReportStoryDialog.vue'
import DashboardViewModeSwitch, {
  type DashboardViewMode,
} from '@/modules/home/dashboard/components/DashboardViewModeSwitch.vue'
import TopbarToolDock from '@/modules/home/dashboard/components/TopbarToolDock.vue'
import homeCardLogoImage from '@/assets/logo.png'
import { routeConfig } from '@/config/route.config'
import type { DashboardToolTarget } from '@/modules/home/dashboard/config/dashboardTools'
import type { TodoOpenSource } from '@/modules/home/dashboard/config/types'
import { logoutSmartTodo, syncCalendar } from '@/modules/home/dashboard/services/todo.service'
import { useDashboardGlassSettings } from '@/modules/home/dashboard/composables/useDashboardGlassSettings'
import { useDashboardTodosStore } from '@/stores/dashboard-todos.store'
import { useFeedbackStore } from '@/stores/feedback.store'
import { DEFAULT_USER_AVATAR, useUserStore } from '@/stores/user.store'

const emit = defineEmits<{
  'calendar-refresh': []
  'open-todo': [payload: { id: string; date?: string; source?: TodoOpenSource }]
  'open-email-provider': []
  'start-onboarding': []
  'switch-mode': [mode: 'simple' | 'detail']
  'select-tool': [payload: DashboardToolTarget]
}>()

const props = withDefaults(
  defineProps<{
    embedded?: boolean
    hideNotifications?: boolean
    showToolDock?: boolean
    portalTarget?: HTMLElement | null
    viewMode?: DashboardViewMode | null
    pageTitle?: string | null
    backLabel?: string
  }>(),
  {
    embedded: false,
    hideNotifications: false,
    showToolDock: false,
    portalTarget: null,
    viewMode: null,
    pageTitle: null,
    backLabel: '首页',
  },
)

const router = useRouter()
const userStore = useUserStore()
const feedbackStore = useFeedbackStore()

const userMenuPanelRef = ref<HTMLElement | null>(null)
const settingsMenuWrapRef = ref<HTMLElement | null>(null)
const settingsMenuPanelRef = ref<HTMLElement | null>(null)
const settingsMenuPosition = ref({ top: 0, right: 16 })
const { glassStyle } = useDashboardGlassSettings()
const isSettingsMenuOpen = ref(false)
const isSyncingCalendar = ref(false)
const isNotificationPanelOpen = ref(false)
const isSuggestionBoxOpen = ref(false)
const workReportMenuWrapRef = ref<HTMLElement | null>(null)
const workReportMenuPanelRef = ref<HTMLElement | null>(null)
const isWorkReportMenuOpen = ref(false)
const isWorkReportClassicOpen = ref(false)
const isWorkReportStoryOpen = ref(false)
const suggestionBoxRef = ref<InstanceType<typeof DashboardSuggestionBox> | null>(null)
const isUserMenuOpen = ref(false)
const isLoggingOut = ref(false)

const displayName = computed(() => userStore.profile?.name ?? '刘美华')
const department = computed(() => userStore.profile?.department ?? '信息技术部')
const avatarUrl = computed(() => userStore.profile?.avatar ?? DEFAULT_USER_AVATAR)
const isAdminUser = computed(() => userStore.isAdmin)

const hasContextualNav = computed(() => Boolean(props.pageTitle?.trim()) && !props.embedded)

const settingsMenuPanelStyle = computed(() => {
  if (!props.embedded) return undefined

  const position = settingsMenuPosition.value
  return {
    top: `${position.top}px`,
    right: `${position.right}px`,
  }
})

function closeNotificationPanel() {
  isNotificationPanelOpen.value = false
}

function openSuggestionBox() {
  closeNotificationPanel()
  closeUserMenu()
  closeSettingsMenu()
  closeWorkReportMenu()
  isWorkReportClassicOpen.value = false
  isWorkReportStoryOpen.value = false

  if (isSuggestionBoxOpen.value) {
    suggestionBoxRef.value?.expand()
    return
  }

  isSuggestionBoxOpen.value = true
}

function closeWorkReportMenu() {
  isWorkReportMenuOpen.value = false
}

function toggleWorkReportMenu() {
  closeNotificationPanel()
  closeUserMenu()
  closeSettingsMenu()
  isSuggestionBoxOpen.value = false
  isWorkReportMenuOpen.value = !isWorkReportMenuOpen.value
}

function openWorkReportClassic() {
  closeNotificationPanel()
  closeUserMenu()
  closeSettingsMenu()
  isSuggestionBoxOpen.value = false
  closeWorkReportMenu()
  isWorkReportStoryOpen.value = false
  isWorkReportClassicOpen.value = true
}

function openWorkReportStory() {
  closeNotificationPanel()
  closeUserMenu()
  closeSettingsMenu()
  isSuggestionBoxOpen.value = false
  closeWorkReportMenu()
  isWorkReportClassicOpen.value = false
  isWorkReportStoryOpen.value = true
}

function closeUserMenu() {
  isUserMenuOpen.value = false
}

function closeSettingsMenu() {
  isSettingsMenuOpen.value = false
}

function goHome() {
  void router.push({ name: 'Home' }).catch(() => router.push('/'))
}

watch(isNotificationPanelOpen, (open) => {
  if (!open) return
  closeUserMenu()
  closeSettingsMenu()
})

function toggleUserMenu() {
  if (!isUserMenuOpen.value) {
    closeNotificationPanel()
    closeSettingsMenu()
  }

  isUserMenuOpen.value = !isUserMenuOpen.value
}

function updateSettingsMenuPosition() {
  const trigger = settingsMenuWrapRef.value
  if (!trigger) return

  const rect = trigger.getBoundingClientRect()
  settingsMenuPosition.value = {
    top: rect.bottom + 12,
    right: Math.max(16, window.innerWidth - rect.right),
  }
}

function toggleSettingsMenu() {
  if (!isSettingsMenuOpen.value) {
    closeNotificationPanel()
    closeUserMenu()
    if (props.embedded) updateSettingsMenuPosition()
  }
  isSettingsMenuOpen.value = !isSettingsMenuOpen.value
}

async function syncCalendarFromEmail() {
  if (isSyncingCalendar.value) return

  const checkEmail = userStore.profile?.checkEmail
  if (!String(checkEmail ?? '').trim()) {
    closeSettingsMenu()
    emit('open-email-provider')
    return
  }

  isSyncingCalendar.value = true

  try {
    await syncCalendar()
    emit('calendar-refresh')
    feedbackStore.success('邮箱日程同步成功')
    closeSettingsMenu()
  } catch {
    feedbackStore.error('同步邮箱日程失败')
  } finally {
    isSyncingCalendar.value = false
  }
}

function openOnboardingTour() {
  closeNotificationPanel()
  closeUserMenu()
  closeSettingsMenu()
  emit('start-onboarding')
}

function openLeaderBoard() {
  closeNotificationPanel()
  closeUserMenu()
  closeSettingsMenu()
  void router.push({ name: 'LeaderBoard' }).catch(() => router.push('/leader-board'))
}

function openSuggestionInbox() {
  closeNotificationPanel()
  closeUserMenu()
  closeSettingsMenu()
  void router.push({ name: 'SuggestionInbox' }).catch(() => router.push('/suggestion-inbox'))
}

async function handleLogout() {
  if (isLoggingOut.value) {
    return
  }

  isLoggingOut.value = true
  closeUserMenu()
  closeSettingsMenu()

  try {
    await logoutSmartTodo()
  } catch {
    // 即使接口失败也清除本地登录态
  } finally {
    useDashboardTodosStore().reset()
    userStore.logout()
    isLoggingOut.value = false
    void router.replace({ path: routeConfig.loginRoute })
  }
}

function handleDocumentPointerDown(event: PointerEvent) {
  const target = event.target as Node

  if (isUserMenuOpen.value) {
    const insideUserMenu = userMenuPanelRef.value?.contains(target)
    if (!insideUserMenu) {
      closeUserMenu()
    }
  }
}

function handleDocumentClick(event: MouseEvent) {
  const target = event.target as Node
  const settingsMenuElement = settingsMenuPanelRef.value

  const insideSettingsMenu =
    settingsMenuWrapRef.value?.contains(target) || settingsMenuElement?.contains(target)

  if (isSettingsMenuOpen.value && !insideSettingsMenu) {
    closeSettingsMenu()
  }

  const workReportMenuElement = workReportMenuPanelRef.value
  const insideWorkReportMenu =
    workReportMenuWrapRef.value?.contains(target) || workReportMenuElement?.contains(target)

  if (isWorkReportMenuOpen.value && !insideWorkReportMenu) {
    closeWorkReportMenu()
  }
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeNotificationPanel()
    closeUserMenu()
    closeSettingsMenu()
    closeWorkReportMenu()
    isWorkReportClassicOpen.value = false
    isWorkReportStoryOpen.value = false
  }
}

let topbarDocumentListenersBound = false

function bindTopbarDocumentListeners() {
  if (topbarDocumentListenersBound) return

  topbarDocumentListenersBound = true
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleDocumentKeydown)
}

function unbindTopbarDocumentListeners() {
  if (!topbarDocumentListenersBound) return

  topbarDocumentListenersBound = false
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleDocumentKeydown)
}

onMounted(() => {
  bindTopbarDocumentListeners()
})

onActivated(() => {
  bindTopbarDocumentListeners()
})

onDeactivated(() => {
  unbindTopbarDocumentListeners()
})

onBeforeUnmount(() => {
  unbindTopbarDocumentListeners()
})
</script>

<template>
  <header
    class="dashboard-topbar"
    :class="{
      'is-embedded': props.embedded,
      'has-tool-dock': props.showToolDock && !props.embedded,
      'has-contextual-nav': hasContextualNav,
      'notification-open': props.embedded && isNotificationPanelOpen,
    }"
    :style="props.embedded ? undefined : glassStyle"
    aria-label="顶部导航"
    data-tour-target="dashboard-topbar"
  >
    <div
      v-if="hasContextualNav"
      class="brand-block brand-block--contextual"
      aria-label="AI辅助办公"
    >
      <button type="button" class="contextual-back-btn" @click="goHome">
        <IconArrowLeft aria-hidden="true" />
        <span>{{ props.backLabel }}</span>
      </button>
      <span class="contextual-divider" aria-hidden="true" />
      <img class="brand-logo" :src="homeCardLogoImage" alt="" />
      <span class="brand-title">AI辅助办公</span>
    </div>
    <div v-else class="brand-block" :class="{ 'is-embedded': props.embedded }" aria-label="AI辅助办公">
      <img class="brand-logo" :src="homeCardLogoImage" alt="" />
      <span class="brand-title">AI辅助办公</span>
    </div>

    <TopbarToolDock
      v-if="props.showToolDock && !props.embedded"
      class="topbar-tool-dock"
      @select="(payload) => emit('select-tool', payload)"
    />

    <div class="topbar-actions" :class="{ 'is-embedded-actions': props.embedded }">
      <DashboardViewModeSwitch
        v-if="props.viewMode"
        :model-value="props.viewMode"
        @update:model-value="(mode) => emit('switch-mode', mode)"
      />
      <DashboardNotificationCenter
        v-if="!props.hideNotifications"
        v-model:open="isNotificationPanelOpen"
        :use-portal="props.embedded"
        :portal-target="props.portalTarget"
        @calendar-refresh="emit('calendar-refresh')"
        @open-todo="(payload) => emit('open-todo', payload)"
      />
      <button
        class="suggestion-entry-btn"
        type="button"
        aria-label="打开体验建议箱"
        title="悄悄说 — 体验建议箱"
        @click="openSuggestionBox"
      >
        <span class="suggestion-entry-btn__icon" aria-hidden="true">
          <IconMailbox />
        </span>
        <span class="suggestion-entry-btn__label">悄悄说</span>
        <span class="suggestion-entry-btn__dot" aria-hidden="true" />
      </button>
      <div ref="workReportMenuWrapRef" class="work-report-menu-wrap">
        <button
          class="work-report-entry-btn"
          type="button"
          aria-label="打开工作总结"
          aria-controls="dashboard-work-report-menu"
          :aria-expanded="isWorkReportMenuOpen"
          title="工作总结"
          @click.stop="toggleWorkReportMenu"
        >
          <IconFileText aria-hidden="true" />
          <span>工作总结</span>
          <IconChevronDown class="work-report-entry-btn__chevron" aria-hidden="true" />
        </button>

        <Transition name="work-report-menu-popover">
          <section
            v-if="isWorkReportMenuOpen"
            id="dashboard-work-report-menu"
            ref="workReportMenuPanelRef"
            class="work-report-menu-panel"
            aria-label="工作总结版本选择"
            @click.stop
            @pointerdown.stop
          >
            <span class="work-report-menu-panel__arrow" aria-hidden="true" />
            <header class="work-report-menu-panel__header">
              <strong>选择回顾方式</strong>
              <span>同一套内容，两种呈现体验</span>
            </header>
            <button type="button" class="work-report-menu-item" @click="openWorkReportClassic">
              <IconFileText aria-hidden="true" />
              <span>
                <strong>版本一 · 经典阅读</strong>
                <em>长文时间线，适合细读回看</em>
              </span>
            </button>
            <button type="button" class="work-report-menu-item is-featured" @click="openWorkReportStory">
              <IconSparkles aria-hidden="true" />
              <span>
                <strong>版本二 · 分镜回顾</strong>
                <em>翻页叙事，更接近年终总结</em>
              </span>
            </button>
          </section>
        </Transition>
      </div>
      <button
        v-if="!props.embedded"
        class="icon-button"
        type="button"
        aria-label="打开新手引导"
        title="打开新手引导"
        @click="openOnboardingTour"
      >
        <IconSparkles />
      </button>

      <div ref="settingsMenuWrapRef" class="settings-menu-wrap">
        <button
          class="icon-button"
          type="button"
          aria-label="设置"
          aria-controls="dashboard-settings-menu"
          :aria-expanded="isSettingsMenuOpen"
          title="设置"
          @click.stop="toggleSettingsMenu"
        >
          <IconSettings />
        </button>

        <Teleport to="body" :disabled="!props.embedded">
          <Transition name="settings-menu-popover">
            <section
              v-if="isSettingsMenuOpen"
              id="dashboard-settings-menu"
              ref="settingsMenuPanelRef"
              class="settings-menu-panel"
              :class="{ 'is-portal': props.embedded }"
              :style="settingsMenuPanelStyle"
              aria-label="设置菜单"
              @click.stop
              @pointerdown.stop
            >
              <span v-if="!props.embedded" class="settings-menu-panel__arrow" aria-hidden="true" />
              <button
                type="button"
                class="settings-menu-item"
                :disabled="isSyncingCalendar"
                @click="syncCalendarFromEmail"
              >
                <IconRefreshCw aria-hidden="true" :class="{ 'is-spinning': isSyncingCalendar }" />
                <span>{{ isSyncingCalendar ? '同步中…' : '同步邮箱日程' }}</span>
              </button>
              <button type="button" class="settings-menu-item" @click="openLeaderBoard">
                <IconLayoutDashboard aria-hidden="true" />
                <span>Token看板</span>
              </button>
              <button
                v-if="isAdminUser"
                type="button"
                class="settings-menu-item"
                @click="openSuggestionInbox"
              >
                <IconMailbox aria-hidden="true" />
                <span>心声收件箱</span>
              </button>
              <button
                v-if="props.embedded"
                type="button"
                class="settings-menu-item is-danger"
                :disabled="isLoggingOut"
                @click="handleLogout"
              >
                <IconLogOut aria-hidden="true" />
                <span>{{ isLoggingOut ? '正在退出…' : '退出登录' }}</span>
              </button>
            </section>
          </Transition>
        </Teleport>
      </div>

      <div v-if="!props.embedded" ref="userMenuPanelRef" class="user-menu-wrap">
        <button
          class="user-chip"
          type="button"
          aria-label="个人中心"
          aria-controls="dashboard-user-menu"
          :aria-expanded="isUserMenuOpen"
          @click="toggleUserMenu"
        >
          <img :src="avatarUrl" alt="用户头像" />
          <span>
            <strong>{{ displayName }}</strong>
            <em>{{ department }}</em>
          </span>
          <IconChevronDown class="user-chip__chevron" aria-hidden="true" />
        </button>

        <Transition name="user-menu-popover">
          <section
            v-if="isUserMenuOpen"
            id="dashboard-user-menu"
            class="user-menu-panel"
            aria-label="个人中心"
          >
            <span class="user-menu-panel__arrow" aria-hidden="true" />
            <header class="user-menu-panel__header">
              <img :src="avatarUrl" alt="" />
              <div>
                <strong>{{ displayName }}</strong>
                <span>{{ department }}</span>
              </div>
            </header>

            <button
              class="user-menu-panel__logout"
              type="button"
              :disabled="isLoggingOut"
              @click="handleLogout"
            >
              <IconLogOut aria-hidden="true" />
              <span>{{ isLoggingOut ? '正在退出…' : '退出登录' }}</span>
            </button>
          </section>
        </Transition>
      </div>
    </div>

    <DashboardSuggestionBox
      ref="suggestionBoxRef"
      v-model:open="isSuggestionBoxOpen"
      :view-mode="props.viewMode"
    />
    <EmployeeWorkReportDialog v-model:open="isWorkReportClassicOpen" :display-name="displayName" />
    <EmployeeWorkReportStoryDialog v-model:open="isWorkReportStoryOpen" :display-name="displayName" />
  </header>
</template>

<style scoped>
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .dashboard-topbar {
    background: linear-gradient(90deg, rgba(215, 232, 255, 0.38), rgba(244, 249, 255, 0.2)),
      linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(241, 247, 255, 0));
  }
}

.brand-block,
.topbar-tool-dock,
.topbar-actions {
  position: relative;
  z-index: 1;
}

.icon-button,
.user-chip {
  border: 1px solid transparent;
  background: transparent;
  color: #21304f;
  font: inherit;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.icon-button:hover,
.user-chip:hover {
  border-color: rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.62);
  color: #111827;
  transform: translateY(-1px);
  box-shadow: 0 12px 26px -18px rgba(15, 23, 42, 0.42);
}

.icon-button:focus-visible,
.user-chip:focus-visible {
  outline: 2px solid rgba(37, 99, 235, 0.34);
  outline-offset: 3px;
}

.user-menu-wrap,
.settings-menu-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.settings-menu-panel {
  --settings-menu-arrow-center: 31px;
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  width: min(220px, calc(100vw - 28px));
  box-sizing: border-box;
  border: 1px solid rgba(226, 232, 240, 0.92);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(24px);
  box-shadow:
    0 26px 58px -28px rgba(15, 23, 42, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
  padding: 6px;
  z-index: 30;
}

.settings-menu-panel.is-portal {
  position: fixed;
  z-index: 120;
}

.settings-menu-panel__arrow {
  position: absolute;
  top: -11px;
  right: calc(var(--settings-menu-arrow-center) - 11px);
  width: 22px;
  height: 11px;
  overflow: hidden;
  pointer-events: none;
  z-index: 1;
}

.settings-menu-panel__arrow::before {
  position: absolute;
  left: 50%;
  bottom: -8px;
  width: 16px;
  height: 16px;
  border: 1px solid rgba(226, 232, 240, 0.92);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: inset 1px 1px 0 rgba(255, 255, 255, 0.82);
  transform: translateX(-50%) rotate(45deg);
  content: '';
}

.settings-menu-item {
  width: 100%;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #0f172a;
  padding: 10px 12px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.2;
  text-align: left;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease;
}

.settings-menu-item:hover:not(:disabled),
.settings-menu-item:focus-visible {
  background: rgba(241, 245, 249, 0.92);
  color: #1d4ed8;
  outline: none;
}

.settings-menu-item.is-danger {
  color: #dc2626;
}

.settings-menu-item.is-danger:hover:not(:disabled),
.settings-menu-item.is-danger:focus-visible {
  background: rgba(254, 226, 226, 0.72);
  color: #b91c1c;
}

.settings-menu-item:disabled {
  cursor: wait;
  opacity: 0.72;
}

.settings-menu-item svg {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
}

.settings-menu-item svg.is-spinning {
  animation: settings-menu-spin 0.8s linear infinite;
}

@keyframes settings-menu-spin {
  to {
    transform: rotate(360deg);
  }
}

.settings-menu-popover-enter-active,
.settings-menu-popover-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.settings-menu-popover-enter-from,
.settings-menu-popover-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

.user-menu-panel {
  --user-menu-arrow-center: 31px;
  position: absolute;
  top: calc(100% + 14px);
  right: 0;
  width: min(240px, calc(100vw - 28px));
  box-sizing: border-box;
  border: 1px solid rgba(226, 232, 240, 0.92);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(24px);
  box-shadow:
    0 26px 58px -28px rgba(15, 23, 42, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
  padding: 10px;
  z-index: 30;
}

.user-menu-panel__arrow {
  position: absolute;
  top: -11px;
  right: calc(var(--user-menu-arrow-center) - 11px);
  width: 22px;
  height: 11px;
  overflow: hidden;
  pointer-events: none;
  z-index: 1;
}

.user-menu-panel__arrow::before {
  position: absolute;
  left: 50%;
  bottom: -8px;
  width: 16px;
  height: 16px;
  border: 1px solid rgba(226, 232, 240, 0.92);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: inset 1px 1px 0 rgba(255, 255, 255, 0.82);
  transform: translateX(-50%) rotate(45deg);
  content: '';
}

.user-menu-panel__header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px 12px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.82);
}

.user-menu-panel__header img {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  object-fit: cover;
  background: #dbeafe;
  flex: 0 0 auto;
}

.user-menu-panel__header div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.user-menu-panel__header strong {
  overflow: hidden;
  color: #0f172a;
  font-size: 14px;
  line-height: 1.2;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-menu-panel__header span {
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  line-height: 1.2;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-menu-panel__logout {
  position: relative;
  z-index: 1;
  width: 100%;
  margin-top: 8px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #dc2626;
  font: inherit;
  cursor: pointer;
  padding: 10px 12px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.user-menu-panel__logout:hover:not(:disabled),
.user-menu-panel__logout:focus-visible {
  background: rgba(254, 226, 226, 0.72);
  color: #b91c1c;
  transform: translateY(-1px);
}

.user-menu-panel__logout:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.user-menu-panel__logout svg {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
}

.user-menu-panel__logout span {
  font-size: 13px;
  font-weight: 850;
}

.user-menu-popover-enter-active,
.user-menu-popover-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.user-menu-popover-enter-from,
.user-menu-popover-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

.user-chip span {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-chip strong,
.user-chip em {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .dashboard-topbar {
    height: auto;
    min-height: 58px;
    padding: 8px 12px 10px;
  }

  .user-chip span {
    display: none;
  }

  .topbar-actions {
    gap: 4px;
  }

  .suggestion-entry-btn__label {
    display: none;
  }

  .work-report-entry-btn {
    width: 38px;
    min-height: 38px;
    padding: 0;
    justify-content: center;
  }

  .work-report-entry-btn span {
    display: none;
  }

  .work-report-entry-btn__chevron {
    display: none;
  }

  .suggestion-entry-btn {
    width: 38px;
    min-height: 38px;
    padding: 0;
    justify-content: center;
  }

  .suggestion-entry-btn__icon {
    width: 20px;
    height: 20px;
    background: transparent;
  }

  .suggestion-entry-btn__dot {
    top: 6px;
    right: 7px;
  }

  .notification-panel {
    --notification-arrow-center: 151px;
    right: -132px;
    border-radius: 18px;
  }

  .user-chip {
    min-height: 34px;
    padding: 2px;
    border-radius: 14px;
  }

  .user-chip img {
    width: 30px;
    height: 30px;
  }

  .user-chip__chevron {
    display: none;
  }
}

.dashboard-topbar {
  position: relative;
  z-index: 60;
  box-sizing: border-box;
  border-radius: 16px;
  background: radial-gradient(
      circle at 22% 20%,
      rgba(255, 255, 255, var(--glass-highlight-opacity, 0.7)),
      rgba(255, 255, 255, 0) 34%
    ),
    linear-gradient(
      145deg,
      rgba(255, 255, 255, var(--glass-gradient-start, 0.28)),
      rgba(238, 246, 255, var(--glass-gradient-end, 0.2))
    ),
    rgba(248, 252, 255, var(--glass-base-opacity, 0.18));

  backdrop-filter: blur(var(--glass-blur, 24px)) saturate(var(--glass-saturate, 1.16));
  -webkit-backdrop-filter: blur(var(--glass-blur, 24px)) saturate(var(--glass-saturate, 1.16));
  justify-content: space-between;
  width: calc(100% - clamp(48px, 3.8vw, 76px));
  height: 60px;
  min-height: 60px;
  margin: 8px auto 0;
  padding: 5px 24px;
  display: grid;
  grid-template-columns: minmax(270px, 1fr) auto;
  align-items: center;
  gap: 18px;
}

.dashboard-topbar.has-tool-dock {
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  padding-inline: 20px;
}

.dashboard-topbar.has-tool-dock .topbar-tool-dock {
  grid-column: 2;
  justify-self: stretch;
  width: 100%;
  min-width: 0;
}

.dashboard-topbar.has-tool-dock .topbar-tool-dock :deep(.tool-dock) {
  width: 100%;
  max-width: 100%;
  justify-content: flex-start;
  overflow-x: auto;
  scrollbar-width: none;
}

.dashboard-topbar.has-tool-dock .topbar-tool-dock :deep(.tool-dock::-webkit-scrollbar) {
  display: none;
}

.dashboard-topbar.has-tool-dock .brand-block {
  justify-self: start;
}

.dashboard-topbar.has-tool-dock .topbar-actions {
  grid-column: 3;
  justify-self: end;
  flex-shrink: 0;
  gap: 8px;
}

.dashboard-topbar.has-tool-dock .suggestion-entry-btn {
  width: 38px;
  min-height: 38px;
  padding: 0;
  justify-content: center;
}

.dashboard-topbar.has-tool-dock .suggestion-entry-btn__label {
  display: none;
}

.dashboard-topbar.has-tool-dock .suggestion-entry-btn__icon {
  width: 20px;
  height: 20px;
  background: transparent;
}

.dashboard-topbar.has-tool-dock .suggestion-entry-btn__dot {
  top: 6px;
  right: 7px;
}

.dashboard-topbar.has-tool-dock .work-report-entry-btn {
  width: 38px;
  min-height: 38px;
  padding: 0;
  justify-content: center;
}

.dashboard-topbar.has-tool-dock .work-report-entry-btn span {
  display: none;
}

.dashboard-topbar.has-tool-dock .work-report-entry-btn__chevron {
  display: none;
}

.dashboard-topbar.has-tool-dock .user-chip {
  max-width: 180px;
}

.dashboard-topbar.is-embedded.notification-open {
  z-index: 13;
}

.dashboard-topbar.is-embedded {
  grid-template-columns: minmax(0, 1fr) auto;
  position: relative;
  z-index: 2;
  width: 100%;
  height: auto;
  min-height: 0;
  min-width: 0;
  max-width: 100%;
  margin: 0;
  padding: 2px 4px 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  overflow: visible;
  align-items: center;
  gap: 10px;
}

.brand-block.is-embedded {
  grid-column: 1;
  justify-self: start;
  padding-left: 2px;
}

.topbar-actions.is-embedded-actions {
  grid-column: 2;
  justify-self: end;
  gap: 8px;
  padding-right: 0;
}

.topbar-tool-dock {
  min-width: 0;
  max-width: 100%;
}

.brand-block {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding-left: 0;
  justify-content: flex-start;
}

.brand-logo {
  width: 32px;
  height: 32px;
  display: block;
  object-fit: contain;
  flex: 0 0 auto;
}

.brand-title {
  color: #13203a;
  font-size: 18px;
  font-weight: 950;
  line-height: 1;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.brand-block--contextual {
  gap: 12px;
}

.contextual-back-btn {
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.62);
  color: #334155;
  padding: 6px 12px 6px 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease,
    border-color 0.18s ease;
}

.contextual-back-btn:hover,
.contextual-back-btn:focus-visible {
  border-color: rgba(255, 255, 255, 0.92);
  background: rgba(255, 255, 255, 0.9);
  color: #0f172a;
  transform: translateY(-1px);
  outline: none;
}

.contextual-back-btn svg {
  width: 15px;
  height: 15px;
  stroke-width: 2.5;
}

.contextual-divider {
  width: 1px;
  height: 18px;
  flex: 0 0 auto;
  background: rgba(148, 163, 184, 0.42);
}

.topbar-actions {
  min-width: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  box-shadow: none;
  padding-right: 0;
  gap: 18px;
}

.icon-button {
  position: relative;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  color: #172340;
}

.icon-button svg {
  width: 20px;
  height: 20px;
}

.suggestion-entry-btn {
  position: relative;
  border: 1px solid rgba(253, 186, 116, 0.72);
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(255, 247, 237, 0.96), rgba(254, 215, 170, 0.88));
  color: #c2410c;
  min-height: 38px;
  padding: 0 12px 0 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: inherit;
  font-size: 13px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  box-shadow:
    0 12px 24px -18px rgba(234, 88, 12, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
  animation: suggestion-entry-wiggle 4.8s ease-in-out infinite;
}

.suggestion-entry-btn:hover,
.suggestion-entry-btn:focus-visible {
  border-color: rgba(249, 115, 22, 0.88);
  color: #9a3412;
  transform: translateY(-2px) scale(1.02);
  box-shadow:
    0 16px 28px -16px rgba(234, 88, 12, 0.62),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
  outline: none;
}

.suggestion-entry-btn__icon {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.suggestion-entry-btn__icon svg {
  width: 14px;
  height: 14px;
}

.suggestion-entry-btn__dot {
  position: absolute;
  top: 4px;
  right: 6px;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #f97316;
  box-shadow: 0 0 0 2px rgba(255, 247, 237, 0.96);
  animation: suggestion-entry-pulse 2s ease-in-out infinite;
}

.work-report-entry-btn {
  border: 1px solid rgba(125, 154, 219, 0.42);
  border-radius: 999px;
  background: rgba(244, 248, 255, 0.86);
  color: #355da3;
  min-height: 38px;
  padding: 0 12px 0 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: inherit;
  font-size: 13px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
}

.work-report-entry-btn:hover,
.work-report-entry-btn:focus-visible {
  border-color: rgba(76, 122, 204, 0.68);
  background: rgba(232, 240, 255, 0.98);
  color: #1f4e9d;
  transform: translateY(-1px);
  outline: 2px solid rgba(59, 130, 246, 0.24);
  outline-offset: 2px;
}

.work-report-entry-btn svg {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
}

.work-report-menu-wrap {
  position: relative;
}

.work-report-entry-btn__chevron {
  width: 14px;
  height: 14px;
  color: rgba(53, 93, 163, 0.62);
  flex: 0 0 auto;
}

.work-report-menu-panel {
  --work-report-menu-arrow-center: 72px;
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  z-index: 90;
  width: min(300px, calc(100vw - 32px));
  padding: 10px;
  border: 1px solid rgba(214, 226, 244, 0.92);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 24px 48px -28px rgba(15, 23, 42, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(16px);
}

.work-report-menu-panel__arrow {
  position: absolute;
  top: -11px;
  right: calc(var(--work-report-menu-arrow-center) - 11px);
  width: 22px;
  height: 22px;
  overflow: hidden;
}

.work-report-menu-panel__arrow::before {
  position: absolute;
  left: 50%;
  bottom: -8px;
  width: 14px;
  height: 14px;
  border-top: 1px solid rgba(214, 226, 244, 0.92);
  border-left: 1px solid rgba(214, 226, 244, 0.92);
  background: rgba(255, 255, 255, 0.96);
  transform: translateX(-50%) rotate(45deg);
  content: '';
}

.work-report-menu-panel__header {
  padding: 6px 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.work-report-menu-panel__header strong {
  color: #152342;
  font-size: 14px;
  font-weight: 900;
}

.work-report-menu-panel__header span {
  color: #6b7c98;
  font-size: 12px;
  font-weight: 650;
}

.work-report-menu-item {
  width: 100%;
  border: 1px solid rgba(214, 226, 244, 0.72);
  border-radius: 14px;
  background: rgba(248, 251, 255, 0.88);
  color: #355da3;
  padding: 10px 12px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;
}

.work-report-menu-item + .work-report-menu-item {
  margin-top: 8px;
}

.work-report-menu-item svg {
  width: 18px;
  height: 18px;
  margin-top: 2px;
  flex: 0 0 auto;
}

.work-report-menu-item span {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.work-report-menu-item strong {
  color: #17305d;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.3;
}

.work-report-menu-item em {
  color: #6b7c98;
  font-size: 12px;
  font-style: normal;
  font-weight: 650;
  line-height: 1.45;
}

.work-report-menu-item:hover,
.work-report-menu-item:focus-visible {
  border-color: rgba(76, 122, 204, 0.68);
  background: rgba(237, 244, 255, 0.98);
  transform: translateY(-1px);
  outline: none;
}

.work-report-menu-item.is-featured {
  border-color: rgba(245, 158, 11, 0.42);
  background: linear-gradient(135deg, rgba(255, 247, 237, 0.96), rgba(255, 252, 245, 0.98));
}

.work-report-menu-item.is-featured strong {
  color: #9a3412;
}

.work-report-menu-popover-enter-active,
.work-report-menu-popover-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.work-report-menu-popover-enter-from,
.work-report-menu-popover-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

@keyframes suggestion-entry-wiggle {
  0%,
  88%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  90% {
    transform: translateY(-1px) rotate(-2deg);
  }
  92% {
    transform: translateY(-2px) rotate(2deg);
  }
  94% {
    transform: translateY(-1px) rotate(-1deg);
  }
}

@keyframes suggestion-entry-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.18);
    opacity: 0.72;
  }
}

@media (prefers-reduced-motion: reduce) {
  .suggestion-entry-btn,
  .suggestion-entry-btn__dot {
    animation: none;
  }
}

.user-chip {
  display: inline-flex;
  align-items: center;
  text-align: left;
  max-width: 226px;
  min-height: 46px;
  border-radius: 999px;
  padding: 4px 12px 4px 4px;
  gap: 10px;
}

.user-chip img {
  border-radius: 999px;
  object-fit: cover;
  background: #dbeafe;
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
}

.user-chip strong {
  line-height: 1.15;
  font-weight: 900;
  color: #101936;
  font-size: 15px;
}

.user-chip em {
  line-height: 1.15;
  font-style: normal;
  color: #53627e;
  font-size: 12px;
  font-weight: 800;
}

.user-chip__chevron {
  color: rgba(65, 81, 115, 0.62);
  flex: 0 0 auto;
  width: 15px;
  height: 15px;
}

@media (max-width: 760px) {
  .dashboard-topbar.is-embedded {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
  }

  .brand-block.is-embedded {
    grid-column: 1;
    gap: 8px;
  }

  .brand-block.is-embedded .brand-logo {
    width: 28px;
    height: 28px;
  }

  .brand-block.is-embedded .brand-title {
    font-size: 15px;
  }

  .topbar-actions.is-embedded-actions {
    grid-column: 2;
  }
}

@media (max-width: 1280px) {
  .dashboard-topbar {
    grid-template-columns: minmax(220px, 1fr) auto;
  }

  .dashboard-topbar.has-tool-dock {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 10px;
  }

  .brand-block {
    padding-left: 0;
    gap: 14px;
  }

  .topbar-actions {
    padding-right: 0;
    gap: 10px;
  }
}

@media (max-width: 900px) {
  .dashboard-topbar {
    width: calc(100% - 28px);
    height: 60px;
    min-height: 60px;
    margin-top: 10px;
    grid-template-columns: minmax(0, 1fr) auto;
    padding: 0 14px;
  }

  .dashboard-topbar.has-tool-dock {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .dashboard-topbar {
    border-radius: 0;
    border-left: none;
    border-right: none;
  }

  .user-chip span {
    display: none;
  }
}
</style>
