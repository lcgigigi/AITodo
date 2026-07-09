import { ref, type Ref } from 'vue'
import type { CalendarEvent, CalendarUser } from '../config/types'
import { loadTodoDetail } from '../services/todo.service'
import { storeCalendarEventDetail } from '../helpers/todoDetailPanel.helpers'

type LoadTodoDetailOptions = {
  force?: boolean
  silent?: boolean
}

type UseTodoDetailCacheOptions = {
  currentUser: Ref<CalendarUser>
  assignableUsers: Ref<CalendarUser[]>
  onError?: () => void
}

export function useTodoDetailCache(options: UseTodoDetailCacheOptions) {
  const taskDetails = ref<Record<string, CalendarEvent>>({})
  const detailLoadingId = ref('')

  async function loadTaskDetail(
    task: Pick<CalendarEvent, 'id'>,
    loadOptions: LoadTodoDetailOptions = {},
  ) {
    if (!options.currentUser.value.id) return null

    const cached = taskDetails.value[task.id]
    if (!loadOptions.force && cached) return cached

    if (!loadOptions.silent) {
      detailLoadingId.value = task.id
    }

    try {
      const detail = await loadTodoDetail(
        task.id,
        options.currentUser.value,
        options.assignableUsers.value,
      )
      taskDetails.value = storeCalendarEventDetail(taskDetails.value, detail, task.id)
      return detail
    } catch {
      if (!loadOptions.silent) {
        options.onError?.()
      }
      return null
    } finally {
      if (!loadOptions.silent && detailLoadingId.value === task.id) {
        detailLoadingId.value = ''
      }
    }
  }

  return {
    taskDetails,
    detailLoadingId,
    loadTaskDetail,
  }
}
