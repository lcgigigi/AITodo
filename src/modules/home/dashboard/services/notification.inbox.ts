import type { SysMessage } from '@/modules/home/dashboard/services/sys-message.service'
import type { CalendarEvent, CalendarUser } from '@/modules/home/dashboard/config/types'

export type InboxFilter = 'actionable' | 'all'
export type InboxItemKind = 'todo_pending' | 'todo_notice' | 'meeting' | 'system'

export interface InboxDetailLine {
  label: string
  value: string
}

export interface InboxItem {
  id: string
  kind: InboxItemKind
  title: string
  summary: string
  details: InboxDetailLine[]
  createTime?: string
  isUnread: boolean
  isActionable: boolean
  statusLabel: string
  markerClass: 'is-amber' | 'is-blue' | 'is-green'
  todoId?: string
  todo?: CalendarEvent
  message?: SysMessage
}

function compareInboxItems(left: InboxItem, right: InboxItem) {
  const leftTime = left.createTime ? Date.parse(left.createTime.replace(' ', 'T')) : 0
  const rightTime = right.createTime ? Date.parse(right.createTime.replace(' ', 'T')) : 0
  if (leftTime !== rightTime) return rightTime - leftTime
  return left.id.localeCompare(right.id)
}

interface TodoMessagePayload {
  title?: string
  content?: string
  startDateShow?: string
  endDateShow?: string
  remark?: string
  creatorId?: string
  handlerId?: string
}

const INBOX_DETAIL_LABELS: Record<string, string> = {
  标题: '标题',
  开始时间: '开始时间',
  结束时间: '结束时间',
  处理人: '处理人',
  处理说明: '处理说明',
  创建人: '创建人',
  备注: '备注',
}

const EMPLOYEE_DETAIL_LABELS = new Set(['处理人', '创建人', '派发人'])

function createEmployeeNameResolver(users: CalendarUser[] = []) {
  const userMap = new Map(
    users.filter((user) => user.id).map((user) => [user.id, user.name?.trim() || user.id] as const),
  )

  return (label: string, value: string) => {
    if (!EMPLOYEE_DETAIL_LABELS.has(label)) return value

    return value
      .split(/[、,，]/)
      .map((token) => token.trim())
      .filter(Boolean)
      .map((token) => userMap.get(token) || token)
      .join('、')
  }
}

function resolveInboxDetails(
  details: InboxDetailLine[],
  resolveEmployeeName: ReturnType<typeof createEmployeeNameResolver>,
) {
  return details.map((detail) => ({
    ...detail,
    value: resolveEmployeeName(detail.label, detail.value),
  }))
}

function formatInboxDateTime(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return trimmed

  const pad = (item: number) => String(item).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function tryParseTodoMessagePayload(content: string): TodoMessagePayload | null {
  const trimmed = content.trim()
  if (!trimmed.startsWith('{')) return null

  try {
    const parsed = JSON.parse(trimmed) as TodoMessagePayload
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function parseKeyValueLines(content: string) {
  const details: InboxDetailLine[] = []
  let headline = ''

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    const separatorIndex = line.search(/[:：]/)
    if (separatorIndex <= 0) {
      if (!headline) headline = line
      continue
    }

    const rawLabel = line.slice(0, separatorIndex).trim()
    const rawValue = line.slice(separatorIndex + 1).trim()
    if (!rawValue) continue

    const label = INBOX_DETAIL_LABELS[rawLabel] ?? rawLabel
    const value =
      label === '开始时间' || label === '结束时间' ? formatInboxDateTime(rawValue) : rawValue

    details.push({ label, value })
  }

  return { headline, details }
}

function buildTodoPayloadDetails(payload: TodoMessagePayload) {
  const details: InboxDetailLine[] = []

  if (payload.startDateShow) {
    details.push({ label: '时间', value: formatInboxDateTime(payload.startDateShow) })
  } else if (payload.endDateShow) {
    details.push({ label: '截止', value: formatInboxDateTime(payload.endDateShow) })
  }

  if (payload.remark?.trim()) {
    details.push({ label: '备注', value: payload.remark.trim() })
  }

  return details
}

function normalizeInboxText(value: string) {
  return value
    .toLowerCase()
    .replace(/[，。,.!！?？:：;；\s]/g, '')
    .replace(/^你的/, '')
    .replace(/请前往处理$/, '')
    .replace(/请尽快处理$/, '')
}

function isRedundantInboxSummary(title: string, summary: string) {
  const normalizedTitle = normalizeInboxText(title)
  const normalizedSummary = normalizeInboxText(summary)

  if (!normalizedSummary) return true
  if (!normalizedTitle) return false

  return (
    normalizedSummary === normalizedTitle ||
    normalizedSummary.includes(normalizedTitle) ||
    normalizedTitle.includes(normalizedSummary)
  )
}

function dedupeInboxPresentation(title: string, summary: string, details: InboxDetailLine[]) {
  const normalizedTitle = title.trim()
  const normalizedSummary = summary.trim()
  const seen = new Set(
    [normalizedTitle, normalizedSummary].filter(Boolean).map((value) => value.toLowerCase()),
  )

  const filteredDetails = details.filter((detail) => {
    const normalizedValue = detail.value.trim().toLowerCase()
    if (!normalizedValue || seen.has(normalizedValue)) return false
    seen.add(normalizedValue)
    return true
  })

  const shouldDropSummary =
    isRedundantInboxSummary(normalizedTitle, normalizedSummary) ||
    filteredDetails.some(
      (detail) => detail.value.trim().toLowerCase() === normalizedSummary.toLowerCase(),
    )

  return {
    title: normalizedTitle,
    summary: shouldDropSummary ? '' : normalizedSummary,
    details: filteredDetails,
  }
}

function resolvePendingTitle(event: CalendarEvent) {
  return event.content?.trim() || event.title?.trim() || event.remark?.trim() || '新待办'
}

function buildPendingDetails(event: CalendarEvent, title: string) {
  const details: InboxDetailLine[] = []

  if (event.creatorName) {
    details.push({ label: '派发人', value: event.creatorName })
  }

  const schedule =
    event.startDateShow || (event.date ? `${event.date}${event.time ? ` ${event.time}` : ''}` : '')
  if (schedule) {
    details.push({ label: '时间', value: formatInboxDateTime(schedule) || schedule })
  }

  const content = event.content?.trim()
  if (content && content !== title) {
    details.push({ label: '内容', value: content })
  }

  return details
}

function buildMessageContent(message: SysMessage) {
  const content = message.msgContent.trim()
  if (!content) {
    return {
      summary: '',
      details: [] as InboxDetailLine[],
    }
  }

  const todoPayload = tryParseTodoMessagePayload(content)
  if (todoPayload) {
    const summary = todoPayload.content?.trim() || todoPayload.title?.trim() || ''
    return {
      summary,
      details: buildTodoPayloadDetails(todoPayload),
    }
  }

  const { headline, details } = parseKeyValueLines(content)
  return {
    summary: headline,
    details,
  }
}

function resolveMessageKind(message: SysMessage): InboxItemKind {
  if (message.bizType === 2) return 'meeting'
  if (message.bizType === 1) return 'todo_notice'
  return 'system'
}

function resolveMessageStatusLabel(message: SysMessage) {
  if (message.bizType === 1) return '智能待办'
  if (message.bizType === 2) return '会议'
  return message.msgType === 1 ? '系统消息' : '消息'
}

function resolveMessageMarkerClass(kind: InboxItemKind): InboxItem['markerClass'] {
  if (kind === 'meeting') return 'is-green'
  return 'is-blue'
}

function buildPendingInboxItem(
  todo: CalendarEvent,
  resolveEmployeeName: ReturnType<typeof createEmployeeNameResolver>,
): InboxItem {
  const title = resolvePendingTitle(todo)
  const presentation = dedupeInboxPresentation(
    title,
    '',
    resolveInboxDetails(buildPendingDetails(todo, title), resolveEmployeeName),
  )

  return {
    id: `pending:${todo.id}`,
    kind: 'todo_pending',
    title: presentation.title,
    summary: presentation.summary,
    details: presentation.details,
    createTime: todo.startDateShow || `${todo.date}${todo.time ? ` ${todo.time}` : ''}`,
    isUnread: true,
    isActionable: true,
    statusLabel: '待接受',
    markerClass: 'is-amber',
    todoId: todo.id,
    todo,
  }
}

function buildMessageInboxItem(
  message: SysMessage,
  resolveEmployeeName: ReturnType<typeof createEmployeeNameResolver>,
): InboxItem {
  const kind = resolveMessageKind(message)
  const isUnread = message.msgStatus === 0
  const { summary, details } = buildMessageContent(message)
  const presentation = dedupeInboxPresentation(
    message.msgSubject,
    summary,
    resolveInboxDetails(details, resolveEmployeeName),
  )

  return {
    id: `message:${message.id}`,
    kind,
    title: presentation.title,
    summary: presentation.summary,
    details: presentation.details,
    createTime: message.createTime,
    isUnread,
    isActionable: isUnread,
    statusLabel: resolveMessageStatusLabel(message),
    markerClass: resolveMessageMarkerClass(kind),
    todoId: message.bizId,
    message,
  }
}

export function buildInboxItems(
  pendingTodos: CalendarEvent[],
  sysMessages: SysMessage[],
  users: CalendarUser[] = [],
): InboxItem[] {
  const resolveEmployeeName = createEmployeeNameResolver(users)
  const pendingIds = new Set(pendingTodos.map((todo) => todo.id))
  const pendingItems = pendingTodos.map((todo) => buildPendingInboxItem(todo, resolveEmployeeName))
  const messageItems = sysMessages
    .filter((message) => {
      if (!message.bizId) return true
      if (message.bizType !== 1 && message.bizType !== 2) return true
      return !pendingIds.has(message.bizId)
    })
    .map((message) => buildMessageInboxItem(message, resolveEmployeeName))

  return [...pendingItems, ...messageItems].sort(compareInboxItems)
}

export function filterInboxItems(items: InboxItem[], filter: InboxFilter) {
  if (filter === 'all') return items
  return items.filter((item) => item.isActionable)
}

export function countActionableInboxItems(items: InboxItem[]) {
  return items.filter((item) => item.isActionable).length
}

export function isInboxItemOpenable(item: InboxItem) {
  if (item.kind === 'todo_pending') return true
  if (!item.message?.bizId) return false
  return item.kind === 'todo_notice' || item.kind === 'meeting'
}

export function findRelatedUnreadMessages(messages: SysMessage[], todoId: string) {
  return messages.filter((message) => message.bizId === todoId && message.msgStatus === 0)
}
