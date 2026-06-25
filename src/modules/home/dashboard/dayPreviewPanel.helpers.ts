import type { CalendarEvent, CalendarSpecialDay } from './types'
import { getRejectedTodoMessage, getTodoStatusLabel, isRejectedTodo } from './todoDisplay'

export type PanelMode = 'list' | 'create' | 'edit' | 'view'
export type TodoStatusFilter = 'all' | 'pending' | 'done'
export type TodoTypeFilter = 'all' | 'task' | 'meeting'
export type ParsedHighlightField =
  | 'date'
  | 'time'
  | 'endDate'
  | 'endTime'
  | 'title'
  | 'source'
  | 'assignee'
  | 'type'

export const scheduledTimePresets = [
  { label: '中午12点', value: '12:00' },
  { label: '下午3点', value: '15:00' },
  { label: '晚上5点', value: '17:00' },
]

export const specialText: Record<CalendarSpecialDay['type'], string> = {
  holiday: '节假日',
  workday: '补班',
  'solar-term': '节气',
}

export function isMeetingEvent(event: CalendarEvent) {
  return event.type === 'meeting'
}

function matchesStatusFilter(event: CalendarEvent, filter: TodoStatusFilter) {
  if (filter === 'all') return true
  if (filter === 'pending') return event.status !== 'done' && !isRejectedTodo(event)
  return event.status === 'done' && !isRejectedTodo(event)
}

function matchesTypeFilter(event: CalendarEvent, filter: TodoTypeFilter) {
  if (filter === 'all') return true
  if (filter === 'meeting') return isMeetingEvent(event)
  return !isMeetingEvent(event)
}

export function filterEventsByStatus(events: CalendarEvent[], filter: TodoStatusFilter) {
  return events.filter((event) => matchesStatusFilter(event, filter))
}

export function filterEventsByType(events: CalendarEvent[], filter: TodoTypeFilter) {
  return events.filter((event) => matchesTypeFilter(event, filter))
}

export function eventTypeLabel(event: CalendarEvent) {
  return isMeetingEvent(event) ? '会议' : '待办'
}

export function shouldShowEventMeta(event: CalendarEvent) {
  return Boolean(event.source) || (isRejectedTodo(event) && Boolean(getRejectedTodoMessage(event)))
}

export function statusText(event: CalendarEvent) {
  return getTodoStatusLabel(event)
}
