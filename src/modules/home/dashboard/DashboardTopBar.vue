<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import IconLogOut from '~icons/lucide/log-out'
import IconMessageCircle from '~icons/lucide/message-circle'
import IconSettings from '~icons/lucide/settings'
import IconX from '~icons/lucide/x'
import girlImage from '@/assets/libao.png'
import logoDarkImage from '@/assets/logoDark1.png'
import { routeConfig } from '@/config/route.config'
import {
  acceptTodos,
  loadAssignableUsers,
  loadPendingTodos,
  logoutSmartTodo,
  rejectTodo,
  transferTodos,
} from '@/modules/home/dashboard/todo.service'
import { formatEventTime } from '@/modules/home/dashboard/todoDisplay'
import type { CalendarEvent, CalendarUser } from '@/modules/home/dashboard/types'
import { useUserStore } from '@/stores/user.store'

const emit = defineEmits<{
  'calendar-refresh': []
  'open-todo': [payload: { id: string; date: string }]
}>()

const router = useRouter()
const userStore = useUserStore()

type PendingActionMode = 'reject' | 'transfer' | null

const notificationPanelRef = ref<HTMLElement | null>(null)
const userMenuPanelRef = ref<HTMLElement | null>(null)
const isNotificationPanelOpen = ref(false)
const isUserMenuOpen = ref(false)
const isLoggingOut = ref(false)
const isPendingLoading = ref(false)
const pendingError = ref('')
const pendingTodos = ref<CalendarEvent[]>([])
const assignableUsers = ref<CalendarUser[]>([])
const activeActionId = ref('')
const activeActionMode = ref<PendingActionMode>(null)
const rejectReason = ref('')
const transferAssigneeId = ref('')
const processingId = ref('')

const currentUser = computed<CalendarUser>(() => ({
  id: userStore.profile?.id ?? '',
  name: userStore.profile?.name ?? '未登录',
  role: userStore.profile?.role ?? 'employee',
  department: userStore.profile?.department,
  avatar: userStore.profile?.avatar,
  leaderId: userStore.profile?.leaderId,
  teamMemberIds: userStore.profile?.teamMemberIds,
}))

const displayName = computed(() => userStore.profile?.name ?? '刘美华')
const department = computed(() => userStore.profile?.department ?? '信息技术部')
const avatarUrl = computed(() => userStore.profile?.avatar ?? girlImage)
const unreadNotificationCount = computed(() => pendingTodos.value.length)
const transferCandidates = computed(() => {
  const users = assignableUsers.value.length ? assignableUsers.value : [currentUser.value]
  return users.filter((user) => user.id && user.id !== currentUser.value.id)
})

async function refreshAssignableUsers() {
  if (!currentUser.value.id) {
    assignableUsers.value = []
    return
  }

  try {
    assignableUsers.value = await loadAssignableUsers()
  } catch {
    assignableUsers.value = [currentUser.value]
  }
}

async function refreshPendingTodos() {
  if (!currentUser.value.id) {
    pendingTodos.value = []
    return
  }

  isPendingLoading.value = true
  pendingError.value = ''

  try {
    pendingTodos.value = await loadPendingTodos(currentUser.value, assignableUsers.value)
  } catch (error) {
    pendingTodos.value = []
    pendingError.value = error instanceof Error ? error.message : '加载待接受待办失败'
  } finally {
    isPendingLoading.value = false
  }
}

function resetPendingAction() {
  activeActionId.value = ''
  activeActionMode.value = null
  rejectReason.value = ''
  transferAssigneeId.value = ''
}

function pendingSummary(event: CalendarEvent) {
  const creator = event.creatorName ? `${event.creatorName} 派发` : '待接受待办'
  const schedule = formatEventTime(event)
  return `${creator} · ${schedule}`
}

function togglePendingAction(id: string, mode: Exclude<PendingActionMode, null>) {
  if (activeActionId.value === id && activeActionMode.value === mode) {
    resetPendingAction()
    return
  }

  activeActionId.value = id
  activeActionMode.value = mode
  rejectReason.value = ''
  transferAssigneeId.value = transferCandidates.value[0]?.id ?? ''
}

async function handleAcceptTodo(id: string) {
  processingId.value = id
  try {
    await acceptTodos(id)
    resetPendingAction()
    await refreshPendingTodos()
    emit('calendar-refresh')
  } catch (error) {
    pendingError.value = error instanceof Error ? error.message : '接受待办失败'
  } finally {
    processingId.value = ''
  }
}

async function handleRejectTodo(id: string) {
  processingId.value = id
  try {
    await rejectTodo(id, rejectReason.value.trim() || '暂不处理')
    resetPendingAction()
    await refreshPendingTodos()
    emit('calendar-refresh')
  } catch (error) {
    pendingError.value = error instanceof Error ? error.message : '拒绝待办失败'
  } finally {
    processingId.value = ''
  }
}

async function handleTransferTodo(id: string) {
  if (!transferAssigneeId.value) {
    pendingError.value = '请选择转发对象'
    return
  }

  processingId.value = id
  try {
    await transferTodos(id, transferAssigneeId.value)
    resetPendingAction()
    await refreshPendingTodos()
    emit('calendar-refresh')
  } catch (error) {
    pendingError.value = error instanceof Error ? error.message : '转发待办失败'
  } finally {
    processingId.value = ''
  }
}

function handleOpenTodo(event: CalendarEvent) {
  emit('open-todo', { id: event.id, date: event.date })
  closeNotificationPanel()
}

async function toggleNotificationPanel() {
  if (!isNotificationPanelOpen.value) {
    closeUserMenu()
    await refreshPendingTodos()
  }
  isNotificationPanelOpen.value = !isNotificationPanelOpen.value
}

function closeNotificationPanel() {
  isNotificationPanelOpen.value = false
}

function toggleUserMenu() {
  if (!isUserMenuOpen.value) {
    closeNotificationPanel()
  }
  isUserMenuOpen.value = !isUserMenuOpen.value
}

function closeUserMenu() {
  isUserMenuOpen.value = false
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
  const notificationElement = notificationPanelRef.value
  const userMenuElement = userMenuPanelRef.value

  if (notificationElement && !notificationElement.contains(event.target as Node)) {
    closeNotificationPanel()
  }

  if (userMenuElement && !userMenuElement.contains(event.target as Node)) {
    closeUserMenu()
  }
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeNotificationPanel()
    closeUserMenu()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
  void refreshAssignableUsers().then(() => refreshPendingTodos())
})

watch(
  () => userStore.profile?.id,
  (nextId, previousId) => {
    if (nextId === previousId) return
    void refreshAssignableUsers().then(() => refreshPendingTodos())
  },
)

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
})
</script>

<template>
  <header class="dashboard-topbar" aria-label="顶部导航">
    <div class="brand-block" aria-label="华力企业级AI平台">
      <span class="logo-mark" aria-hidden="true">
        <img :src="logoDarkImage" alt="" />
      </span>
      <div class="brand-copy">
        <strong>华力企业级AI平台</strong>
        <span>员工办公中台</span>
      </div>
    </div>

    <div class="topbar-actions">
      <div ref="notificationPanelRef" class="notification-wrap">
        <button
          class="icon-button has-badge"
          type="button"
          aria-label="消息通知"
          aria-controls="dashboard-notification-panel"
          :aria-expanded="isNotificationPanelOpen"
          @click="toggleNotificationPanel"
        >
          <IconMessageCircle />
          <span v-if="unreadNotificationCount">{{ unreadNotificationCount }}</span>
        </button>

        <Transition name="notification-popover">
          <section
            v-if="isNotificationPanelOpen"
            id="dashboard-notification-panel"
            class="notification-panel"
            aria-label="消息通知"
          >
            <header class="notification-panel__header">
              <div>
                <strong>待接受待办</strong>
                <span>待处理 {{ unreadNotificationCount }}</span>
              </div>
              <button type="button" aria-label="关闭消息通知" title="关闭消息通知" @click="closeNotificationPanel">
                <IconX />
              </button>
            </header>

            <p v-if="pendingError" class="notification-error">{{ pendingError }}</p>

            <div class="notification-list">
              <p v-if="isPendingLoading" class="notification-empty">正在加载待接受待办…</p>
              <p v-else-if="!pendingTodos.length" class="notification-empty">暂无待接受待办</p>

              <article
                v-for="todo in pendingTodos"
                :key="todo.id"
                class="notification-item is-unread"
              >
                <span class="notification-item__marker is-amber" aria-hidden="true" />
                <div class="notification-item__content">
                  <div class="notification-item__title-row">
                    <strong>{{ todo.title }}</strong>
                    <time>{{ formatEventTime(todo) }}</time>
                  </div>
                  <p>{{ pendingSummary(todo) }}</p>
                  <span>待接受</span>

                  <div class="notification-item__actions">
                    <button
                      type="button"
                      class="action-btn is-accept"
                      :disabled="processingId === todo.id"
                      @click="handleAcceptTodo(todo.id)"
                    >
                      {{ processingId === todo.id && activeActionMode !== 'reject' && activeActionMode !== 'transfer' ? '处理中…' : '接受' }}
                    </button>
                    <button
                      type="button"
                      class="action-btn is-reject"
                      :disabled="processingId === todo.id"
                      @click="togglePendingAction(todo.id, 'reject')"
                    >
                      拒绝
                    </button>
                    <button
                      type="button"
                      class="action-btn is-transfer"
                      :disabled="processingId === todo.id || !transferCandidates.length"
                      @click="togglePendingAction(todo.id, 'transfer')"
                    >
                      转发
                    </button>
                    <button type="button" class="action-btn is-view" @click="handleOpenTodo(todo)">
                      查看
                    </button>
                  </div>

                  <div
                    v-if="activeActionId === todo.id && activeActionMode === 'reject'"
                    class="notification-item__form"
                  >
                    <input
                      v-model="rejectReason"
                      type="text"
                      class="notification-input"
                      placeholder="拒绝原因（可选）"
                    />
                    <div class="notification-item__form-actions">
                      <button
                        type="button"
                        class="action-btn is-reject"
                        :disabled="processingId === todo.id"
                        @click="handleRejectTodo(todo.id)"
                      >
                        确认拒绝
                      </button>
                      <button type="button" class="action-btn is-muted" @click="resetPendingAction">
                        取消
                      </button>
                    </div>
                  </div>

                  <div
                    v-if="activeActionId === todo.id && activeActionMode === 'transfer'"
                    class="notification-item__form"
                  >
                    <div class="notification-transfer-picker">
                      <span class="notification-transfer-picker__label">选择转发对象</span>
                      <div class="notification-transfer-picker__list" role="listbox" aria-label="选择转发对象">
                        <button
                          v-for="user in transferCandidates"
                          :key="user.id"
                          type="button"
                          role="option"
                          class="notification-transfer-option"
                          :class="{ 'is-active': transferAssigneeId === user.id }"
                          :aria-selected="transferAssigneeId === user.id"
                          @click="transferAssigneeId = user.id"
                        >
                          {{ user.name }}
                        </button>
                      </div>
                    </div>
                    <div class="notification-item__form-actions">
                      <button
                        type="button"
                        class="action-btn is-transfer"
                        :disabled="processingId === todo.id"
                        @click="handleTransferTodo(todo.id)"
                      >
                        确认转发
                      </button>
                      <button type="button" class="action-btn is-muted" @click="resetPendingAction">
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </section>
        </Transition>
      </div>
      <button class="icon-button" type="button" aria-label="设置">
        <IconSettings />
      </button>

      <div ref="userMenuPanelRef" class="user-menu-wrap">
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
        </button>

        <Transition name="user-menu-popover">
          <section
            v-if="isUserMenuOpen"
            id="dashboard-user-menu"
            class="user-menu-panel"
            aria-label="个人中心"
          >
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
.dashboard-topbar {
  position: relative;
  z-index: 60;
  height: 60px;
  min-height: 60px;
  box-sizing: border-box;
  padding: 9px 22px;
  border: 0;
  background: rgba(255, 255, 255, 0.42);
  backdrop-filter: blur(18px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.brand-block {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.logo-mark {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  overflow: hidden;
}

.logo-mark img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.brand-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.brand-copy strong {
  color: #0f172a;
  font-size: 17px;
  line-height: 1.1;
  font-weight: 900;
}

.brand-copy span {
  color: #64748b;
  font-size: 12px;
  line-height: 1.2;
  font-weight: 800;
}

.topbar-actions {
  min-width: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.36);
  padding: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.58),
    0 12px 28px -28px rgba(15, 23, 42, 0.3);
}

.icon-button,
.user-chip {
  border: 1px solid transparent;
  background: transparent;
  color: #334155;
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
  border-color: transparent;
  background: rgba(255, 255, 255, 0.64);
  color: #0f172a;
  transform: translateY(-1px);
}

.icon-button:focus-visible,
.user-chip:focus-visible {
  outline: 2px solid rgba(37, 99, 235, 0.34);
  outline-offset: 3px;
}

.icon-button {
  position: relative;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.icon-button svg {
  width: 18px;
  height: 18px;
}

.notification-wrap,
.user-menu-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.icon-button.has-badge span {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 18px;
  height: 18px;
  box-sizing: border-box;
  border: 2px solid #ffffff;
  border-radius: 999px;
  background: #ef4444;
  color: #ffffff;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
}

.notification-panel {
  position: absolute;
  top: calc(100% + 14px);
  right: -104px;
  width: min(360px, calc(100vw - 28px));
  box-sizing: border-box;
  border: 1px solid rgba(226, 232, 240, 0.92);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(24px);
  box-shadow:
    0 26px 58px -28px rgba(15, 23, 42, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
  padding: 14px;
  z-index: 30;
}

.notification-panel::before {
  position: absolute;
  top: -7px;
  right: 116px;
  width: 14px;
  height: 14px;
  border-top: 1px solid rgba(226, 232, 240, 0.92);
  border-left: 1px solid rgba(226, 232, 240, 0.92);
  background: rgba(255, 255, 255, 0.92);
  transform: rotate(45deg);
  content: '';
}

.notification-panel__header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 2px 2px 12px;
}

.notification-panel__header div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.notification-panel__header strong {
  color: #0f172a;
  font-size: 16px;
  line-height: 1.2;
  font-weight: 900;
}

.notification-panel__header span {
  color: #64748b;
  font-size: 12px;
  line-height: 1.2;
  font-weight: 800;
}

.notification-panel__header button {
  width: 30px;
  height: 30px;
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
  transition:
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.notification-panel__header button:hover {
  background: #e2e8f0;
  color: #0f172a;
  transform: translateY(-1px);
}

.notification-panel__header button svg {
  width: 16px;
  height: 16px;
}

.notification-list {
  position: relative;
  z-index: 1;
  max-height: min(430px, calc(100vh - 150px));
  overflow: auto;
  padding-right: 2px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.notification-item {
  position: relative;
  border: 1px solid rgba(226, 232, 240, 0.82);
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.74);
  padding: 12px 12px 12px 34px;
  display: flex;
  gap: 10px;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.notification-item:hover {
  border-color: rgba(191, 219, 254, 0.96);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
}

.notification-item.is-unread {
  background: linear-gradient(135deg, rgba(239, 246, 255, 0.95), rgba(255, 255, 255, 0.92));
}

.notification-item__marker {
  position: absolute;
  top: 17px;
  left: 14px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  box-shadow: 0 0 0 4px rgba(226, 232, 240, 0.74);
}

.notification-item__marker.is-blue {
  background: #2563eb;
  box-shadow: 0 0 0 4px rgba(191, 219, 254, 0.78);
}

.notification-item__marker.is-green {
  background: #10b981;
  box-shadow: 0 0 0 4px rgba(187, 247, 208, 0.72);
}

.notification-item__marker.is-amber {
  background: #f59e0b;
  box-shadow: 0 0 0 4px rgba(254, 240, 138, 0.7);
}

.notification-item__marker.is-violet {
  background: #7c3aed;
  box-shadow: 0 0 0 4px rgba(221, 214, 254, 0.72);
}

.notification-item__content {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
}

.notification-item__title-row {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.notification-item__title-row strong {
  min-width: 0;
  overflow: hidden;
  color: #0f172a;
  font-size: 13px;
  line-height: 1.25;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-item__title-row time {
  flex: 0 0 auto;
  color: #94a3b8;
  font-size: 11px;
  line-height: 1.35;
  font-weight: 800;
}

.notification-item p {
  margin: 0;
  color: #475569;
  font-size: 12px;
  line-height: 1.55;
  font-weight: 700;
}

.notification-item__content > span {
  align-self: flex-start;
  border-radius: 999px;
  background: rgba(241, 245, 249, 0.92);
  color: #64748b;
  font-size: 11px;
  line-height: 1;
  font-weight: 850;
  padding: 6px 8px;
}

.notification-error {
  margin: 0 2px 8px;
  border-radius: 12px;
  background: rgba(254, 226, 226, 0.72);
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.45;
  font-weight: 750;
  padding: 8px 10px;
}

.notification-empty {
  margin: 0;
  border: 1px dashed rgba(226, 232, 240, 0.92);
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.72);
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
  font-weight: 750;
  padding: 18px 14px;
  text-align: center;
}

.notification-item__actions,
.notification-item__form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.notification-item__actions {
  margin-top: 2px;
}

.notification-item__form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
  overflow: visible;
}

.notification-input {
  width: 100%;
  min-width: 0;
  min-height: 34px;
  border: 1px solid rgba(226, 232, 240, 0.92);
  border-radius: 10px;
  background: #ffffff;
  color: #0f172a;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  padding: 0 10px;
}

.notification-transfer-picker {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.notification-transfer-picker__label {
  color: #64748b;
  font-size: 11px;
  line-height: 1.2;
  font-weight: 800;
}

.notification-transfer-picker__list {
  max-height: 160px;
  overflow: auto;
  border: 1px solid rgba(226, 232, 240, 0.92);
  border-radius: 12px;
  background: #ffffff;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notification-transfer-option {
  width: 100%;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #334155;
  font: inherit;
  font-size: 12px;
  line-height: 1.35;
  font-weight: 750;
  text-align: left;
  padding: 8px 10px;
  cursor: pointer;
  transition:
    background 0.16s ease,
    color 0.16s ease;
}

.notification-transfer-option:hover {
  background: rgba(241, 245, 249, 0.92);
  color: #0f172a;
}

.notification-transfer-option.is-active {
  background: rgba(219, 234, 254, 0.92);
  color: #1d4ed8;
  font-weight: 850;
}

.notification-input:focus-visible {
  outline: 2px solid rgba(37, 99, 235, 0.28);
  outline-offset: 2px;
}

.action-btn {
  border: 0;
  border-radius: 999px;
  background: rgba(241, 245, 249, 0.92);
  color: #334155;
  font: inherit;
  font-size: 11px;
  font-weight: 850;
  line-height: 1;
  padding: 7px 10px;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.action-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.action-btn.is-accept {
  background: rgba(220, 252, 231, 0.92);
  color: #047857;
}

.action-btn.is-reject {
  background: rgba(254, 226, 226, 0.92);
  color: #b91c1c;
}

.action-btn.is-transfer {
  background: rgba(219, 234, 254, 0.92);
  color: #1d4ed8;
}

.action-btn.is-view,
.action-btn.is-muted {
  background: rgba(241, 245, 249, 0.92);
  color: #64748b;
}

.notification-popover-enter-active,
.notification-popover-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.notification-popover-enter-from,
.notification-popover-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

.user-menu-panel {
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

.user-menu-panel::before {
  position: absolute;
  top: -7px;
  right: 24px;
  width: 14px;
  height: 14px;
  border-top: 1px solid rgba(226, 232, 240, 0.92);
  border-left: 1px solid rgba(226, 232, 240, 0.92);
  background: rgba(255, 255, 255, 0.92);
  transform: rotate(45deg);
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

.user-chip {
  max-width: 220px;
  min-height: 34px;
  border-radius: 999px;
  padding: 2px 10px 2px 4px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  text-align: left;
}

.user-chip img {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  object-fit: cover;
  background: #dbeafe;
  flex: 0 0 auto;
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

.user-chip strong {
  color: #111827;
  font-size: 13px;
  line-height: 1.15;
  font-weight: 900;
}

.user-chip em {
  color: #64748b;
  font-size: 11px;
  line-height: 1.15;
  font-style: normal;
  font-weight: 750;
}

@media (max-width: 760px) {
  .dashboard-topbar {
    height: auto;
    min-height: 64px;
    padding: 12px;
  }

  .brand-copy span,
  .user-chip span {
    display: none;
  }

  .topbar-actions {
    gap: 3px;
  }

  .notification-panel {
    right: -132px;
    border-radius: 18px;
  }

  .notification-panel::before {
    right: 144px;
  }

  .user-chip {
    min-height: 38px;
    padding: 2px;
    border-radius: 14px;
  }

  .user-chip img {
    width: 32px;
    height: 32px;
  }
}
</style>
