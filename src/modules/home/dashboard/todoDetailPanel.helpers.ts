import type { CalendarEvent, CalendarUser } from './types'
import {
  formatTodoDetailTimeField,
  getBackendTodoStatusLabel,
  getSmartTodoKindLabel,
  getTodoAssigneeDisplayName,
  getTodoContentDisplay,
  getTodoCreatorDisplayName,
  isCompletedTodoEvent,
  isRejectedTodo,
  shouldShowTodoAssignerField,
} from './todoDisplay'

export type DetailStatusTone = 'accepted' | 'done' | 'rejected' | 'pending' | 'waiting'

export type TodoDetailPanelViewModel = {
  title: string
  typeLabel: string
  typeTone: 'meeting' | 'todo'
  statusLabel: string
  statusTone: DetailStatusTone
  time: string | string[]
  content: string
  meta: Array<{ key: string; label: string; value: string }>
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

export function getDetailStatusTone(event: CalendarEvent, currentUser: CalendarUser): DetailStatusTone {
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
  if (Boolean(event.editable)) return true
  if (isRejectedTodo(event) && isCurrentUserTodoParticipant(event, currentUser)) return true
  if (isCompletedTodoEvent(event) && isCurrentUserTodoParticipant(event, currentUser)) return true
  return false
}

export function buildTodoDetailPanelViewModel(
  task: CalendarEvent,
  currentUser: CalendarUser,
): TodoDetailPanelViewModel {
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

  meta.push({
    key: 'receiver',
    label: '接受人',
    value: getTodoAssigneeDisplayName(task),
  })

  return {
    title: task.title || '未命名待办',
    typeLabel: getTaskTypeLabel(task),
    typeTone: task.type === 'meeting' ? 'meeting' : 'todo',
    statusLabel: getBackendTodoStatusLabel(task),
    statusTone: getDetailStatusTone(task, currentUser),
    time: formatTodoDetailTimeField(task),
    content: getTodoContentDisplay(task),
    meta,
  }
}
