import { parseDate } from '@internationalized/date'
import type { DateValue } from 'reka-ui'

export type TodoTimeParts = {
  hour: string
  minute: string
}

export const TODO_HOUR_OPTIONS = Array.from({ length: 17 }, (_, index) =>
  String(index + 7).padStart(2, '0'),
)

export const TODO_MINUTE_OPTIONS = Array.from({ length: 12 }, (_, index) =>
  String(index * 5).padStart(2, '0'),
)

function includeCurrentOption(baseOptions: string[], currentValue?: string) {
  if (!currentValue || baseOptions.includes(currentValue)) return baseOptions
  return [...baseOptions, currentValue].sort((first, second) => Number(first) - Number(second))
}

export function parseTodoTime(value: string): TodoTimeParts | undefined {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  if (!match) return undefined

  return {
    hour: match[1],
    minute: match[2],
  }
}

export function getTodoHourOptions(currentHour?: string) {
  return includeCurrentOption(TODO_HOUR_OPTIONS, currentHour)
}

export function getTodoMinuteOptions(currentMinute?: string) {
  return includeCurrentOption(TODO_MINUTE_OPTIONS, currentMinute)
}

export function safeParseCalendarDate(value: string): DateValue | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined

  try {
    return parseDate(value)
  } catch {
    return undefined
  }
}
