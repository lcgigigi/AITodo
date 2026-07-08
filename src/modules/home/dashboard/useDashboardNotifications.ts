import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import {
  acceptTodos,
  loadAssignableUsers,
  loadPendingTodos,
  rejectTodo,
} from '@/modules/home/dashboard/todo.service'
import {
  buildInboxItems,
  countActionableInboxItems,
  filterInboxItems,
  findRelatedUnreadMessages,
  isInboxItemOpenable,
  type InboxFilter,
  type InboxItem,
} from '@/modules/home/dashboard/notification.inbox'
import {
  buildSysMessageWebSocketUrl,
  deleteSysMessages,
  loadSysMessages,
  markAllSysMessagesRead,
  markSysMessagesRead,
  normalizeSysMessagePush,
  type SysMessage,
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

  const inboxFilter = ref<InboxFilter>('actionable')
  const isInboxLoading = ref(false)
  const isInboxLoadingMore = ref(false)
  const inboxError = ref('')
  const sysMessages = ref<SysMessage[]>([])
  const sysMessageTotal = ref(0)
  const sysMessagePageNum = ref(1)
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
  let isNotificationCenterActive = true

  const currentUser = computed<CalendarUser>(() => ({
    id: userStore.profile?.id ?? '',
    name: userStore.profile?.name ?? '未登录',
    role: userStore.profile?.role ?? 'employee',
    department: userStore.profile?.department,
    avatar: userStore.profile?.avatar,
    leaderId: userStore.profile?.leaderId,
    teamMemberIds: userStore.profile?.teamMemberIds,
  }))

  const inboxItems = computed(() => buildInboxItems(pendingTodos.value, sysMessages.value))
  const filteredInboxItems = computed(() => filterInboxItems(inboxItems.value, inboxFilter.value))
  const actionableInboxCount = computed(() => countActionableInboxItems(inboxItems.value))
  const unreadNotificationCount = computed(() => actionableInboxCount.value)
  const hasMoreInboxMessages = computed(
    () => sysMessagePageNum.value * SYS_MESSAGE_PAGE_SIZE < sysMessageTotal.value,
  )
  const inboxTotalCount = computed(() => inboxItems.value.length)

  function resetSysMessageState() {
    sysMessages.value = []
    sysMessageTotal.value = 0
    sysMessagePageNum.value = 1
  }

  function formatInboxTime(value?: string) {
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

  async function refreshSysMessages(pageNum = 1, options?: { silent?: boolean }) {
    if (!currentUser.value.id) {
      resetSysMessageState()
      sysMessagesLoaded.value = false
      return
    }

    const isFirstPage = pageNum === 1
    const showLoading = isFirstPage && !options?.silent
    if (showLoading) {
      isInboxLoading.value = true
    } else if (!isFirstPage) {
      isInboxLoadingMore.value = true
    }
    inboxError.value = ''

    try {
      const result = await loadSysMessages({
        pageNum,
        pageSize: SYS_MESSAGE_PAGE_SIZE,
      })
      sysMessages.value = mergeSysMessages(isFirstPage ? [] : sysMessages.value, result.rows)
      sysMessageTotal.value = result.total
      sysMessagePageNum.value = result.pageNum
      if (isFirstPage) {
        sysMessagesLoaded.value = true
      }
    } catch (error) {
      if (isFirstPage) sysMessages.value = []
      const message = error instanceof Error ? error.message : '加载消息失败'
      inboxError.value = message
    } finally {
      if (showLoading) {
        isInboxLoading.value = false
      }
      isInboxLoadingMore.value = false
    }
  }

  async function loadMoreInboxMessages() {
    if (isInboxLoadingMore.value || !hasMoreInboxMessages.value) return
    await refreshSysMessages(sysMessagePageNum.value + 1)
  }

  function setInboxFilter(filter: InboxFilter) {
    inboxFilter.value = filter
  }

  function applySysMessageReadState(message: SysMessage) {
    if (message.msgStatus !== 0) return

    sysMessages.value = markSysMessageIdsReadInList(sysMessages.value, [message.rawId])
  }

  async function readSysMessage(message: SysMessage) {
    if (message.msgStatus !== 0) return

    await markSysMessagesRead([message.rawId])
    applySysMessageReadState(message)
  }

  async function markRelatedSysMessagesRead(todoId: string) {
    const related = findRelatedUnreadMessages(sysMessages.value, todoId)
    if (!related.length) return

    await markSysMessagesRead(related.map((message) => message.rawId))
    related.forEach((message) => applySysMessageReadState(message))
  }

  async function handleMarkInboxItemRead(item: InboxItem) {
    if (!item.message || item.message.msgStatus !== 0 || processingSysMessageId.value) return

    processingSysMessageId.value = item.message.id
    inboxError.value = ''

    try {
      await readSysMessage(item.message)
    } catch (error) {
      inboxError.value = error instanceof Error ? error.message : '标记消息已读失败'
    } finally {
      processingSysMessageId.value = ''
    }
  }

  async function handleMarkAllInboxRead() {
    if (actionableInboxCount.value === 0 || processingSysMessageId.value) return

    processingSysMessageId.value = 'all'
    inboxError.value = ''

    try {
      await markAllSysMessagesRead()
      sysMessages.value = markAllSysMessagesReadInList(sysMessages.value)
    } catch (error) {
      inboxError.value = error instanceof Error ? error.message : '全部标记已读失败'
    } finally {
      processingSysMessageId.value = ''
    }
  }

  async function handleDeleteInboxItem(item: InboxItem) {
    if (!item.message || processingSysMessageId.value) return

    processingSysMessageId.value = item.message.id
    inboxError.value = ''

    try {
      await deleteSysMessages([item.message.rawId])
      sysMessages.value = removeSysMessageIdsFromList(sysMessages.value, [item.message.rawId])
      sysMessageTotal.value = Math.max(0, sysMessageTotal.value - 1)
    } catch (error) {
      inboxError.value = error instanceof Error ? error.message : '删除消息失败'
    } finally {
      processingSysMessageId.value = ''
    }
  }

  async function handleOpenInboxItem(item: InboxItem) {
    if (!isInboxItemOpenable(item) || processingSysMessageId.value) return

    const todoId = item.todoId ?? item.todo?.id
    if (!todoId) return

    processingSysMessageId.value = item.id
    inboxError.value = ''

    try {
      if (item.message) {
        await readSysMessage(item.message)
      }
      options.onOpenTodo?.({
        id: todoId,
        date: item.todo?.date,
        source: item.kind === 'todo_pending' ? 'pending-inbox' : undefined,
      })
      options.onClose?.()
    } catch (error) {
      inboxError.value = error instanceof Error ? error.message : '打开关联待办失败'
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
    if (isSysMessageSocketStopped || !isNotificationCenterActive || !currentUser.value.id) return

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
    sysMessages.value = mergeSysMessages(sysMessages.value, [message], { prepend: true })

    if (!alreadyExists) {
      sysMessageTotal.value += 1
    }

    if (message.bizType === 1 && message.bizId) {
      void refreshPendingTodos({ silent: pendingTodosLoaded.value })
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
    if (!isNotificationCenterActive || !currentUser.value.id || typeof WebSocket === 'undefined') {
      return
    }

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
    inboxError.value = ''

    try {
      pendingTodos.value = await loadPendingTodos(currentUser.value, assignableUsers.value)
      pendingTodosLoaded.value = true
    } catch (error) {
      pendingTodos.value = []
      const message = error instanceof Error ? error.message : '加载待接受待办失败'
      pendingError.value = message
      inboxError.value = message
    } finally {
      if (showLoading) {
        isPendingLoading.value = false
      }
    }
  }

  async function refreshInbox(options?: { silent?: boolean }) {
    inboxError.value = ''
    const silent = options?.silent ?? (pendingTodosLoaded.value && sysMessagesLoaded.value)
    await Promise.all([
      refreshPendingTodos({ silent }),
      refreshSysMessages(1, { silent }),
    ])
  }

  function resetPendingAction() {
    activeActionId.value = ''
    activeActionMode.value = null
    rejectReason.value = ''
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
      await markRelatedSysMessagesRead(id)
      await refreshPendingTodos({ silent: pendingTodosLoaded.value })
      options.onCalendarRefresh?.()
    } catch (error) {
      inboxError.value = error instanceof Error ? error.message : '接受待办失败'
    } finally {
      processingId.value = ''
    }
  }

  async function handleRejectTodo(id: string) {
    processingId.value = id
    try {
      await rejectTodo(id, rejectReason.value.trim() || '暂不处理')
      resetPendingAction()
      await markRelatedSysMessagesRead(id)
      await refreshPendingTodos({ silent: pendingTodosLoaded.value })
      options.onCalendarRefresh?.()
    } catch (error) {
      inboxError.value = error instanceof Error ? error.message : '拒绝待办失败'
    } finally {
      processingId.value = ''
    }
  }

  async function initializeNotifications() {
    if (initializePromise) {
      return initializePromise
    }

    initializePromise = (async () => {
      await refreshAssignableUsers()
      await refreshInbox()
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
    void refreshInbox({ silent: true })
  }

  async function activateNotifications() {
    isNotificationCenterActive = true

    if (!currentUser.value.id) return

    if (!pendingTodosLoaded.value && !sysMessagesLoaded.value) {
      await initializeNotifications()
      return
    }

    connectSysMessageSocket()
  }

  function deactivateNotifications() {
    isNotificationCenterActive = false
    stopSysMessageSocket()
  }

  onMounted(() => {
    isNotificationCenterActive = true
    void initializeNotifications()
  })

  onActivated(() => {
    void activateNotifications()
  })

  watch(
    () => userStore.profile?.id,
    (nextId, previousId) => {
      if (nextId === previousId) return
      stopSysMessageSocket()
      resetSysMessageState()
      pendingTodosLoaded.value = false
      sysMessagesLoaded.value = false
      void refreshAssignableUsers().then(() => refreshInbox())
      if (nextId && isNotificationCenterActive) connectSysMessageSocket()
    },
  )

  onDeactivated(() => {
    deactivateNotifications()
  })

  onBeforeUnmount(() => {
    stopSysMessageSocket()
  })

  const isInboxListLoading = computed(() => isInboxLoading.value || isPendingLoading.value)

  return {
    inboxFilter,
    isInboxLoading,
    isInboxLoadingMore,
    isInboxListLoading,
    inboxError,
    filteredInboxItems,
    actionableInboxCount,
    inboxTotalCount,
    unreadNotificationCount,
    processingSysMessageId,
    pendingError,
    activeActionId,
    activeActionMode,
    rejectReason,
    processingId,
    hasMoreInboxMessages,
    formatInboxTime,
    isInboxItemOpenable,
    refreshInbox,
    loadMoreInboxMessages,
    setInboxFilter,
    handleMarkInboxItemRead,
    handleMarkAllInboxRead,
    handleDeleteInboxItem,
    handleOpenInboxItem,
    refreshPendingTodos,
    resetPendingAction,
    togglePendingAction,
    handleAcceptTodo,
    handleRejectTodo,
    initializeNotifications,
    refreshNotificationsOnOpen,
    stopSysMessageSocket,
  }
}
