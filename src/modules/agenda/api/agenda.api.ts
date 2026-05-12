import { http } from '@/shared/request/http'
import type { AgendaDay, TodoItem } from '../types/agenda.types'

export function getAgendaDay(date: string) {
  return http.get<AgendaDay>('/agenda/day', { params: { date } })
}

export function getTodayTodos() {
  return http.get<TodoItem[]>('/todo/today')
}
