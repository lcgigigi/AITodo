export type CalendarEventType = 'meeting' | 'task' | 'approval' | 'ai'
export type CalendarEventStatus = 'todo' | 'done'
export type CalendarEventPriority = 'normal' | 'urgent'
export type CalendarUserRole = 'leader' | 'employee'
export type CalendarTodoScope = 'self' | 'assigned_by_me' | 'assigned_to_me'

export type CalendarSpecialDayType = 'holiday' | 'workday' | 'solar-term'

export interface CalendarEvent {
  id: string
  date: string
  time: string
  title: string
  type: CalendarEventType
  owner: string
  status: CalendarEventStatus
  priority?: CalendarEventPriority
  source?: string
  completionIdeas?: string
  creatorId?: string
  creatorName?: string
  assigneeId?: string
  assigneeName?: string
  scope?: CalendarTodoScope
  editable?: boolean
  completable?: boolean
}

export interface CalendarTodoDraft {
  date: string
  time: string
  title: string
  owner?: string
  source?: string
  completionIdeas?: string
  assigneeId?: string
  assigneeName?: string
}

export interface CalendarTodoUpdate {
  id: string
  date: string
  time: string
  title: string
  owner: string
  source?: string
  completionIdeas?: string
  assigneeId?: string
  assigneeName?: string
}

export interface CalendarTodoForm {
  date: string
  time: string
  title: string
  owner: string
  assigneeId: string
  assigneeName: string
  source: string
  completionIdeas: string
}

export interface CalendarUser {
  id: string
  name: string
  role: CalendarUserRole
  department?: string
  avatar?: string
  leaderId?: string
  teamMemberIds?: string[]
}

export interface ParsedTodoDraft {
  date: string
  time: string
  title: string
  owner?: string
  assigneeId?: string
  assigneeName?: string
  source?: string
  completionIdeas?: string
}

export interface CalendarDay {
  date: string
  day: number
  inMonth: boolean
  inActiveWeek?: boolean
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
