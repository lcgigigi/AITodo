<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import IconBell from '~icons/lucide/bell'
import IconCheckCheck from '~icons/lucide/check-check'
import IconChevronDown from '~icons/lucide/chevron-down'
import IconExternalLink from '~icons/lucide/external-link'
import IconLogOut from '~icons/lucide/log-out'
import IconSettings from '~icons/lucide/settings'
import IconSlidersHorizontal from '~icons/lucide/sliders-horizontal'
import IconSparkles from '~icons/lucide/sparkles'
import IconTrash2 from '~icons/lucide/trash-2'
import IconX from '~icons/lucide/x'
import girlImage from '@/assets/libao.png'
import logoDarkImage from '@/assets/logoDark1.png'
import { routeConfig } from '@/config/route.config'
import AppStateBlock from '@/shared/components/state/AppStateBlock.vue'
import {
  acceptTodos,
  loadAssignableUsers,
  loadPendingTodos,
  logoutSmartTodo,
  rejectTodo,
} from '@/modules/home/dashboard/todo.service'
import { formatEventTime } from '@/modules/home/dashboard/todoDisplay'
import {
  buildSysMessageWebSocketUrl,
  deleteSysMessages,
  loadSysMessages,
  markAllSysMessagesRead,
  markSysMessagesRead,
  normalizeSysMessagePush,
  type SysMessage,
  type SysMessageFilter,
} from '@/modules/home/dashboard/sys-message.service'
import {
  hasSysMessage,
  markAllSysMessagesReadInList,
  markSysMessageIdsReadInList,
  mergeSysMessages,
  removeSysMessageIdsFromList,
} from '@/modules/home/dashboard/sys-message.state'
import TopbarToolDock from '@/modules/home/dashboard/components/TopbarToolDock.vue'
import {
  navigateDashboardTool,
  type DashboardToolTarget,
} from '@/modules/home/dashboard/dashboardTools'
import { useDashboardGlassSettings } from '@/modules/home/dashboard/useDashboardGlassSettings'
import type { CalendarEvent, CalendarUser } from '@/modules/home/dashboard/types'
import { useFeedbackStore } from '@/stores/feedback.store'
import { useUserStore } from '@/stores/user.store'

const emit = defineEmits<{
  'calendar-refresh': []
  'open-todo': [payload: { id: string; date?: string }]
  'start-onboarding': []
}>()

const props = withDefaults(
  defineProps<{
    showToolDock?: boolean
  }>(),
  {
    showToolDock: true,
  },
)

const router = useRouter()
const userStore = useUserStore()
const feedbackStore = useFeedbackStore()

type PendingActionMode = 'reject' | null
type NotificationTab = 'sys-message' | 'pending-todo'

const SYS_MESSAGE_PAGE_SIZE = 10

const notificationPanelRef = ref<HTMLElement | null>(null)
const userMenuPanelRef = ref<HTMLElement | null>(null)
const glassTriggerRef = ref<HTMLElement | null>(null)
const glassPanelRef = ref<HTMLElement | null>(null)
const glassPanelPosition = ref({ top: 0, right: 16 })
const { glassSettings, glassStyle, resetGlassSettings } = useDashboardGlassSettings()
const isGlassPanelOpen = ref(false)
const isNotificationPanelOpen = ref(false)
const isUserMenuOpen = ref(false)
const isLoggingOut = ref(false)
const activeNotificationTab = ref<NotificationTab>('sys-message')
const sysMessageFilter = ref<SysMessageFilter>('unread')
const isSysMessageLoading = ref(false)
const isSysMessageLoadingMore = ref(false)
const sysMessageError = ref('')
const sysMessages = ref<SysMessage[]>([])
const sysMessageTotal = ref(0)
const sysMessagePageNum = ref(1)
const unreadSysMessageCount = ref(0)
const processingSysMessageId = ref('')
const isPendingLoading = ref(false)
const pendingError = ref('')
const pendingTodos = ref<CalendarEvent[]>([])
const assignableUsers = ref<CalendarUser[]>([])
const activeActionId = ref('')
const activeActionMode = ref<PendingActionMode>(null)
const rejectReason = ref('')
const processingId = ref('')
let sysMessageSocket: WebSocket | null = null
let sysMessageReconnectTimer: ReturnType<typeof setTimeout> | null = null
let sysMessageReconnectAttempts = 0
let isSysMessageSocketStopped = false

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
const greetingText = computed(() => {
  return '早上好'
})
const unreadNotificationCount = computed(() => unreadSysMessageCount.value)
const hasMoreSysMessages = computed(
  () => sysMessagePageNum.value * SYS_MESSAGE_PAGE_SIZE < sysMessageTotal.value,
)
const sysMessageSummary = computed(() =>
  sysMessageFilter.value === 'unread'
    ? `未读 ${unreadSysMessageCount.value}`
    : `全部 ${sysMessageTotal.value}`,
)

function isPendingConfirmOnly(todo: CalendarEvent) {
  return todo.backendStatus === 9
}

function resetSysMessageState() {
  sysMessages.value = []
  sysMessageTotal.value = 0
  sysMessagePageNum.value = 1
  unreadSysMessageCount.value = 0
  sysMessageError.value = ''
}

function getSysMessageStatusText(message: SysMessage) {
  return message.msgStatus === 0 ? '未读' : '已读'
}

function getSysMessageBizLabel(message: SysMessage) {
  if (message.bizType === 1) return '智能待办'
  if (message.bizType === 2) return '会议'
  return message.msgType === 1 ? '系统消息' : '消息'
}

function isSysMessageOpenable(message: SysMessage) {
  return Boolean(message.bizId) && (message.bizType === 1 || message.bizType === 2)
}

function formatSysMessageTime(value?: string) {
  if (!value) return ''

  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value

  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const pad = (item: number) => String(item).padStart(2, '0')

  if (isToday) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function getSysMessagePreview(content: string) {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' · ')
}

async function refreshUnreadSysMessageCount() {
  if (!currentUser.value.id) {
    unreadSysMessageCount.value = 0
    return
  }

  try {
    const result = await loadSysMessages({ pageNum: 1, pageSize: 1, msgStatus: 0 })
    unreadSysMessageCount.value = result.total
  } catch {
    // 未读数失败不阻断消息列表，弹层内会展示列表错误。
  }
}

async function refreshSysMessages(pageNum = 1) {
  if (!currentUser.value.id) {
    resetSysMessageState()
    return
  }

  const isFirstPage = pageNum === 1
  if (isFirstPage) {
    isSysMessageLoading.value = true
  } else {
    isSysMessageLoadingMore.value = true
  }
  sysMessageError.value = ''

  try {
    const result = await loadSysMessages({
      pageNum,
      pageSize: SYS_MESSAGE_PAGE_SIZE,
      msgStatus: sysMessageFilter.value === 'unread' ? 0 : undefined,
    })
    sysMessages.value = mergeSysMessages(isFirstPage ? [] : sysMessages.value, result.rows)
    sysMessageTotal.value = result.total
    sysMessagePageNum.value = result.pageNum

    if (sysMessageFilter.value === 'unread') {
      unreadSysMessageCount.value = result.total
    } else {
      void refreshUnreadSysMessageCount()
    }
  } catch (error) {
    if (isFirstPage) sysMessages.value = []
    sysMessageError.value = error instanceof Error ? error.message : '加载站内消息失败'
  } finally {
    isSysMessageLoading.value = false
    isSysMessageLoadingMore.value = false
  }
}

async function loadMoreSysMessages() {
  if (isSysMessageLoadingMore.value || !hasMoreSysMessages.value) return
  await refreshSysMessages(sysMessagePageNum.value + 1)
}

function setNotificationTab(tab: NotificationTab) {
  activeNotificationTab.value = tab

  if (tab === 'sys-message') {
    void refreshSysMessages()
    return
  }

  void refreshPendingTodos()
}

function setSysMessageFilter(filter: SysMessageFilter) {
  if (sysMessageFilter.value === filter) return

  sysMessageFilter.value = filter
  void refreshSysMessages()
}

function applySysMessageReadState(message: SysMessage) {
  if (message.msgStatus !== 0) return

  unreadSysMessageCount.value = Math.max(0, unreadSysMessageCount.value - 1)

  if (sysMessageFilter.value === 'unread') {
    sysMessages.value = removeSysMessageIdsFromList(sysMessages.value, [message.rawId])
    sysMessageTotal.value = Math.max(0, sysMessageTotal.value - 1)
    return
  }

  sysMessages.value = markSysMessageIdsReadInList(sysMessages.value, [message.rawId])
}

async function readSysMessage(message: SysMessage) {
  if (message.msgStatus !== 0) return

  await markSysMessagesRead([message.rawId])
  applySysMessageReadState(message)
}

async function handleMarkSysMessageRead(message: SysMessage) {
  if (message.msgStatus !== 0 || processingSysMessageId.value) return

  processingSysMessageId.value = message.id
  sysMessageError.value = ''

  try {
    await readSysMessage(message)
  } catch (error) {
    sysMessageError.value = error instanceof Error ? error.message : '标记消息已读失败'
  } finally {
    processingSysMessageId.value = ''
  }
}

async function handleMarkAllSysMessagesRead() {
  if (unreadSysMessageCount.value === 0 || processingSysMessageId.value) return

  processingSysMessageId.value = 'all'
  sysMessageError.value = ''

  try {
    await markAllSysMessagesRead()
    unreadSysMessageCount.value = 0

    if (sysMessageFilter.value === 'unread') {
      sysMessages.value = []
      sysMessageTotal.value = 0
    } else {
      sysMessages.value = markAllSysMessagesReadInList(sysMessages.value)
    }
  } catch (error) {
    sysMessageError.value = error instanceof Error ? error.message : '全部标记已读失败'
  } finally {
    processingSysMessageId.value = ''
  }
}

async function handleDeleteSysMessage(message: SysMessage) {
  if (processingSysMessageId.value) return

  processingSysMessageId.value = message.id
  sysMessageError.value = ''

  try {
    await deleteSysMessages([message.rawId])
    sysMessages.value = removeSysMessageIdsFromList(sysMessages.value, [message.rawId])
    sysMessageTotal.value = Math.max(0, sysMessageTotal.value - 1)

    if (message.msgStatus === 0) {
      unreadSysMessageCount.value = Math.max(0, unreadSysMessageCount.value - 1)
    }
  } catch (error) {
    sysMessageError.value = error instanceof Error ? error.message : '删除消息失败'
  } finally {
    processingSysMessageId.value = ''
  }
}

async function handleOpenSysMessage(message: SysMessage) {
  if (!isSysMessageOpenable(message) || processingSysMessageId.value) return

  processingSysMessageId.value = message.id
  sysMessageError.value = ''

  try {
    await readSysMessage(message)
    emit('open-todo', { id: message.bizId ?? '' })
    closeNotificationPanel()
  } catch (error) {
    sysMessageError.value = error instanceof Error ? error.message : '打开关联待办失败'
  } finally {
    processingSysMessageId.value = ''
  }
}

function clearSysMessageReconnectTimer() {
  if (!sysMessageReconnectTimer) return
  clearTimeout(sysMessageReconnectTimer)
  sysMessageReconnectTimer = null
}

function scheduleSysMessageReconnect() {
  clearSysMessageReconnectTimer()
  if (isSysMessageSocketStopped || !currentUser.value.id) return

  const delay = Math.min(30_000, 3_000 + sysMessageReconnectAttempts * 2_000)
  sysMessageReconnectAttempts += 1
  sysMessageReconnectTimer = setTimeout(connectSysMessageSocket, delay)
}

function handleSysMessageSocketPayload(rawData: string) {
  let parsed: unknown

  try {
    parsed = JSON.parse(rawData)
  } catch {
    return
  }

  const message = normalizeSysMessagePush(parsed as { type: 'sys_message' })
  if (!message) return

  const alreadyExists = hasSysMessage(sysMessages.value, message.id)
  const shouldShowInCurrentFilter =
    sysMessageFilter.value === 'all' || message.msgStatus === 0 || alreadyExists

  if (shouldShowInCurrentFilter) {
    sysMessages.value = mergeSysMessages(sysMessages.value, [message], { prepend: true })

    if (!alreadyExists) {
      sysMessageTotal.value += 1
    }
  }

  if (!alreadyExists && message.msgStatus === 0) {
    unreadSysMessageCount.value += 1
  }

  feedbackStore.info(message.msgSubject || '收到新的站内消息')
}

function stopSysMessageSocket() {
  isSysMessageSocketStopped = true
  clearSysMessageReconnectTimer()

  if (!sysMessageSocket) return

  const socket = sysMessageSocket
  sysMessageSocket = null
  socket.onopen = null
  socket.onmessage = null
  socket.onclose = null
  socket.onerror = null

  if (
    typeof WebSocket !== 'undefined' &&
    (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
  ) {
    socket.close()
  }
}

function connectSysMessageSocket() {
  if (!currentUser.value.id || typeof WebSocket === 'undefined') return

  const url = buildSysMessageWebSocketUrl(currentUser.value.id)
  if (!url) return

  isSysMessageSocketStopped = false
  clearSysMessageReconnectTimer()

  if (
    sysMessageSocket &&
    (sysMessageSocket.readyState === WebSocket.OPEN ||
      sysMessageSocket.readyState === WebSocket.CONNECTING)
  ) {
    return
  }

  const socket = new WebSocket(url)
  sysMessageSocket = socket

  socket.onopen = () => {
    sysMessageReconnectAttempts = 0
  }

  socket.onmessage = (event) => {
    if (typeof event.data === 'string') {
      handleSysMessageSocketPayload(event.data)
    }
  }

  socket.onclose = () => {
    if (sysMessageSocket === socket) {
      sysMessageSocket = null
    }
    scheduleSysMessageReconnect()
  }

  socket.onerror = () => {
    socket.close()
  }
}

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

function handleOpenTodo(event: CalendarEvent) {
  emit('open-todo', { id: event.id, date: event.date })
  closeNotificationPanel()
}

async function toggleNotificationPanel() {
  if (!isNotificationPanelOpen.value) {
    closeUserMenu()
    closeGlassPanel()
    await Promise.all([refreshSysMessages(), refreshPendingTodos()])
  }
  isNotificationPanelOpen.value = !isNotificationPanelOpen.value
}

function closeNotificationPanel() {
  isNotificationPanelOpen.value = false
}

function toggleUserMenu() {
  if (!isUserMenuOpen.value) {
    closeNotificationPanel()
    closeGlassPanel()
  }
  isUserMenuOpen.value = !isUserMenuOpen.value
}

function closeUserMenu() {
  isUserMenuOpen.value = false
}

function closeGlassPanel() {
  isGlassPanelOpen.value = false
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
    updateGlassPanelPosition()
  }
  isGlassPanelOpen.value = !isGlassPanelOpen.value
}

function openTopbarTool(tool: DashboardToolTarget) {
  closeNotificationPanel()
  closeUserMenu()
  closeGlassPanel()
  void navigateDashboardTool(router, tool)
}

function openOnboardingTour() {
  closeNotificationPanel()
  closeUserMenu()
  closeGlassPanel()
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
    stopSysMessageSocket()
    userStore.logout()
    isLoggingOut.value = false
    void router.replace({ path: routeConfig.loginRoute })
  }
}

function handleDocumentPointerDown(event: PointerEvent) {
  const notificationElement = notificationPanelRef.value
  const userMenuElement = userMenuPanelRef.value
  const glassElement = glassPanelRef.value

  if (notificationElement && !notificationElement.contains(event.target as Node)) {
    closeNotificationPanel()
  }

  if (userMenuElement && !userMenuElement.contains(event.target as Node)) {
    closeUserMenu()
  }

  const glassTriggerElement = glassTriggerRef.value
  const glassTarget = event.target as Node
  const insideGlassController =
    glassElement?.contains(glassTarget) || glassTriggerElement?.contains(glassTarget)

  if (isGlassPanelOpen.value && !insideGlassController) {
    closeGlassPanel()
  }
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeNotificationPanel()
    closeUserMenu()
    closeGlassPanel()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
  void refreshAssignableUsers().then(() => refreshPendingTodos())
  void refreshSysMessages()
  connectSysMessageSocket()
})

watch(
  () => userStore.profile?.id,
  (nextId, previousId) => {
    if (nextId === previousId) return
    stopSysMessageSocket()
    resetSysMessageState()
    void refreshAssignableUsers().then(() => refreshPendingTodos())
    void refreshSysMessages()
    if (nextId) connectSysMessageSocket()
  },
)

onBeforeUnmount(() => {
  stopSysMessageSocket()
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
})
</script>

<template>
  <header
    class="dashboard-topbar"
    :class="{ 'without-tools': !props.showToolDock }"
    :style="glassStyle"
    aria-label="顶部导航"
    data-tour-target="dashboard-topbar"
  >
    <div class="brand-block" aria-label="华力企业级AI平台">
      <span class="logo-mark" aria-hidden="true">
        <img :src="logoDarkImage" alt="" />
      </span>
      <div class="brand-copy">
        <strong>{{ greetingText }}，</strong>
        <span>{{ displayName }}</span>
      </div>
    </div>

    <TopbarToolDock
      v-if="props.showToolDock"
      data-tour-target="tool-dock"
      @select="openTopbarTool"
    />

    <div class="topbar-actions">
      <div ref="notificationPanelRef" class="notification-wrap">
        <button
          class="icon-button has-badge"
          type="button"
          aria-label="消息通知"
          aria-controls="dashboard-notification-panel"
          :aria-expanded="isNotificationPanelOpen"
          data-tour-target="notifications"
          @click="toggleNotificationPanel"
        >
          <IconBell />
          <span v-if="unreadNotificationCount">{{ unreadNotificationCount }}</span>
        </button>

        <Transition name="notification-popover">
          <section
            v-if="isNotificationPanelOpen"
            id="dashboard-notification-panel"
            class="notification-panel"
            aria-label="消息通知"
            data-tour-target="notification-panel"
          >
            <span class="notification-panel__arrow" aria-hidden="true" />
            <header class="notification-panel__header">
              <div>
                <strong>消息中心</strong>
                <span>{{ sysMessageSummary }} · 待处理 {{ pendingTodos.length }}</span>
              </div>
              <button
                v-if="activeNotificationTab === 'sys-message'"
                type="button"
                aria-label="全部标记已读"
                title="全部标记已读"
                :disabled="unreadSysMessageCount === 0 || processingSysMessageId === 'all'"
                @click="handleMarkAllSysMessagesRead"
              >
                <IconCheckCheck />
              </button>
              <button
                type="button"
                aria-label="关闭消息通知"
                title="关闭消息通知"
                @click="closeNotificationPanel"
              >
                <IconX />
              </button>
            </header>

            <div
              class="notification-tabs"
              role="tablist"
              aria-label="消息分类"
              data-tour-target="notification-tabs"
            >
              <button
                type="button"
                role="tab"
                :aria-selected="activeNotificationTab === 'sys-message'"
                :class="{ active: activeNotificationTab === 'sys-message' }"
                @click="setNotificationTab('sys-message')"
              >
                站内消息
                <span>{{ unreadSysMessageCount }}</span>
              </button>
              <button
                type="button"
                role="tab"
                :aria-selected="activeNotificationTab === 'pending-todo'"
                :class="{ active: activeNotificationTab === 'pending-todo' }"
                @click="setNotificationTab('pending-todo')"
              >
                待接受待办
                <span>{{ pendingTodos.length }}</span>
              </button>
            </div>

            <template v-if="activeNotificationTab === 'sys-message'">
              <div class="notification-filter" aria-label="站内消息筛选">
                <button
                  type="button"
                  :class="{ active: sysMessageFilter === 'unread' }"
                  @click="setSysMessageFilter('unread')"
                >
                  未读
                </button>
                <button
                  type="button"
                  :class="{ active: sysMessageFilter === 'all' }"
                  @click="setSysMessageFilter('all')"
                >
                  全部
                </button>
              </div>

              <div class="notification-list" data-tour-target="notification-list">
                <AppStateBlock
                  v-if="sysMessageError"
                  class="notification-state"
                  type="error"
                  title="站内消息加载失败"
                  :description="sysMessageError"
                  action-label="重新加载"
                  size="sm"
                  variant="inline"
                  @action="refreshSysMessages()"
                />
                <AppStateBlock
                  v-else-if="isSysMessageLoading"
                  class="notification-state"
                  type="loading"
                  title="正在加载站内消息"
                  description="消息同步后会自动展示。"
                  size="sm"
                  variant="inline"
                />
                <AppStateBlock
                  v-else-if="!sysMessages.length"
                  class="notification-state"
                  type="empty"
                  :title="sysMessageFilter === 'unread' ? '暂无未读消息' : '暂无站内消息'"
                  description="新的待办、会议和系统通知会出现在这里。"
                  size="sm"
                  variant="inline"
                />

                <article
                  v-for="message in sysMessages"
                  :key="message.id"
                  class="notification-item"
                  :class="{ 'is-unread': message.msgStatus === 0 }"
                >
                  <span
                    class="notification-item__marker"
                    :class="message.bizType === 2 ? 'is-green' : 'is-blue'"
                    aria-hidden="true"
                  />
                  <div class="notification-item__content">
                    <div class="notification-item__title-row">
                      <strong>{{ message.msgSubject }}</strong>
                      <time>{{ formatSysMessageTime(message.createTime) }}</time>
                    </div>
                    <p>{{ getSysMessagePreview(message.msgContent) || '暂无消息内容' }}</p>
                    <div class="notification-item__meta-row">
                      <span>{{ getSysMessageBizLabel(message) }}</span>
                      <span>{{ getSysMessageStatusText(message) }}</span>
                    </div>

                    <div class="notification-item__actions">
                      <button
                        v-if="isSysMessageOpenable(message)"
                        type="button"
                        class="action-btn is-view has-icon"
                        :disabled="processingSysMessageId === message.id"
                        @click="handleOpenSysMessage(message)"
                      >
                        <IconExternalLink aria-hidden="true" />
                        <span>{{
                          processingSysMessageId === message.id ? '打开中…' : '查看'
                        }}</span>
                      </button>
                      <button
                        v-if="message.msgStatus === 0"
                        type="button"
                        class="action-btn is-accept has-icon"
                        :disabled="processingSysMessageId === message.id"
                        @click="handleMarkSysMessageRead(message)"
                      >
                        <IconCheckCheck aria-hidden="true" />
                        <span>已读</span>
                      </button>
                      <button
                        type="button"
                        class="action-btn is-reject has-icon"
                        :disabled="processingSysMessageId === message.id"
                        @click="handleDeleteSysMessage(message)"
                      >
                        <IconTrash2 aria-hidden="true" />
                        <span>删除</span>
                      </button>
                    </div>
                  </div>
                </article>

                <button
                  v-if="hasMoreSysMessages && !isSysMessageLoading"
                  type="button"
                  class="notification-load-more"
                  :disabled="isSysMessageLoadingMore"
                  @click="loadMoreSysMessages"
                >
                  {{ isSysMessageLoadingMore ? '加载中…' : '加载更多' }}
                </button>
              </div>
            </template>

            <template v-else>
              <div class="notification-list" data-tour-target="notification-list">
                <AppStateBlock
                  v-if="pendingError"
                  class="notification-state"
                  type="error"
                  title="待接受待办加载失败"
                  :description="pendingError"
                  action-label="重新加载"
                  size="sm"
                  variant="inline"
                  @action="refreshPendingTodos"
                />
                <AppStateBlock
                  v-else-if="isPendingLoading"
                  class="notification-state"
                  type="loading"
                  title="正在加载待接受待办"
                  description="别人派发给你的待办同步后会自动展示。"
                  size="sm"
                  variant="inline"
                />
                <AppStateBlock
                  v-else-if="!pendingTodos.length"
                  class="notification-state"
                  type="empty"
                  title="暂无待接受待办"
                  description="需要你确认的协作待办会出现在这里。"
                  size="sm"
                  variant="inline"
                />

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
                    <div class="notification-item__meta-row">
                      <span>待接受</span>
                    </div>

                    <div class="notification-item__actions">
                      <template v-if="isPendingConfirmOnly(todo)">
                        <button
                          type="button"
                          class="action-btn is-accept"
                          :disabled="processingId === todo.id"
                          @click="handleAcceptTodo(todo.id)"
                        >
                          {{ processingId === todo.id ? '处理中…' : '确认' }}
                        </button>
                      </template>
                      <template v-else>
                        <button
                          type="button"
                          class="action-btn is-accept"
                          :disabled="processingId === todo.id"
                          @click="handleAcceptTodo(todo.id)"
                        >
                          {{
                            processingId === todo.id && activeActionMode !== 'reject'
                              ? '处理中…'
                              : '接受'
                          }}
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
                          class="action-btn is-view"
                          @click="handleOpenTodo(todo)"
                        >
                          查看
                        </button>
                      </template>
                    </div>

                    <div
                      v-if="
                        !isPendingConfirmOnly(todo) &&
                        activeActionId === todo.id &&
                        activeActionMode === 'reject'
                      "
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
                        <button
                          type="button"
                          class="action-btn is-muted"
                          @click="resetPendingAction"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            </template>
          </section>
        </Transition>
      </div>
      <button
        class="icon-button"
        type="button"
        aria-label="打开新手引导"
        title="打开新手引导"
        @click="openOnboardingTour"
      >
        <IconSparkles />
      </button>
      <button class="icon-button" type="button" aria-label="设置">
        <IconSettings />
      </button>

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
                <span>同步调节 Topbar 与简约模式右下角模块</span>
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

.notification-wrap,
.user-menu-wrap,
.glass-controller-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
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
  --notification-arrow-center: 123px;
  position: absolute;
  top: calc(100% + 14px);
  right: -104px;
  width: min(420px, calc(100vw - 28px));
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

.notification-panel__arrow {
  position: absolute;
  top: -11px;
  right: calc(var(--notification-arrow-center) - 11px);
  width: 22px;
  height: 11px;
  overflow: hidden;
  pointer-events: none;
  z-index: 1;
}

.notification-panel__arrow::before {
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

.notification-panel__header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 8px;
  padding: 2px 2px 12px;
}

.notification-panel__header div {
  flex: 1 1 auto;
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

.notification-panel__header button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  transform: none;
}

.notification-panel__header button svg {
  width: 16px;
  height: 16px;
}

.notification-tabs,
.notification-filter {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
}

.notification-tabs {
  gap: 6px;
  margin-bottom: 10px;
  border-radius: 14px;
  background: rgba(241, 245, 249, 0.78);
  padding: 4px;
}

.notification-tabs button,
.notification-filter button {
  border: 0;
  font: inherit;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}

.notification-tabs button {
  min-width: 0;
  min-height: 34px;
  flex: 1 1 0;
  border-radius: 11px;
  background: transparent;
  color: #64748b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  line-height: 1;
  font-weight: 850;
}

.notification-tabs button.active {
  background: rgba(255, 255, 255, 0.94);
  color: #0f172a;
  box-shadow: 0 8px 16px -14px rgba(15, 23, 42, 0.48);
}

.notification-tabs button span {
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  background: rgba(226, 232, 240, 0.88);
  color: #475569;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 900;
}

.notification-tabs button.active span {
  background: rgba(219, 234, 254, 0.92);
  color: #1d4ed8;
}

.notification-filter {
  gap: 4px;
  margin: 0 0 10px;
}

.notification-filter button {
  min-height: 28px;
  border-radius: 999px;
  background: transparent;
  color: #64748b;
  padding: 0 10px;
  font-size: 12px;
  line-height: 1;
  font-weight: 850;
}

.notification-filter button.active {
  background: rgba(219, 234, 254, 0.88);
  color: #1d4ed8;
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
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: #475569;
  font-size: 12px;
  line-height: 1.55;
  font-weight: 700;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.notification-item__meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.notification-item__meta-row span {
  align-self: flex-start;
  border-radius: 999px;
  background: rgba(241, 245, 249, 0.92);
  color: #64748b;
  font-size: 11px;
  line-height: 1;
  font-weight: 850;
  padding: 6px 8px;
}

.notification-state {
  flex: 0 0 auto;
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

.action-btn.is-view,
.action-btn.is-muted {
  background: rgba(241, 245, 249, 0.92);
  color: #64748b;
}

.action-btn.has-icon {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.action-btn.has-icon svg {
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
}

.notification-load-more {
  min-height: 34px;
  border: 1px dashed rgba(203, 213, 225, 0.92);
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.72);
  color: #475569;
  font: inherit;
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
}

.notification-load-more:hover:not(:disabled) {
  border-color: rgba(147, 197, 253, 0.9);
  background: rgba(239, 246, 255, 0.82);
  color: #1d4ed8;
}

.notification-load-more:disabled {
  cursor: not-allowed;
  opacity: 0.58;
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
  border: 1px solid rgba(255, 255, 255, var(--glass-border-opacity, 0.64));
  border-radius: 20px;
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
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.72),
    0 20px 36px -30px rgba(18, 38, 72, 0.4);
  backdrop-filter: blur(var(--glass-blur, 24px)) saturate(var(--glass-saturate, 1.16));
  -webkit-backdrop-filter: blur(var(--glass-blur, 24px)) saturate(var(--glass-saturate, 1.16));
  justify-content: space-between;
  width: calc(100% - clamp(48px, 3.8vw, 76px));
  height: 60px;
  min-height: 60px;
  margin: 14px auto 0;
  padding: 0 24px;
  display: grid;
  grid-template-columns: minmax(270px, 0.78fr) minmax(560px, auto) minmax(270px, 0.78fr);
  align-items: center;
  gap: 18px;
}

.dashboard-topbar.without-tools {
  grid-template-columns: minmax(270px, 1fr) auto;
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
