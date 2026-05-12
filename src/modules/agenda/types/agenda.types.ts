export interface ScheduleItem {
  id: string
  title: string
  startTime: string
  endTime: string
  location?: string
}

export interface TodoItem {
  id: string
  title: string
  deadline?: string
  priority: 'low' | 'medium' | 'high'
  done: boolean
}

export interface AgendaDay {
  date: string
  schedules: ScheduleItem[]
  todos: TodoItem[]
}
