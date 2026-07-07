<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import IconChevronDown from '~icons/lucide/chevron-down'
import IconLogOut from '~icons/lucide/log-out'
import IconRefreshCw from '~icons/lucide/refresh-cw'
import IconSettings from '~icons/lucide/settings'
import IconSparkles from '~icons/lucide/sparkles'
import DashboardNotificationCenter from '@/modules/home/dashboard/components/DashboardNotificationCenter.vue'
import TopbarToolDock from '@/modules/home/dashboard/components/TopbarToolDock.vue'
import homeCardLogoImage from '@/assets/logo.png'
import { routeConfig } from '@/config/route.config'
import type { DashboardToolTarget } from '@/modules/home/dashboard/dashboardTools'
import { logoutSmartTodo, syncCalendar } from '@/modules/home/dashboard/todo.service'
import { useDashboardGlassSettings } from '@/modules/home/dashboard/useDashboardGlassSettings'
import { useDashboardTodosStore } from '@/stores/dashboard-todos.store'
import { useFeedbackStore } from '@/stores/feedback.store'
import { DEFAULT_USER_AVATAR, useUserStore } from '@/stores/user.store'

const emit = defineEmits<{
  'calendar-refresh': []
  'open-todo': [payload: { id: string; date?: string }]
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
  }>(),
  {
    embedded: false,
    hideNotifications: false,
    showToolDock: false,
    portalTarget: null,
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
const isUserMenuOpen = ref(false)
const isLoggingOut = ref(false)

const displayName = computed(() => userStore.profile?.name ?? '刘美华')
const department = computed(() => userStore.profile?.department ?? '信息技术部')
const avatarUrl = computed(() => userStore.profile?.avatar ?? DEFAULT_USER_AVATAR)

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

function closeUserMenu() {
  isUserMenuOpen.value = false
}

function closeSettingsMenu() {
  isSettingsMenuOpen.value = false
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

async function handleLogout() {
  if (isLoggingOut.value) {
    return
  }

  isLoggingOut.value = true
  closeUserMenu()

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
  const settingsMenuElement = settingsMenuPanelRef.value

  if (isUserMenuOpen.value) {
    const insideUserMenu = userMenuPanelRef.value?.contains(target)
    if (!insideUserMenu) {
      closeUserMenu()
    }
  }

  const insideSettingsMenu =
    settingsMenuWrapRef.value?.contains(target) || settingsMenuElement?.contains(target)

  if (isSettingsMenuOpen.value && !insideSettingsMenu) {
    closeSettingsMenu()
  }
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeNotificationPanel()
    closeUserMenu()
    closeSettingsMenu()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
})
</script>

<template>
  <header
    class="dashboard-topbar"
    :class="{
      'is-embedded': props.embedded,
      'has-tool-dock': props.showToolDock && !props.embedded,
      'notification-open': props.embedded && isNotificationPanelOpen,
    }"
    :style="props.embedded ? undefined : glassStyle"
    aria-label="顶部导航"
    data-tour-target="dashboard-topbar"
  >
    <div
      class="brand-block"
      :class="{ 'is-embedded': props.embedded }"
      aria-label="AI办公平台"
    >
      <img class="brand-logo" :src="homeCardLogoImage" alt="" />
      <span class="brand-title">AI办公平台</span>
    </div>

    <TopbarToolDock
      v-if="props.showToolDock && !props.embedded"
      class="topbar-tool-dock"
      @select="(payload) => emit('select-tool', payload)"
    />

    <div
      v-if="props.embedded"
      class="embedded-mode-toggle"
      role="tablist"
      aria-label="视图模式"
      data-tour-target="detail-mode"
    >
      <button type="button" role="tab" aria-selected="true" class="active">简约模式</button>
      <button type="button" role="tab" aria-selected="false" @click="emit('switch-mode', 'detail')">
        详细模式
      </button>
    </div>

    <div class="topbar-actions" :class="{ 'is-embedded-actions': props.embedded }">
      <DashboardNotificationCenter
        v-if="!props.hideNotifications"
        v-model:open="isNotificationPanelOpen"
        :use-portal="props.embedded"
        :portal-target="props.portalTarget"
        @calendar-refresh="emit('calendar-refresh')"
        @open-todo="(payload) => emit('open-todo', payload)"
      />
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
  grid-template-columns: minmax(230px, 0.72fr) minmax(0, 1.28fr) auto;
}

.dashboard-topbar.is-embedded.notification-open {
  z-index: 13;
}

.dashboard-topbar.is-embedded {
  position: relative;
  z-index: 2;
  width: 100%;
  height: auto;
  min-height: 0;
  margin: 0;
  padding: 2px 4px 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  overflow: visible;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.brand-block.is-embedded {
  grid-column: 1;
  justify-self: start;
  padding-left: 2px;
}

.embedded-mode-toggle {
  grid-column: 2;
  justify-self: center;
  flex: 0 0 auto;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.58);
  padding: 3px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.82);
}

.embedded-mode-toggle button {
  height: 30px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #60708d;
  padding: 0 14px;
  font: inherit;
  font-size: 12px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}

.embedded-mode-toggle button.active {
  background: linear-gradient(180deg, #5a9bff 0%, #438bff 100%);
  color: #ffffff;
  box-shadow:
    0 8px 18px -10px rgba(67, 139, 255, 0.88),
    inset 0 1px 0 rgba(255, 255, 255, 0.28);
}

.embedded-mode-toggle button:not(.active):hover {
  color: #2f7cff;
}

.topbar-actions.is-embedded-actions {
  grid-column: 3;
  justify-self: end;
  gap: 8px;
  padding-right: 0;
}

.topbar-tool-dock {
  min-width: 0;
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
    grid-template-columns: auto minmax(0, 1fr) auto;
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

  .embedded-mode-toggle {
    grid-column: 2;
    justify-self: center;
  }

  .topbar-actions.is-embedded-actions {
    grid-column: 3;
  }
}

@media (max-width: 1280px) {
  .dashboard-topbar {
    grid-template-columns: minmax(220px, 1fr) auto;
  }

  .dashboard-topbar.has-tool-dock {
    grid-template-columns: minmax(190px, 0.68fr) minmax(0, 1fr) auto;
    gap: 12px;
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
