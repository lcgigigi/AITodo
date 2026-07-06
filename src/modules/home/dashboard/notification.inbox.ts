import type { SysMessage } from '@/modules/home/dashboard/sys-message.service'
import type { CalendarEvent } from '@/modules/home/dashboard/types'

export type InboxFilter = 'actionable' | 'all'
export type InboxItemKind = 'todo_pending' | 'todo_notice' | 'meeting' | 'system'

export interface InboxItem {
  id: string
  kind: InboxItemKind
  title: string
  summary: string
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

function buildPendingSummary(event: CalendarEvent) {
  return event.creatorName ? `${event.creatorName} 派发` : '待接受待办'
}

function buildMessagePreview(content: string) {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' · ')
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

function buildPendingInboxItem(todo: CalendarEvent): InboxItem {
  return {
    id: `pending:${todo.id}`,
    kind: 'todo_pending',
    title: todo.title,
    summary: buildPendingSummary(todo),
    createTime: todo.startDateShow || `${todo.date}${todo.time ? ` ${todo.time}` : ''}`,
    isUnread: true,
    isActionable: true,
    statusLabel: '待接受',
    markerClass: 'is-amber',
    todoId: todo.id,
    todo,
  }
}

function buildMessageInboxItem(message: SysMessage): InboxItem {
  const kind = resolveMessageKind(message)
  const isUnread = message.msgStatus === 0

  return {
    id: `message:${message.id}`,
    kind,
    title: message.msgSubject,
    summary: buildMessagePreview(message.msgContent) || '暂无消息内容',
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
): InboxItem[] {
  const pendingIds = new Set(pendingTodos.map((todo) => todo.id))
  const pendingItems = pendingTodos.map(buildPendingInboxItem)
  const messageItems = sysMessages
    .filter((message) => {
      if (!message.bizId) return true
      if (message.bizType !== 1 && message.bizType !== 2) return true
      return !pendingIds.has(message.bizId)
    })
    .map(buildMessageInboxItem)

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
