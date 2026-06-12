export type CalendarEventType = 'meeting' | 'task' | 'approval' | 'ai'
export type CalendarEventStatus = 'todo' | 'done'
export type CalendarEventPriority = 'normal' | 'urgent'
export type CalendarUserRole = 'leader' | 'employee'
export type CalendarTodoScope = 'self' | 'assigned_by_me' | 'assigned_to_me'
export type CalendarTodoFormMode = 'scheduled' | 'deadline'

export type CalendarSpecialDayType = 'holiday' | 'workday' | 'solar-term'

export interface CalendarEvent {
  id: string
  date: string
  endDate?: string
  time?: string
  endTime?: string
  title: string
  type: CalendarEventType
  owner: string
  status: CalendarEventStatus
  priority?: CalendarEventPriority
  source?: string
  creatorId?: string
  creatorName?: string
  assigneeId?: string
  assigneeName?: string
  scope?: CalendarTodoScope
  editable?: boolean
  completable?: boolean
  backendStatus?: 0 | 3 | 6 | 9 | 99
  receiveStatus?: number
  currentHandlerId?: string
  handlerIds?: string
  content?: string
  remark?: string
}

export interface CalendarTodoDraft {
  date: string
  endDate?: string
  time?: string
  endTime?: string
  title: string
  owner?: string
  source?: string
  assigneeId?: string
  assigneeName?: string
}

export interface CalendarTodoUpdate {
  id: string
  date: string
  endDate?: string
  time?: string
  endTime?: string
  title: string
  owner: string
  source?: string
  assigneeId?: string
  assigneeName?: string
}

export interface CalendarTodoForm {
  mode: CalendarTodoFormMode
  date: string
  endDate: string
  time: string
  endTime: string
  title: string
  owner: string
  assigneeId: string
  assigneeName: string
  source: string
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
  mode?: CalendarTodoFormMode
  date: string
  endDate?: string
  time?: string
  endTime?: string
  title: string
  owner?: string
  assigneeId?: string
  assigneeName?: string
  source?: string
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
