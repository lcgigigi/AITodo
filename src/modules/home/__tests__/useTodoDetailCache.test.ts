import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadTodoDetail } from '../dashboard/services/todo.service'
import type { CalendarEvent, CalendarUser } from '../dashboard/config/types'
import { useTodoDetailCache } from '../dashboard/composables/useTodoDetailCache'

vi.mock('../dashboard/services/todo.service', () => ({
  loadTodoDetail: vi.fn(),
}))

const currentUser: CalendarUser = {
  id: '1001',
  name: '测试用户',
  role: 'employee',
}

const event: CalendarEvent = {
  id: 'todo-1',
  date: '2026-07-09',
  title: '测试待办',
  type: 'task',
  owner: '测试用户',
  status: 'todo',
}

describe('useTodoDetailCache', () => {
  beforeEach(() => {
    vi.mocked(loadTodoDetail).mockReset()
  })

  it('loads and caches todo details', async () => {
    vi.mocked(loadTodoDetail).mockResolvedValue({ ...event, content: '详情' })
    const cache = useTodoDetailCache({
      currentUser: ref(currentUser),
      assignableUsers: ref([currentUser]),
    })

    await expect(cache.loadTaskDetail(event)).resolves.toMatchObject({ content: '详情' })
    await expect(cache.loadTaskDetail(event)).resolves.toMatchObject({ content: '详情' })

    expect(loadTodoDetail).toHaveBeenCalledOnce()
    expect(cache.taskDetails.value[event.id]).toMatchObject({ content: '详情' })
  })

  it('reloads cached details when force is enabled', async () => {
    vi.mocked(loadTodoDetail)
      .mockResolvedValueOnce({ ...event, content: '第一次' })
      .mockResolvedValueOnce({ ...event, content: '第二次' })
    const cache = useTodoDetailCache({
      currentUser: ref(currentUser),
      assignableUsers: ref([currentUser]),
    })

    await cache.loadTaskDetail(event)
    await cache.loadTaskDetail(event, { force: true })

    expect(loadTodoDetail).toHaveBeenCalledTimes(2)
    expect(cache.taskDetails.value[event.id]).toMatchObject({ content: '第二次' })
  })

  it('reports visible load failures but keeps silent refreshes silent', async () => {
    vi.mocked(loadTodoDetail).mockRejectedValue(new Error('network error'))
    const onError = vi.fn()
    const cache = useTodoDetailCache({
      currentUser: ref(currentUser),
      assignableUsers: ref([currentUser]),
      onError,
    })

    await cache.loadTaskDetail(event, { force: true })
    await cache.loadTaskDetail(event, { force: true, silent: true })

    expect(onError).toHaveBeenCalledOnce()
    expect(cache.detailLoadingId.value).toBe('')
  })
})
