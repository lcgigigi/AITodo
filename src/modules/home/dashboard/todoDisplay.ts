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
  return Boolean(event.endDate && event.endDate !== event.date)
}

export function isAllDayEvent(event: CalendarEvent) {
  return !event.time || isRangeEvent(event)
}

export function formatShortDate(date: string) {
  const value = parseDate(date)
  return `${value.getMonth() + 1}/${value.getDate()}`
}

export function formatEventTime(event: CalendarEvent, allDayText = '全天') {
  if (isRangeEvent(event)) return `${formatShortDate(event.date)} ~ ${formatShortDate(event.endDate ?? event.date)}`
  return event.time || allDayText
}

export function formatMonthEventTime(event: CalendarEvent) {
  if (isRangeEvent(event)) return `${formatShortDate(event.date)}-${formatShortDate(event.endDate ?? event.date)}`
  return event.time || '·'
}

export function formatFormDateTime(event: Pick<CalendarEvent, 'date' | 'endDate' | 'time'>) {
  if (event.endDate && event.endDate !== event.date) {
    return `${formatShortDate(event.date)} ~ ${formatShortDate(event.endDate)}`
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
