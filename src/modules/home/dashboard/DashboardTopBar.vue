<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import IconChevronDown from '~icons/lucide/chevron-down'
import IconLogOut from '~icons/lucide/log-out'
import IconRefreshCw from '~icons/lucide/refresh-cw'
import IconSettings from '~icons/lucide/settings'
import IconSlidersHorizontal from '~icons/lucide/sliders-horizontal'
import IconSparkles from '~icons/lucide/sparkles'
import IconX from '~icons/lucide/x'
import DashboardNotificationCenter from '@/modules/home/dashboard/components/DashboardNotificationCenter.vue'
import girlImage from '@/assets/libao.png'
import logoDarkImage from '@/assets/logoDark1.png'
import { routeConfig } from '@/config/route.config'
import AppStateBlock from '@/shared/components/state/AppStateBlock.vue'
import {
  logoutSmartTodo,
  syncCalendar,
} from '@/modules/home/dashboard/todo.service'
import TopbarToolDock from '@/modules/home/dashboard/components/TopbarToolDock.vue'
import {
  navigateDashboardTool,
  type DashboardToolTarget,
} from '@/modules/home/dashboard/dashboardTools'
import { useDashboardGlassSettings } from '@/modules/home/dashboard/useDashboardGlassSettings'
import { useFeedbackStore } from '@/stores/feedback.store'
import { useUserStore } from '@/stores/user.store'

const emit = defineEmits<{
  'calendar-refresh': []
  'open-todo': [payload: { id: string; date?: string }]
  'start-onboarding': []
  'switch-mode': [mode: 'simple' | 'detail']
}>()

const props = withDefaults(
  defineProps<{
    showToolDock?: boolean
    embedded?: boolean
    hideNotifications?: boolean
    portalTarget?: HTMLElement | null
  }>(),
  {
    showToolDock: true,
    embedded: false,
    hideNotifications: false,
    portalTarget: null,
  },
)

const router = useRouter()
const userStore = useUserStore()
const feedbackStore = useFeedbackStore()

const userMenuPanelRef = ref<HTMLElement | null>(null)
const userMenuPortalRef = ref<HTMLElement | null>(null)
const embeddedProfileTriggerRef = ref<HTMLElement | null>(null)
const settingsMenuWrapRef = ref<HTMLElement | null>(null)
const settingsMenuPanelRef = ref<HTMLElement | null>(null)
const glassTriggerRef = ref<HTMLElement | null>(null)
const glassPanelRef = ref<HTMLElement | null>(null)
const glassPanelPosition = ref({ top: 0, right: 16 })
const settingsMenuPosition = ref({ top: 0, right: 16 })
const userMenuPosition = ref({ top: 0, left: 16, width: 240, arrowCenter: 120 })
const { glassSettings, glassStyle, resetGlassSettings } = useDashboardGlassSettings()
const isGlassPanelOpen = ref(false)
const isSettingsMenuOpen = ref(false)
const isSyncingCalendar = ref(false)
const isNotificationPanelOpen = ref(false)
const isUserMenuOpen = ref(false)
const isLoggingOut = ref(false)

const displayName = computed(() => userStore.profile?.name ?? '刘美华')
const department = computed(() => userStore.profile?.department ?? '信息技术部')
const avatarUrl = computed(() => userStore.profile?.avatar ?? girlImage)
const greetingText = computed(() => {
  return '早上好'
})

const settingsMenuPanelStyle = computed(() => {
  if (!props.embedded) return undefined

  const position = settingsMenuPosition.value
  return {
    top: `${position.top}px`,
    right: `${position.right}px`,
  }
})

const userMenuTeleportTarget = computed(() => props.portalTarget ?? 'body')

const userMenuPanelStyle = computed(() => {
  if (!props.embedded || !props.portalTarget) return undefined

  const position = userMenuPosition.value
  return {
    top: `${position.top}px`,
    left: `${position.left}px`,
    width: `${position.width}px`,
    '--user-menu-arrow-center': `${position.arrowCenter}px`,
    ...glassStyle.value,
  }
})

function closeNotificationPanel() {
  isNotificationPanelOpen.value = false
}

function closeUserMenu() {
  isUserMenuOpen.value = false
}

function closeGlassPanel() {
  isGlassPanelOpen.value = false
}

function closeSettingsMenu() {
  isSettingsMenuOpen.value = false
}

watch(isNotificationPanelOpen, (open) => {
  if (!open) return
  closeUserMenu()
  closeGlassPanel()
  closeSettingsMenu()
})

watch(isUserMenuOpen, async (open) => {
  if (open && props.embedded) {
    await nextTick()
    updateUserMenuPosition()
  }
})

watch(
  () => props.portalTarget,
  () => {
    if (isUserMenuOpen.value && props.embedded) updateUserMenuPosition()
  },
)

function updateUserMenuPosition() {
  const wrap = userMenuPanelRef.value
  if (!wrap) return

  const avatar = wrap.querySelector('.embedded-profile img')
  const anchor =
    avatar instanceof HTMLElement
      ? avatar
      : embeddedProfileTriggerRef.value ?? wrap.querySelector('.embedded-profile')
  if (!(anchor instanceof HTMLElement)) return

  const anchorRect = anchor.getBoundingClientRect()
  const padding = 12
  const panelWidth = 240

  if (props.embedded && props.portalTarget) {
    const containerRect = props.portalTarget.getBoundingClientRect()
    let left = anchorRect.left + anchorRect.width / 2 - containerRect.left - panelWidth / 2
    left = Math.max(padding, Math.min(left, containerRect.width - panelWidth - padding))
    const top = Math.max(padding, anchorRect.bottom - containerRect.top + 8)
    const panelRightAbs = containerRect.left + left + panelWidth
    const avatarCenterX = anchorRect.left + anchorRect.width / 2
    const arrowCenter = Math.max(28, Math.min(panelWidth - 28, panelRightAbs - avatarCenterX))

    userMenuPosition.value = {
      top,
      left,
      width: panelWidth,
      arrowCenter,
    }
    return
  }

  userMenuPosition.value = {
    top: anchorRect.bottom + 14,
    left: anchorRect.left,
    width: panelWidth,
    arrowCenter: 31,
  }
}

function toggleUserMenu() {
  if (!isUserMenuOpen.value) {
    closeNotificationPanel()
    closeGlassPanel()
    closeSettingsMenu()
    if (props.embedded) updateUserMenuPosition()
  }

  isUserMenuOpen.value = !isUserMenuOpen.value

  if (props.embedded && isUserMenuOpen.value) {
    void nextTick(() => updateUserMenuPosition())
  }
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
    closeGlassPanel()
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

function updateGlassPanelPosition() {
  const trigger = glassTriggerRef.value
  if (!trigger) return

  const rect = trigger.getBoundingClientRect()
  glassPanelPosition.value = {
    top: rect.bottom + 12,
    right: Math.max(16, window.innerWidth - rect.right),
  }
}

function toggleGlassPanel() {
  if (!isGlassPanelOpen.value) {
    closeNotificationPanel()
    closeUserMenu()
    closeSettingsMenu()
    updateGlassPanelPosition()
  }
  isGlassPanelOpen.value = !isGlassPanelOpen.value
}

function openTopbarTool(tool: DashboardToolTarget) {
  closeNotificationPanel()
  closeUserMenu()
  closeGlassPanel()
  closeSettingsMenu()
  void navigateDashboardTool(router, tool)
}

function openOnboardingTour() {
  closeNotificationPanel()
  closeUserMenu()
  closeGlassPanel()
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
    userStore.logout()
    isLoggingOut.value = false
    void router.replace({ path: routeConfig.loginRoute })
  }
}

function handleDocumentPointerDown(event: PointerEvent) {
  const target = event.target as Node
  const glassElement = glassPanelRef.value
  const settingsMenuElement = settingsMenuPanelRef.value

  if (isUserMenuOpen.value) {
    const insideUserMenu =
      userMenuPanelRef.value?.contains(target) || userMenuPortalRef.value?.contains(target)
    if (!insideUserMenu) {
      closeUserMenu()
    }
  }

  const glassTriggerElement = glassTriggerRef.value
  const insideGlassController =
    glassElement?.contains(target) || glassTriggerElement?.contains(target)

  if (isGlassPanelOpen.value && !insideGlassController) {
    closeGlassPanel()
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
    closeGlassPanel()
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
      'without-tools': !props.showToolDock,
      'is-embedded': props.embedded,
      'notification-open': props.embedded && isNotificationPanelOpen,
      'user-menu-open': props.embedded && isUserMenuOpen,
    }"
    :style="props.embedded ? undefined : glassStyle"
    aria-label="顶部导航"
    data-tour-target="dashboard-topbar"
  >
    <div
      v-if="props.embedded"
      ref="userMenuPanelRef"
      class="embedded-profile-wrap"
      :class="{ 'is-open': isUserMenuOpen }"
    >
      <button
        ref="embeddedProfileTriggerRef"
        class="embedded-profile"
        type="button"
        aria-label="个人中心"
        aria-controls="dashboard-user-menu"
        :aria-expanded="isUserMenuOpen"
        @click="toggleUserMenu"
      >
        <img :src="avatarUrl" alt="" />
        <span>
          <strong>{{ greetingText }}，{{ displayName }}</strong>
          <em>{{ department }}</em>
        </span>
      </button>

      <Teleport :to="userMenuTeleportTarget" :disabled="!props.embedded || !props.portalTarget">
        <Transition name="user-menu-popover">
          <section
            v-if="isUserMenuOpen"
            id="dashboard-user-menu"
            ref="userMenuPortalRef"
            class="user-menu-panel is-scoped-portal"
            :style="userMenuPanelStyle"
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
      </Teleport>
    </div>

    <div v-else class="brand-block" aria-label="华力企业级AI平台">
      <span class="logo-mark" aria-hidden="true">
        <img :src="logoDarkImage" alt="" />
      </span>
      <div class="brand-copy">
        <strong>{{ greetingText }}，</strong>
        <span>{{ displayName }}</span>
      </div>
    </div>

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

    <TopbarToolDock
      v-else-if="props.showToolDock"
      data-tour-target="tool-dock"
      @select="openTopbarTool"
    />

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
                <IconRefreshCw
                  aria-hidden="true"
                  :class="{ 'is-spinning': isSyncingCalendar }"
                />
                <span>{{ isSyncingCalendar ? '同步中…' : '同步邮箱日程' }}</span>
              </button>
            </section>
          </Transition>
        </Teleport>
      </div>

      <div ref="glassTriggerRef" class="glass-controller-wrap">
        <button
          class="icon-button"
          type="button"
          aria-label="磨砂效果调节"
          aria-controls="dashboard-glass-controller"
          :aria-expanded="isGlassPanelOpen"
          title="磨砂效果调节"
          @click.stop="toggleGlassPanel"
        >
          <IconSlidersHorizontal />
        </button>
      </div>

      <Teleport to="body">
        <Transition name="glass-controller-popover">
          <section
            v-if="isGlassPanelOpen"
            id="dashboard-glass-controller"
            ref="glassPanelRef"
            class="glass-controller-panel is-portal"
            :style="{
              top: `${glassPanelPosition.top}px`,
              right: `${glassPanelPosition.right}px`,
            }"
            aria-label="Topbar 磨砂效果调节"
            @click.stop
          >
            <header class="glass-controller-panel__header">
              <div>
                <strong>磨砂效果</strong>
                <span>{{
                  props.embedded ? '同步调节卡片磨砂效果' : '同步调节 Topbar 与简约模式右下角模块'
                }}</span>
              </div>
              <button type="button" aria-label="关闭" title="关闭" @click="closeGlassPanel">
                <IconX />
              </button>
            </header>

            <label class="glass-controller-field">
              <span
                >模糊强度 <em>{{ glassSettings.blur }}px</em></span
              >
              <input v-model.number="glassSettings.blur" type="range" min="0" max="40" step="1" />
            </label>

            <label class="glass-controller-field">
              <span
                >饱和度 <em>{{ glassSettings.saturate.toFixed(2) }}</em></span
              >
              <input
                v-model.number="glassSettings.saturate"
                type="range"
                min="0.5"
                max="2"
                step="0.02"
              />
            </label>

            <label class="glass-controller-field">
              <span
                >底色透明度 <em>{{ glassSettings.baseOpacity.toFixed(2) }}</em></span
              >
              <input
                v-model.number="glassSettings.baseOpacity"
                type="range"
                min="0"
                max="0.6"
                step="0.01"
              />
            </label>

            <label class="glass-controller-field">
              <span
                >高光强度 <em>{{ glassSettings.highlightOpacity.toFixed(2) }}</em></span
              >
              <input
                v-model.number="glassSettings.highlightOpacity"
                type="range"
                min="0"
                max="1"
                step="0.01"
              />
            </label>

            <label class="glass-controller-field">
              <span
                >渐变起点 <em>{{ glassSettings.gradientStart.toFixed(2) }}</em></span
              >
              <input
                v-model.number="glassSettings.gradientStart"
                type="range"
                min="0"
                max="0.8"
                step="0.01"
              />
            </label>

            <label class="glass-controller-field">
              <span
                >渐变终点 <em>{{ glassSettings.gradientEnd.toFixed(2) }}</em></span
              >
              <input
                v-model.number="glassSettings.gradientEnd"
                type="range"
                min="0"
                max="0.8"
                step="0.01"
              />
            </label>

            <label class="glass-controller-field">
              <span
                >边框透明度 <em>{{ glassSettings.borderOpacity.toFixed(2) }}</em></span
              >
              <input
                v-model.number="glassSettings.borderOpacity"
                type="range"
                min="0"
                max="1"
                step="0.01"
              />
            </label>

            <button type="button" class="glass-controller-reset" @click="resetGlassSettings">
              恢复默认
            </button>
          </section>
        </Transition>
      </Teleport>

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
.topbar-actions {
  position: relative;
  z-index: 1;
}

.brand-copy strong {
  color: #15213a;
  font-size: 18px;
  line-height: 1.1;
  font-weight: 900;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.54);
}

.brand-copy span {
  color: rgba(67, 82, 113, 0.82);
  font-size: 12px;
  line-height: 1.2;
  font-weight: 800;
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
.settings-menu-wrap,
.glass-controller-wrap {
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

.glass-controller-panel {
  width: min(300px, calc(100vw - 28px));
  box-sizing: border-box;
  border: 1px solid rgba(226, 232, 240, 0.92);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(24px);
  box-shadow:
    0 26px 58px -28px rgba(15, 23, 42, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
  padding: 14px;
}

.glass-controller-panel.is-portal {
  position: fixed;
  z-index: 120;
}

.glass-controller-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.glass-controller-panel__header div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.glass-controller-panel__header strong {
  color: #0f172a;
  font-size: 15px;
  font-weight: 900;
  line-height: 1.2;
}

.glass-controller-panel__header span {
  color: #64748b;
  font-size: 11px;
  font-weight: 750;
  line-height: 1.2;
}

.glass-controller-panel__header button {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 999px;
  background: rgba(241, 245, 249, 0.92);
  color: #64748b;
  cursor: pointer;
  font: inherit;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.glass-controller-panel__header button svg {
  width: 14px;
  height: 14px;
}

.glass-controller-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.glass-controller-field span {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #334155;
  font-size: 12px;
  font-weight: 800;
}

.glass-controller-field em {
  color: #2563eb;
  font-style: normal;
  font-size: 11px;
  font-weight: 900;
}

.glass-controller-field input[type='range'] {
  width: 100%;
  accent-color: #2563eb;
  cursor: pointer;
}

.glass-controller-reset {
  width: 100%;
  min-height: 34px;
  border: 0;
  border-radius: 10px;
  background: rgba(241, 245, 249, 0.92);
  color: #334155;
  font: inherit;
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
  margin-top: 4px;
  transition:
    background 0.18s ease,
    color 0.18s ease;
}

.glass-controller-reset:hover {
  background: rgba(219, 234, 254, 0.92);
  color: #1d4ed8;
}

.glass-controller-popover-enter-active,
.glass-controller-popover-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.glass-controller-popover-enter-from,
.glass-controller-popover-leave-to {
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

.user-menu-panel.is-scoped-portal {
  top: auto;
  right: auto;
  left: auto;
  z-index: 12;
  overflow: visible;
  border: 1px solid rgba(255, 255, 255, var(--glass-border-opacity, 0.58));
  background: radial-gradient(
      circle at 22% 20%,
      rgba(255, 255, 255, var(--glass-highlight-opacity, 0.62)),
      rgba(255, 255, 255, 0) 34%
    ),
    linear-gradient(
      145deg,
      rgba(255, 255, 255, var(--glass-gradient-start, 0.24)),
      rgba(238, 246, 255, var(--glass-gradient-end, 0.16))
    ),
    rgba(248, 252, 255, calc(var(--glass-base-opacity, 0.18) + 0.04));
  backdrop-filter: blur(calc(var(--glass-blur, 24px) + 4px))
    saturate(calc(var(--glass-saturate, 1.16) + 0.12));
  -webkit-backdrop-filter: blur(calc(var(--glass-blur, 24px) + 4px))
    saturate(calc(var(--glass-saturate, 1.16) + 0.12));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.68),
    0 20px 36px -24px rgba(15, 23, 42, 0.24);
}

.user-menu-panel.is-scoped-portal .user-menu-panel__arrow::before {
  border-color: rgba(255, 255, 255, var(--glass-border-opacity, 0.64));
  background: rgba(248, 252, 255, calc(var(--glass-base-opacity, 0.18) + 0.34));
  backdrop-filter: blur(var(--glass-blur, 24px));
  -webkit-backdrop-filter: blur(var(--glass-blur, 24px));
  box-shadow:
    inset 1px 1px 0 rgba(255, 255, 255, 0.72),
    0 -2px 6px -4px rgba(15, 23, 42, 0.12);
}

.user-menu-panel.is-scoped-portal .user-menu-panel__header,
.user-menu-panel.is-scoped-portal .user-menu-panel__logout {
  position: relative;
  z-index: 1;
  background: inherit;
}

.user-menu-panel.is-scoped-portal .user-menu-panel__header {
  border-radius: 18px 18px 0 0;
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

  .brand-copy span,
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
  grid-template-columns: minmax(270px, 0.78fr) minmax(560px, auto) minmax(270px, 0.78fr);
  align-items: center;
  gap: 18px;
}

.dashboard-topbar.without-tools {
  grid-template-columns: minmax(270px, 1fr) auto;
}

.dashboard-topbar.is-embedded.notification-open,
.dashboard-topbar.is-embedded.user-menu-open {
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
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
}

.embedded-profile-wrap {
  position: relative;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  z-index: 1;
}

.embedded-profile-wrap.is-open .embedded-profile img {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.94),
    0 0 0 2px rgba(67, 139, 255, 0.18),
    0 10px 22px -14px rgba(67, 139, 255, 0.42);
}

.embedded-profile {
  min-width: 0;
  border: 0;
  background: transparent;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.embedded-profile:hover,
.embedded-profile:focus-visible {
  transform: translateY(-1px);
  outline: none;
}

.embedded-profile img {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  object-fit: cover;
  flex: 0 0 auto;
  border: 1px solid rgba(255, 255, 255, 0.84);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.94),
    0 10px 22px -18px rgba(15, 32, 61, 0.42);
}

.embedded-profile span {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.embedded-profile strong {
  color: #101936;
  font-size: 15px;
  line-height: 1.1;
  font-weight: 950;
  white-space: nowrap;
}

.embedded-profile em {
  color: rgba(67, 82, 113, 0.82);
  font-size: 12px;
  line-height: 1;
  font-style: normal;
  font-weight: 800;
  white-space: nowrap;
}

.embedded-mode-toggle {
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
  gap: 8px;
  padding-right: 0;
}

.brand-block {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  padding-left: 0;
  gap: 16px;
}

.logo-mark {
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  overflow: hidden;
  width: 46px;
  height: 46px;
  border-color: rgba(255, 255, 255, 0.84);
  background: rgba(255, 255, 255, 0.72);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.94),
    0 14px 28px -22px rgba(15, 32, 61, 0.54);
}

.logo-mark img {
  object-fit: contain;
  display: block;
  width: 32px;
  height: 32px;
}

.brand-copy {
  min-width: 0;
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: 22px;
  white-space: nowrap;
}

.brand-copy strong,
.brand-copy span {
  color: #101936;
  font-size: 20px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: 0;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.64);
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
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
  }

  .embedded-mode-toggle {
    grid-column: 1 / -1;
    justify-self: center;
  }

  .embedded-profile em {
    display: none;
  }
}

@media (max-width: 1280px) {
  .dashboard-topbar {
    grid-template-columns: minmax(220px, 0.7fr) minmax(0, 1fr) auto;
  }

  .dashboard-topbar.without-tools {
    grid-template-columns: minmax(220px, 1fr) auto;
  }

  .brand-block {
    padding-left: 0;
    gap: 14px;
  }

  .brand-copy {
    gap: 12px;
  }

  .brand-copy strong,
  .brand-copy span {
    font-size: 19px;
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
    grid-template-columns: auto 1fr auto;
    padding: 0 14px;
  }

  .dashboard-topbar {
    border-radius: 0;
    border-left: none;
    border-right: none;
  }

  .brand-copy span {
    display: none;
  }

  .brand-copy strong {
    font-size: 17px;
  }

  .user-chip span {
    display: none;
  }
}
</style>
