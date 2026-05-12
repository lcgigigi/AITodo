export type CalendarEventType = 'meeting' | 'task' | 'approval' | 'ai'

export type CalendarSpecialDayType = 'holiday' | 'workday' | 'solar-term'

export interface CalendarEvent {
  id: string
  date: string
  time: string
  title: string
  type: CalendarEventType
  owner: string
  status: 'todo' | 'done' | 'urgent'
  source?: string
}

export interface CalendarDay {
  date: string
  day: number
  inMonth: boolean
  isToday?: boolean
  specialDays: CalendarSpecialDay[]
  events: CalendarEvent[]
}

export interface CalendarSpecialDay {
  date: string
  name: string
  type: CalendarSpecialDayType
}

export interface AiToolEntry {
  id: string
  name: string
  desc: string
  tone: 'blue' | 'green' | 'violet' | 'amber' | 'rose'
  icon: string
  meta: string
}
