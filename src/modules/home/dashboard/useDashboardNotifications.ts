import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  acceptTodos,
  loadAssignableUsers,
  loadPendingTodos,
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
import type { CalendarEvent, CalendarUser } from '@/modules/home/dashboard/types'
import { useFeedbackStore } from '@/stores/feedback.store'
import { useUserStore } from '@/stores/user.store'

export type NotificationTab = 'sys-message' | 'pending-todo'
type PendingActionMode = 'reject' | null

const SYS_MESSAGE_PAGE_SIZE = 10

type DashboardNotificationOptions = {
  onCalendarRefresh?: () => void
  onOpenTodo?: (payload: { id: string; date?: string; source?: 'pending-inbox' }) => void
  onClose?: () => void
}

export function useDashboardNotifications(options: DashboardNotificationOptions = {}) {
  const userStore = useUserStore()
  const feedbackStore = useFeedbackStore()

  const activeNotificationTab = ref<NotificationTab>('pending-todo')
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
  const pendingTodosLoaded = ref(false)
  const sysMessagesLoaded = ref(false)

  let initializePromise: Promise<void> | null = null
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

  async function refreshSysMessages(pageNum = 1, options?: { silent?: boolean }) {
    if (!currentUser.value.id) {
      resetSysMessageState()
      sysMessagesLoaded.value = false
      return
    }

    const isFirstPage = pageNum === 1
    const showLoading = isFirstPage && !options?.silent
    if (showLoading) {
      isSysMessageLoading.value = true
    } else if (!isFirstPage) {
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
      if (isFirstPage) {
        sysMessagesLoaded.value = true
      }

      if (sysMessageFilter.value === 'unread') {
        unreadSysMessageCount.value = result.total
      } else {
        void refreshUnreadSysMessageCount()
      }
    } catch (error) {
      if (isFirstPage) sysMessages.value = []
      sysMessageError.value = error instanceof Error ? error.message : '加载站内消息失败'
    } finally {
      if (showLoading) {
        isSysMessageLoading.value = false
      }
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
      void refreshSysMessages(1, { silent: sysMessagesLoaded.value })
      return
    }

    void refreshPendingTodos({ silent: pendingTodosLoaded.value })
  }

  function setSysMessageFilter(filter: SysMessageFilter) {
    if (sysMessageFilter.value === filter) return

    sysMessageFilter.value = filter
    void refreshSysMessages(1, { silent: sysMessagesLoaded.value })
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
      options.onOpenTodo?.({ id: message.bizId ?? '' })
      options.onClose?.()
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

  async function refreshPendingTodos(options?: { silent?: boolean }) {
    if (!currentUser.value.id) {
      pendingTodos.value = []
      pendingTodosLoaded.value = false
      return
    }

    const showLoading = !options?.silent
    if (showLoading) {
      isPendingLoading.value = true
    }
    pendingError.value = ''

    try {
      pendingTodos.value = await loadPendingTodos(currentUser.value, assignableUsers.value)
      pendingTodosLoaded.value = true
    } catch (error) {
      pendingTodos.value = []
      pendingError.value = error instanceof Error ? error.message : '加载待接受待办失败'
    } finally {
      if (showLoading) {
        isPendingLoading.value = false
      }
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
      await refreshPendingTodos({ silent: pendingTodosLoaded.value })
      options.onCalendarRefresh?.()
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
      await refreshPendingTodos({ silent: pendingTodosLoaded.value })
      options.onCalendarRefresh?.()
    } catch (error) {
      pendingError.value = error instanceof Error ? error.message : '拒绝待办失败'
    } finally {
      processingId.value = ''
    }
  }

  function handleOpenTodo(event: CalendarEvent) {
    options.onOpenTodo?.({ id: event.id, date: event.date, source: 'pending-inbox' })
    options.onClose?.()
  }

  async function initializeNotifications() {
    if (initializePromise) {
      return initializePromise
    }

    initializePromise = (async () => {
      await refreshAssignableUsers()
      await Promise.all([refreshSysMessages(), refreshPendingTodos()])
      connectSysMessageSocket()
    })()

    try {
      await initializePromise
    } finally {
      initializePromise = null
    }
  }

  async function refreshNotificationsOnOpen() {
    if (!pendingTodosLoaded.value && !sysMessagesLoaded.value) {
      await initializeNotifications()
      return
    }

    await refreshAssignableUsers()
    void refreshSysMessages(1, { silent: sysMessagesLoaded.value })
    void refreshPendingTodos({ silent: pendingTodosLoaded.value })
  }

  onMounted(() => {
    void initializeNotifications()
  })

  watch(
    () => userStore.profile?.id,
    (nextId, previousId) => {
      if (nextId === previousId) return
      stopSysMessageSocket()
      resetSysMessageState()
      pendingTodosLoaded.value = false
      sysMessagesLoaded.value = false
      void refreshAssignableUsers().then(() => refreshPendingTodos())
      void refreshSysMessages()
      if (nextId) connectSysMessageSocket()
    },
  )

  onBeforeUnmount(() => {
    stopSysMessageSocket()
  })

  return {
    activeNotificationTab,
    sysMessageFilter,
    isSysMessageLoading,
    isSysMessageLoadingMore,
    sysMessageError,
    sysMessages,
    unreadSysMessageCount,
    unreadNotificationCount,
    processingSysMessageId,
    isPendingLoading,
    pendingError,
    pendingTodos,
    activeActionId,
    activeActionMode,
    rejectReason,
    processingId,
    hasMoreSysMessages,
    sysMessageSummary,
    isPendingConfirmOnly,
    getSysMessageStatusText,
    getSysMessageBizLabel,
    isSysMessageOpenable,
    formatSysMessageTime,
    getSysMessagePreview,
    refreshSysMessages,
    loadMoreSysMessages,
    setNotificationTab,
    setSysMessageFilter,
    handleMarkSysMessageRead,
    handleMarkAllSysMessagesRead,
    handleDeleteSysMessage,
    handleOpenSysMessage,
    refreshPendingTodos,
    resetPendingAction,
    pendingSummary,
    togglePendingAction,
    handleAcceptTodo,
    handleRejectTodo,
    handleOpenTodo,
    initializeNotifications,
    refreshNotificationsOnOpen,
    stopSysMessageSocket,
  }
}
