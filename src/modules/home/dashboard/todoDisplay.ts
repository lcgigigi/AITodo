import type { CalendarEvent } from './types'

export function parseDate(date: string) {
  return new Date(`${date}T12:00:00`)
}

export function ymd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function compareDate(a: string, b: string) {
  return parseDate(a).getTime() - parseDate(b).getTime()
}

export function dateRange(startDate: string, endDate?: string) {
  const start = parseDate(startDate)
  const end = parseDate(endDate && compareDate(endDate, startDate) >= 0 ? endDate : startDate)
  const dates: string[] = []
  const cursor = new Date(start)

  while (cursor.getTime() <= end.getTime()) {
    dates.push(ymd(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

export function isRangeEvent(event: CalendarEvent) {
  return Boolean(event.endDate)
}

export function isAllDayEvent(event: CalendarEvent) {
  return !event.time || isRangeEvent(event)
}

export function formatShortDate(date: string) {
  const value = parseDate(date)
  return `${value.getMonth() + 1}/${value.getDate()}`
}

export type EventSchedulePoint = {
  date: string
  time?: string
}

export type EventScheduleDisplay =
  | { kind: 'time'; time: string }
  | { kind: 'allDay'; label: string }
  | { kind: 'range'; start: EventSchedulePoint; end: EventSchedulePoint }

export function getEventScheduleDisplay(
  event: CalendarEvent,
  allDayText = '全天',
): EventScheduleDisplay {
  if (isRangeEvent(event)) {
    return {
      kind: 'range',
      start: {
        date: formatShortDate(event.date),
        time: event.time,
      },
      end: {
        date: formatShortDate(event.endDate ?? event.date),
        time: event.endTime,
      },
    }
  }

  if (event.time) {
    return { kind: 'time', time: event.time }
  }

  return { kind: 'allDay', label: allDayText }
}

export function formatEventTime(event: CalendarEvent, allDayText = '全天') {
  const display = getEventScheduleDisplay(event, allDayText)

  if (display.kind === 'time') return display.time
  if (display.kind === 'allDay') return display.label

  const start = `${display.start.date}${display.start.time ? ` ${display.start.time}` : ''}`
  const end = `${display.end.date}${display.end.time ? ` ${display.end.time}` : ''}`
  return `${start} ~ ${end}`
}

export function formatMonthEventTime(event: CalendarEvent) {
  if (isRangeEvent(event))
    return `${formatShortDate(event.date)}-${formatShortDate(event.endDate ?? event.date)}`
  return event.time || '·'
}

export function getCalendarEventTypeLabel(type: CalendarEvent['type']) {
  if (type === 'meeting') return '会议'
  if (type === 'approval') return '审批'
  if (type === 'ai') return 'AI'
  return '待办'
}

export function formatFormDateTime(
  event: Pick<CalendarEvent, 'date' | 'endDate' | 'time' | 'endTime'>,
) {
  if (event.endDate) {
    const start = `${formatShortDate(event.date)}${event.time ? ` ${event.time}` : ''}`
    const end = `${formatShortDate(event.endDate)}${event.endTime ? ` ${event.endTime}` : ''}`
    return `${start} ~ ${end}`
  }

  return `${event.date} ${event.time || '全天'}`
}

export function isRejectedTodo(event: CalendarEvent) {
  return event.backendStatus === 9
}

export function getTodoStatusLabel(event: CalendarEvent) {
  if (event.status === 'done') return '已完成'
  if (isRejectedTodo(event)) return '已拒绝'
  return '待处理'
}

export function getRejectedTodoMessage(event: CalendarEvent) {
  if (!isRejectedTodo(event)) return ''

  const reason = event.handleDesc?.trim()
  if (reason) return `拒绝理由：${reason}`
  return ''
}

export function compareEvents(a: CalendarEvent, b: CalendarEvent) {
  const aRank = isRangeEvent(a) ? 0 : a.time ? 2 : 1
  const bRank = isRangeEvent(b) ? 0 : b.time ? 2 : 1
  if (aRank !== bRank) return aRank - bRank
  if ((a.time || '') !== (b.time || '')) return (a.time || '').localeCompare(b.time || '')
  return a.title.localeCompare(b.title, 'zh-CN')
}

export function isMeetingTodoEvent(event: CalendarEvent) {
  return event.type === 'meeting'
}

export function compareCalendarDisplayEvents(a: CalendarEvent, b: CalendarEvent) {
  if (isMeetingTodoEvent(a) !== isMeetingTodoEvent(b)) {
    return isMeetingTodoEvent(a) ? -1 : 1
  }

  return compareEvents(a, b)
}

export function getActiveCalendarDisplayEvents(events: CalendarEvent[]) {
  return events.filter((event) => !isCompletedTodoEvent(event)).sort(compareCalendarDisplayEvents)
}

function normalizeShowDateTime(value?: string) {
  if (!value) return ''
  const normalized = value.replace('T', ' ').trim()
  return normalized.replace(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}):\d{2}$/, '$1')
}

export function formatTodoDetailTimeField(event: CalendarEvent): string | string[] {
  const timeType = event.timeType ?? (event.endDate ? 2 : 1)
  const start = normalizeShowDateTime(event.startDateShow)
  const end = normalizeShowDateTime(event.endDateShow)

  if (timeType === 2) {
    if (start && end) {
      return [start, end]
    }
    if (start) {
      return start
    }
    return formatEventTime(event)
  }

  if (start) {
    return start
  }

  return formatEventTime(event)
}

export function getSmartTodoKindLabel(event: CalendarEvent) {
  return event.type === 'meeting' ? '会议' : '普通待办'
}

export function getBackendTodoStatusLabel(event: CalendarEvent) {
  if (event.receiveStatus === 2) return '待接受'
  if (event.receiveStatus === 1 && event.backendStatus !== 6 && event.backendStatus !== 9) {
    return '已接受'
  }

  switch (event.backendStatus) {
    case 0:
      return '待处理'
    case 3:
      return '已接受'
    case 6:
      return '已完成'
    case 9:
      return '已拒绝'
    case 99:
      return '已删除'
    default:
      return '待处理'
  }
}

export type DetailCategoryFilter = 'all' | 'task' | 'meeting'
export type DetailStatusFilter = 'all' | 'pending' | 'done' | 'rejected'

export function isCompletedTodoEvent(event: CalendarEvent) {
  return event.backendStatus === 6 || event.status === 'done'
}

export function isPendingProcessTodoEvent(event: CalendarEvent) {
  if (isCompletedTodoEvent(event)) return false

  const label = getBackendTodoStatusLabel(event)
  return label === '待处理' || label === '已接受'
}

export function isPendingDetailStatusEvent(event: CalendarEvent) {
  if (isCompletedTodoEvent(event) || isRejectedTodo(event)) return false

  const label = getBackendTodoStatusLabel(event)
  return label === '待处理' || label === '已接受' || label === '待接受'
}

export function isOtherStatusTodoEvent(event: CalendarEvent) {
  if (isCompletedTodoEvent(event) || isPendingProcessTodoEvent(event)) return false
  return true
}

export function matchesDetailCategoryFilter(event: CalendarEvent, filter: DetailCategoryFilter) {
  if (filter === 'all') return true
  if (filter === 'meeting') return event.type === 'meeting'
  return event.type !== 'meeting'
}

export function matchesDetailStatusFilter(event: CalendarEvent, filter: DetailStatusFilter) {
  if (filter === 'all') return true
  if (filter === 'done') return isCompletedTodoEvent(event)
  if (filter === 'rejected') return isRejectedTodo(event)
  return isPendingDetailStatusEvent(event)
}

export function getTodoCreatorDisplayName(event: CalendarEvent) {
  return event.creatorName || event.creatorId || '未指定'
}

export function isSelfAssignedTodo(event: CalendarEvent) {
  if (event.scope === 'self') return true

  const creatorId = event.creatorId?.trim()
  if (!creatorId) return false

  const assigneeIds =
    event.assigneeId
      ?.split(',')
      .map((id) => id.trim())
      .filter(Boolean) ?? []

  return assigneeIds.length === 1 && assigneeIds[0] === creatorId
}

export function shouldShowTodoAssignerField(event: CalendarEvent) {
  return !isSelfAssignedTodo(event)
}

export function getTodoAssigneeDisplayName(event: CalendarEvent) {
  return event.assigneeName || event.owner || '未指定'
}

export function getTodoHandlerDisplayName(event: CalendarEvent) {
  return event.handlerName || event.currentHandlerId || '未指定'
}

export function getTodoContentDisplay(event: CalendarEvent) {
  return event.content?.trim() || '暂无内容'
}

export function isWeakTodoTitle(title: string) {
  const trimmed = title.trim()
  if (!trimmed) return true
  if (/^\d+$/.test(trimmed)) return true
  return trimmed.length <= 1
}

function getAiFocusTypeLabel(event: CalendarEvent) {
  if (event.type === 'meeting') return '会议'
  if (event.type === 'approval') return '审批'
  return '待办'
}

export function formatAiFocusTodoLabel(event: CalendarEvent) {
  const title = event.title?.trim() || '未命名待办'
  if (!isWeakTodoTitle(title)) {
    return `「${title}」`
  }

  const typeLabel = getAiFocusTypeLabel(event)
  const timeLabel = formatEventTime(event)
  const hasSpecificTime = Boolean(event.time) && timeLabel !== '全天'

  if (hasSpecificTime) {
    return `${timeLabel} 的${typeLabel}「${title}」`
  }

  const assignee = getTodoAssigneeDisplayName(event)
  if (assignee !== '未指定' && shouldShowTodoAssignerField(event)) {
    return `${assignee} 的${typeLabel}「${title}」`
  }

  if (timeLabel === '全天') {
    return `全天${typeLabel}「${title}」`
  }

  return `${typeLabel}「${title}」`
}
