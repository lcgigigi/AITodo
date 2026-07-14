import type { CalendarEvent, CalendarUser, TodoProcess } from '../config/types'
import {
  formatTodoDetailTimeField,
  getBackendTodoStatusLabel,
  getRejectedTodoMessage,
  getSmartTodoKindLabel,
  getTodoAssigneeDisplayName,
  getTodoContentDisplay,
  getTodoRemarkDisplay,
  getTodoCreatorDisplayName,
  hasTodoRemark,
  isCompletedTodoEvent,
  isRejectedTodo,
  shouldShowTodoAssignerField,
} from './todoDisplay'

export type DetailStatusTone = 'accepted' | 'done' | 'rejected' | 'pending' | 'waiting'

export type AssigneeProcessHistoryItem = {
  processId: string
  todoProcess: string
  createTime: string
}

export type AssigneeProgressItem = {
  id: string
  name: string
  statusLabel: string
  statusTone: DetailStatusTone
  note?: string
  lastProcess?: string
  processHistory?: AssigneeProcessHistoryItem[]
}

export type TodoProcessPanelItem = {
  processId: string
  todoProcess: string
  creatorId: string
  creatorName: string
  createTime: string
  updateTime: string
  editable: boolean
}

export type TodoProcessSection = {
  targetTodoId: string
  canAdd: boolean
  maxLength: number
  items: TodoProcessPanelItem[]
}

export type TodoDetailPanelViewModel = {
  title: string
  content: string
  contentIsEmpty: boolean
  typeLabel: string
  typeTone: 'meeting' | 'todo'
  statusLabel: string
  statusTone: DetailStatusTone
  time: string | string[]
  remark: string
  remarkIsEmpty: boolean
  meta: Array<{ key: string; label: string; value: string }>
  assigneeProgress?: AssigneeProgressItem[]
  processSection?: TodoProcessSection
}

export function getTaskTypeLabel(event: CalendarEvent) {
  if (event.type === 'meeting') return '会议'
  if (event.type === 'approval') return '审批'
  if (event.type === 'ai') return 'AI'
  return '待办'
}

export function isPendingAcceptanceTask(task: CalendarEvent, currentUser: CalendarUser) {
  if (!currentUser.id) return false

  if (
    task.backendStatus === 3 ||
    task.backendStatus === 6 ||
    task.backendStatus === 9 ||
    task.backendStatus === 99
  ) {
    return false
  }

  if (isRejectedTodo(task) || isCompletedTodoEvent(task)) return false
  if (task.receiveStatus !== 2) return false

  const assigneeIds =
    task.assigneeId
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean) ?? []

  return assigneeIds.includes(currentUser.id)
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

export const TODO_PROCESS_MAX_LENGTH = 200

function formatProcessTime(value?: string) {
  if (!value?.trim()) return ''
  return value.trim().replace('T', ' ').slice(0, 16)
}

function resolveProcessCreatorName(
  creatorId: string,
  users: CalendarUser[],
  currentUser: CalendarUser,
) {
  if (creatorId === currentUser.id) return currentUser.name || creatorId
  return users.find((user) => user.id === creatorId)?.name || creatorId
}

export function resolveProgressTargetTodo(
  task: CalendarEvent,
  currentUser: CalendarUser,
): CalendarEvent | null {
  if (!currentUser.id) return null

  if (task.childTodos?.length) {
    const childMatch = task.childTodos.find(
      (child) => child.currentHandlerId === currentUser.id,
    )
    if (childMatch) return childMatch
  }

  if (task.currentHandlerId === currentUser.id) {
    return task
  }

  return null
}

export function canAddTodoProcess(task: CalendarEvent, currentUser: CalendarUser) {
  const target = resolveProgressTargetTodo(task, currentUser)
  return Boolean(target && target.backendStatus === 3)
}

function canEditTodoProcess(process: TodoProcess, currentUser: CalendarUser) {
  return Boolean(currentUser.id && process.creatorId === currentUser.id)
}

function shouldShowProcessSection(task: CalendarEvent, currentUser: CalendarUser) {
  if (task.childTodos?.length && task.creatorId === currentUser.id) return false

  const target = resolveProgressTargetTodo(task, currentUser)
  if (!target) return false

  return canAddTodoProcess(task, currentUser) || Boolean(target.processList?.length)
}

function buildTodoProcessPanelItems(
  task: CalendarEvent,
  currentUser: CalendarUser,
  users: CalendarUser[] = [],
): TodoProcessPanelItem[] {
  const target = resolveProgressTargetTodo(task, currentUser)
  if (!target?.processList?.length) return []

  return [...target.processList]
    .sort((left, right) => right.createTime.localeCompare(left.createTime))
    .map((item) => ({
      processId: item.processId,
      todoProcess: item.todoProcess,
      creatorId: item.creatorId,
      creatorName: resolveProcessCreatorName(item.creatorId, users, currentUser),
      createTime: formatProcessTime(item.createTime),
      updateTime: formatProcessTime(item.updateTime),
      editable: canEditTodoProcess(item, currentUser),
    }))
}

function buildTodoProcessSection(
  task: CalendarEvent,
  currentUser: CalendarUser,
  users: CalendarUser[] = [],
): TodoProcessSection | undefined {
  if (!shouldShowProcessSection(task, currentUser)) return undefined

  const target = resolveProgressTargetTodo(task, currentUser)
  if (!target) return undefined

  return {
    targetTodoId: target.id,
    canAdd: canAddTodoProcess(task, currentUser),
    maxLength: TODO_PROCESS_MAX_LENGTH,
    items: buildTodoProcessPanelItems(task, currentUser, users),
  }
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
  return getTodoAssigneeDisplayName(event)
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

function mergeChildTodosWithDetail(
  listChildTodos: CalendarEvent[] | undefined,
  detailChildTodos: CalendarEvent[] | undefined,
) {
  if (!detailChildTodos?.length) return listChildTodos
  if (!listChildTodos?.length) return detailChildTodos

  const listChildMap = new Map(listChildTodos.map((child) => [child.id, child]))

  return detailChildTodos.map((detailChild) => {
    const listChild = listChildMap.get(detailChild.id)
    if (!listChild) return detailChild

    return {
      ...detailChild,
      ...listChild,
      processList: detailChild.processList,
      lastProcess: detailChild.lastProcess,
    }
  })
}

export function mergeCalendarEventWithDetail(
  listEvent: CalendarEvent,
  detail?: CalendarEvent | null,
): CalendarEvent {
  if (!detail) return listEvent

  return {
    ...detail,
    ...listEvent,
    childTodos: mergeChildTodosWithDetail(listEvent.childTodos, detail.childTodos) ?? detail.childTodos,
    processList: detail.processList,
    lastProcess: detail.lastProcess,
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

function buildAssigneeProcessHistory(child: CalendarEvent): AssigneeProcessHistoryItem[] {
  return [...(child.processList ?? [])]
    .sort((left, right) => left.createTime.localeCompare(right.createTime))
    .map((item) => ({
      processId: item.processId,
      todoProcess: item.todoProcess,
      createTime: formatProcessTime(item.createTime),
    }))
}

export function buildAssigneeProgressItems(childTodos: CalendarEvent[]): AssigneeProgressItem[] {
  return [...childTodos].sort(compareAssigneeProgressItems).map((child) => {
    const note = getRejectedTodoMessage(child)
    const processHistory = buildAssigneeProcessHistory(child)

    return {
      id: child.id,
      name: getAssigneeProgressDisplayName(child),
      statusLabel: getAssigneeProgressStatusLabel(child),
      statusTone: getAssigneeProgressStatusTone(child),
      note: note || undefined,
      lastProcess: child.lastProcess?.trim() || undefined,
      processHistory: processHistory.length ? processHistory : undefined,
    }
  })
}

function shouldShowAssigneeProgress(task: CalendarEvent, currentUser: CalendarUser) {
  return Boolean(currentUser.id && task.creatorId === currentUser.id && task.childTodos?.length)
}

export function buildTodoDetailPanelViewModel(
  task: CalendarEvent,
  currentUser: CalendarUser,
  users: CalendarUser[] = [],
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
    title: getTodoContentDisplay(task),
    content: getTodoContentDisplay(task),
    contentIsEmpty: !task.content?.trim(),
    typeLabel: getTaskTypeLabel(task),
    typeTone: task.type === 'meeting' ? 'meeting' : 'todo',
    statusLabel: progressSummary?.label ?? getBackendTodoStatusLabel(task),
    statusTone: progressSummary?.tone ?? getDetailStatusTone(task, currentUser),
    time: formatTodoDetailTimeField(task),
    remark: getTodoRemarkDisplay(task),
    remarkIsEmpty: !hasTodoRemark(task),
    meta,
    assigneeProgress: showAssigneeProgress
      ? buildAssigneeProgressItems(task.childTodos ?? [])
      : undefined,
    processSection: buildTodoProcessSection(task, currentUser, users),
  }
}
