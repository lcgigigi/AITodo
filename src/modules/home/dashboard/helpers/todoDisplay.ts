import type { CalendarEvent } from '../config/types'

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

export function isSameDayRangeEvent(event: CalendarEvent) {
  return isRangeEvent(event) && (event.endDate ?? event.date) === event.date
}

export function isTimedRangeEvent(event: CalendarEvent) {
  return isRangeEvent(event) && Boolean(event.time || event.endTime)
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

export function formatEventTimeForDayList(
  event: CalendarEvent,
  selectedDate: string,
  options?: { isToday?: boolean; todayText?: string; allDayText?: string },
) {
  const allDayText = options?.allDayText ?? '全天'
  const display = getEventScheduleDisplay(event, allDayText)

  if (display.kind === 'range') {
    const endDate = event.endDate ?? event.date

    if (isSameDayRangeEvent(event) && event.date === selectedDate) {
      const start = display.start.time || display.start.date
      const end = display.end.time || ''
      return end ? `${start} ~ ${end}` : start
    }

    const startShort = formatShortDate(event.date)
    const endShort = formatShortDate(endDate)
    const startTime = event.time || ''
    const endTime = event.endTime || ''

    if (event.date === selectedDate) {
      const start = startTime || startShort
      const end = `${endShort}${endTime ? ` ${endTime}` : ''}`
      return `${start} ~ ${end}`
    }

    if (endDate === selectedDate) {
      const start = `${startShort}${startTime ? ` ${startTime}` : ''}`
      const end = endTime || endShort
      return `${start} ~ ${end}`
    }

    return `${startShort}~${endShort}`
  }

  if (display.kind === 'time') return display.time

  if (display.kind === 'allDay') {
    if (options?.isToday && event.date === selectedDate && options.todayText) {
      return options.todayText
    }
    return display.label
  }

  return formatEventTime(event, allDayText)
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

export function getEventStartSortMinutes(event: CalendarEvent) {
  if (!event.time) return 0

  const [hourPart, minutePart = '0'] = event.time.split(':')
  const hours = Number(hourPart)
  const minutes = Number(minutePart)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0

  return hours * 60 + minutes
}

export function compareEvents(a: CalendarEvent, b: CalendarEvent) {
  const dateCompare = a.date.localeCompare(b.date)
  if (dateCompare !== 0) return dateCompare

  const timeCompare = getEventStartSortMinutes(a) - getEventStartSortMinutes(b)
  if (timeCompare !== 0) return timeCompare

  return getTodoListDisplayText(a).localeCompare(getTodoListDisplayText(b), 'zh-CN')
}

export function isMeetingTodoEvent(event: CalendarEvent) {
  return event.type === 'meeting'
}

function getCalendarDisplayStatusRank(event: CalendarEvent) {
  if (isCompletedTodoEvent(event)) return 1
  if (isRejectedTodo(event)) return 2
  return 0
}

function getCalendarInlineSortRank(event: CalendarEvent) {
  if (isRangeEvent(event)) return 4
  if (isMeetingTodoEvent(event)) return event.time ? 0 : 1
  if (event.time) return 2
  return 3
}

export function compareCalendarStartTime(a: CalendarEvent, b: CalendarEvent) {
  return compareEvents(a, b)
}

export function compareCalendarDisplayEvents(a: CalendarEvent, b: CalendarEvent) {
  const statusCompare = getCalendarDisplayStatusRank(a) - getCalendarDisplayStatusRank(b)
  if (statusCompare !== 0) return statusCompare

  const aRank = getCalendarInlineSortRank(a)
  const bRank = getCalendarInlineSortRank(b)
  if (aRank !== bRank) return aRank - bRank

  return compareCalendarStartTime(a, b)
}

export function compareCalendarRangeBarEvents(a: CalendarEvent, b: CalendarEvent) {
  const statusCompare = getCalendarDisplayStatusRank(a) - getCalendarDisplayStatusRank(b)
  if (statusCompare !== 0) return statusCompare

  return compareCalendarStartTime(a, b)
}

export function getActiveCalendarDisplayEvents(events: CalendarEvent[]) {
  return [...events].sort(compareCalendarDisplayEvents)
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
  return event.type === 'meeting' ? '会议' : '智能待办'
}

export function getBackendTodoStatusLabel(event: CalendarEvent) {
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
export type TodoScopeFilter = 'all' | 'assigned_by_me' | 'assigned_to_me'

export type TodoScopeBadge = {
  label: string
  tone: 'outgoing' | 'incoming'
}

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
  return label === '待处理' || label === '已接受'
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

export function matchesTodoScopeFilter(event: CalendarEvent, filter: TodoScopeFilter) {
  if (filter === 'all') return true
  return event.scope === filter
}

export function countTodoScopeEvents(
  events: CalendarEvent[],
  scope: Exclude<TodoScopeFilter, 'all'>,
) {
  return events.filter((event) => event.scope === scope).length
}

export function getTodoScopeBadge(event: CalendarEvent): TodoScopeBadge | null {
  if (event.scope === 'assigned_by_me') {
    return { label: '我派发', tone: 'outgoing' }
  }

  if (event.scope === 'assigned_to_me') {
    const creator = event.creatorName ?? '未指定'
    return { label: `来自：${creator}`, tone: 'incoming' }
  }

  return null
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

export function getTodoRemarkDisplay(event: CalendarEvent) {
  return event.remark?.trim() || '暂无备注'
}

export function hasTodoRemark(event: CalendarEvent) {
  return Boolean(event.remark?.trim())
}

export function getTodoListRemarkLine(event: CalendarEvent) {
  const remark = event.remark?.trim()
  if (remark) return `备注：${remark}`
  return '暂无备注'
}

export function getTodoListDisplayText(event: CalendarEvent) {
  const content = event.content?.trim()
  if (content) return content

  return event.title?.trim() || '未命名待办'
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
