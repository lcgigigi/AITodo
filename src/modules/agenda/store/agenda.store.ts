import { defineStore } from 'pinia'
import type { TodoItem } from '../types/agenda.types'

export const useAgendaStore = defineStore('agenda', {
  state: () => ({
    selectedDate: '',
    todayTodos: [] as TodoItem[],
  }),
  actions: {
    setSelectedDate(date: string) {
      this.selectedDate = date
    },
    setTodayTodos(todos: TodoItem[]) {
      this.todayTodos = todos
    },
  },
})
