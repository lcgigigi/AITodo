import type { CalendarEvent, CalendarUser } from './types'
import {
  formatTodoDetailTimeField,
  getBackendTodoStatusLabel,
  getRejectedTodoMessage,
  getSmartTodoKindLabel,
  getTodoAssigneeDisplayName,
  getTodoContentDisplay,
  getTodoCreatorDisplayName,
  getTodoHandlerDisplayName,
  isCompletedTodoEvent,
  isRejectedTodo,
  shouldShowTodoAssignerField,
} from './todoDisplay'

export type DetailStatusTone = 'accepted' | 'done' | 'rejected' | 'pending' | 'waiting'

export type AssigneeProgressItem = {
  id: string
  name: string
  statusLabel: string
  statusTone: DetailStatusTone
  note?: string
}

export type TodoDetailPanelViewModel = {
  title: string
  typeLabel: string
  typeTone: 'meeting' | 'todo'
  statusLabel: string
  statusTone: DetailStatusTone
  time: string | string[]
  content: string
  meta: Array<{ key: string; label: string; value: string }>
  assigneeProgress?: AssigneeProgressItem[]
}

export function getTaskTypeLabel(event: CalendarEvent) {
  if (event.type === 'meeting') return '会议'
  if (event.type === 'approval') return '审批'
  if (event.type === 'ai') return 'AI'
  return '待办'
}

export function isPendingAcceptanceTask(task: CalendarEvent, currentUser: CalendarUser) {
  if (task.backendStatus === 3 || task.backendStatus === 6 || task.backendStatus === 9) {
    return false
  }

  if (task.scope === 'assigned_to_me') return true

  const assigneeIds =
    task.assigneeId
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean) ?? []

  return Boolean(
    currentUser.id &&
      assigneeIds.includes(currentUser.id) &&
      task.creatorId &&
      task.creatorId !== currentUser.id,
  )
}

export function getDetailStatusTone(
  event: CalendarEvent,
  currentUser: CalendarUser,
): DetailStatusTone {
  if (isPendingAcceptanceTask(event, currentUser)) return 'pending'

  const label = getBackendTodoStatusLabel(event)
  if (label === '已完成') return 'done'
  if (label === '已拒绝') return 'rejected'
  if (label === '已接受') return 'accepted'
  return 'waiting'
}

export function canEditTodoEvent(event: CalendarEvent) {
  return Boolean(event.editable) && event.status !== 'done'
}

function isCurrentUserTodoParticipant(event: CalendarEvent, currentUser: CalendarUser) {
  if (!currentUser.id) return false
  if (event.creatorId && event.creatorId === currentUser.id) return true

  const assigneeIds =
    event.assigneeId
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean) ?? []

  return assigneeIds.includes(currentUser.id)
}

export function canDeleteTodoEvent(event: CalendarEvent, currentUser: CalendarUser) {
  if (isPendingAcceptanceTask(event, currentUser)) return false
  if (event.editable) return true
  if (isRejectedTodo(event) && isCurrentUserTodoParticipant(event, currentUser)) return true
  if (isCompletedTodoEvent(event) && isCurrentUserTodoParticipant(event, currentUser)) return true
  return false
}

export function getAssigneeProgressStatusLabel(event: CalendarEvent) {
  if (isRejectedTodo(event)) return '已拒绝'
  if (isCompletedTodoEvent(event)) return '已完成'
  if (event.backendStatus === 3) return '已接受'
  if (event.receiveStatus === 2) return '待接受'
  return getBackendTodoStatusLabel(event)
}

export function getAssigneeProgressStatusTone(event: CalendarEvent): DetailStatusTone {
  const label = getAssigneeProgressStatusLabel(event)
  if (label === '已完成') return 'done'
  if (label === '已拒绝') return 'rejected'
  if (label === '已接受') return 'accepted'
  if (label === '待接受') return 'pending'
  return 'waiting'
}

export function getAssigneeProgressDisplayName(event: CalendarEvent) {
  const handlerName = getTodoHandlerDisplayName(event)
  if (handlerName !== '未指定') return handlerName

  const assigneeName = getTodoAssigneeDisplayName(event)
  return assigneeName !== '未指定' ? assigneeName : handlerName
}

export function buildDispatchProgressSummary(childTodos: CalendarEvent[]): {
  label: string
  tone: DetailStatusTone
} {
  const total = childTodos.length
  const doneCount = childTodos.filter(isCompletedTodoEvent).length
  const rejectedCount = childTodos.filter(isRejectedTodo).length
  const pendingAcceptCount = childTodos.filter(
    (child) => getAssigneeProgressStatusLabel(child) === '待接受',
  ).length

  if (doneCount === total) {
    return { label: '已完成', tone: 'done' }
  }
  if (rejectedCount === total) {
    return { label: '已拒绝', tone: 'rejected' }
  }
  if (pendingAcceptCount === total) {
    return { label: '待接受', tone: 'pending' }
  }
  if (doneCount > 0) {
    return { label: `${doneCount}/${total} 已完成`, tone: 'accepted' }
  }
  if (rejectedCount > 0) {
    return { label: `${rejectedCount}/${total} 已拒绝`, tone: 'rejected' }
  }
  return { label: '进行中', tone: 'waiting' }
}

export function mergeCalendarEventWithDetail(
  listEvent: CalendarEvent,
  detail?: CalendarEvent | null,
): CalendarEvent {
  if (!detail) return listEvent

  return {
    ...detail,
    ...listEvent,
    childTodos: detail.childTodos,
  }
}

export function storeCalendarEventDetail(
  cache: Record<string, CalendarEvent>,
  detail: CalendarEvent,
  requestId?: string,
) {
  const next = {
    ...cache,
    [detail.id]: detail,
  }

  if (requestId && requestId !== detail.id) {
    next[requestId] = detail
  }

  return next
}

export function resolveCalendarEventDetail(
  cache: Record<string, CalendarEvent>,
  task: CalendarEvent,
) {
  return cache[task.id] ?? task
}

function getAssigneeProgressSortRank(event: CalendarEvent) {
  const label = getAssigneeProgressStatusLabel(event)
  if (label === '待接受') return 0
  if (label === '待处理') return 1
  if (label === '已接受') return 2
  if (label === '已完成') return 3
  if (label === '已拒绝') return 4
  return 5
}

function compareAssigneeProgressItems(left: CalendarEvent, right: CalendarEvent) {
  const rankCompare = getAssigneeProgressSortRank(left) - getAssigneeProgressSortRank(right)
  if (rankCompare !== 0) return rankCompare

  const nameCompare = getAssigneeProgressDisplayName(left).localeCompare(
    getAssigneeProgressDisplayName(right),
    'zh-CN',
  )
  if (nameCompare !== 0) return nameCompare

  return left.id.localeCompare(right.id)
}

export function buildAssigneeProgressItems(childTodos: CalendarEvent[]): AssigneeProgressItem[] {
  return [...childTodos].sort(compareAssigneeProgressItems).map((child) => {
    const note = getRejectedTodoMessage(child)
    return {
      id: child.id,
      name: getAssigneeProgressDisplayName(child),
      statusLabel: getAssigneeProgressStatusLabel(child),
      statusTone: getAssigneeProgressStatusTone(child),
      note: note || undefined,
    }
  })
}

function shouldShowAssigneeProgress(task: CalendarEvent, currentUser: CalendarUser) {
  return Boolean(currentUser.id && task.creatorId === currentUser.id && task.childTodos?.length)
}

export function buildTodoDetailPanelViewModel(
  task: CalendarEvent,
  currentUser: CalendarUser,
): TodoDetailPanelViewModel {
  const showAssigneeProgress = shouldShowAssigneeProgress(task, currentUser)
  const meta: TodoDetailPanelViewModel['meta'] = [
    {
      key: 'type',
      label: '类型',
      value: getSmartTodoKindLabel(task),
    },
  ]

  if (shouldShowTodoAssignerField(task)) {
    meta.push({
      key: 'assigner',
      label: '指派人',
      value: getTodoCreatorDisplayName(task),
    })
  }

  if (!showAssigneeProgress) {
    meta.push({
      key: 'receiver',
      label: '接受人',
      value: getTodoAssigneeDisplayName(task),
    })
  }

  const progressSummary = showAssigneeProgress
    ? buildDispatchProgressSummary(task.childTodos ?? [])
    : null

  return {
    title: task.title || '未命名待办',
    typeLabel: getTaskTypeLabel(task),
    typeTone: task.type === 'meeting' ? 'meeting' : 'todo',
    statusLabel: progressSummary?.label ?? getBackendTodoStatusLabel(task),
    statusTone: progressSummary?.tone ?? getDetailStatusTone(task, currentUser),
    time: formatTodoDetailTimeField(task),
    content: getTodoContentDisplay(task),
    meta,
    assigneeProgress: showAssigneeProgress
      ? buildAssigneeProgressItems(task.childTodos ?? [])
      : undefined,
  }
}
