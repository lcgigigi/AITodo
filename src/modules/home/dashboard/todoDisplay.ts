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
  if (isRangeEvent(event)) return `${formatShortDate(event.date)}-${formatShortDate(event.endDate ?? event.date)}`
  return event.time || '·'
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

export function compareEvents(a: CalendarEvent, b: CalendarEvent) {
  const aRank = isRangeEvent(a) ? 0 : a.time ? 2 : 1
  const bRank = isRangeEvent(b) ? 0 : b.time ? 2 : 1
  if (aRank !== bRank) return aRank - bRank
  if ((a.time || '') !== (b.time || '')) return (a.time || '').localeCompare(b.time || '')
  return a.title.localeCompare(b.title, 'zh-CN')
}
