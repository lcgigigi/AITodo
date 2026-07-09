export type CalendarEventType = 'meeting' | 'task' | 'approval' | 'ai'
export type CalendarEventStatus = 'todo' | 'done'
export type CalendarUserRole = 'leader' | 'employee'
export type CalendarTodoScope = 'self' | 'assigned_by_me' | 'assigned_to_me'
export type CalendarTodoFormMode = 'scheduled' | 'deadline'
/** 1 普通待办，2 会议 */
export type SmartTodoKind = 1 | 2

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
  timeType?: 1 | 2
  startDateShow?: string
  endDateShow?: string
  handlerName?: string
  handleDesc?: string
  currentHandlerId?: string
  handlerIds?: string
  content?: string
  remark?: string
  /** 详情接口返回的子待办，用于展示各接受人的执行状态 */
  childTodos?: CalendarEvent[]
}

export interface CalendarTodoDraft {
  date: string
  endDate?: string
  time?: string
  endTime?: string
  title: string
  /** 一句话 AI 解析时的用户原话，创建时作为接口 title 传递 */
  aiPrompt?: string
  owner?: string
  source?: string
  assigneeId?: string
  assigneeName?: string
  type?: SmartTodoKind
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
  type?: SmartTodoKind
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
  type: SmartTodoKind
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
  type?: SmartTodoKind
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

/** 待办详情打开来源：日历操作 / 消息通知只读 / 待接受收件箱 */
export type TodoOpenSource = 'calendar' | 'notification' | 'pending-inbox'
