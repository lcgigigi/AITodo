import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadAssignableUsers,
  loadCurrentUser,
  loadTodos,
} from '@/modules/home/dashboard/todo.service'
import type { CalendarEvent, CalendarUser } from '@/modules/home/dashboard/types'
import { RequestError } from '@/shared/request/request-error'
import { useDashboardTodosStore } from './dashboard-todos.store'
import { useUserStore } from './user.store'

vi.mock('@/modules/home/dashboard/todo.service', () => ({
  listTodos: (events: CalendarEvent[]) => events,
  loadAssignableUsers: vi.fn(),
  loadCurrentUser: vi.fn(),
  loadTodos: vi.fn(),
  updateTodoStatus: vi.fn(),
}))

const currentUser: CalendarUser = {
  id: '1001',
  name: '测试用户',
  role: 'employee',
}

function event(id: string, date: string): CalendarEvent {
  return {
    id,
    date,
    title: id,
    type: 'task',
    owner: currentUser.name,
    status: 'todo',
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('dashboard todos store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(loadTodos).mockReset()
    vi.mocked(loadAssignableUsers).mockReset()
    vi.mocked(loadCurrentUser).mockReset()
    vi.mocked(loadAssignableUsers).mockResolvedValue([currentUser])

    const userStore = useUserStore()
    userStore.setToken('token')
    userStore.setProfile(currentUser)
  })

  it('only commits the latest range response', async () => {
    const first = deferred<CalendarEvent[]>()
    const second = deferred<CalendarEvent[]>()
    vi.mocked(loadTodos).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const store = useDashboardTodosStore()
    store.backendAssignableUsers = [currentUser]

    const firstLoad = store.loadForRange(
      { startDate: '2026-07-01', endDate: '2026-07-31' },
      { force: true },
    )
    const secondLoad = store.loadForRange(
      { startDate: '2026-08-01', endDate: '2026-08-31' },
      { force: true },
    )

    second.resolve([event('august', '2026-08-01')])
    await expect(secondLoad).resolves.toBe(true)
    first.resolve([event('july', '2026-07-01')])
    await expect(firstLoad).resolves.toBe(false)

    expect(store.allEvents).toEqual([event('august', '2026-08-01')])
    expect(store.loadedRange).toEqual({
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    })
  })

  it('cancels an in-flight refresh when the requested range is already cached', async () => {
    const refresh = deferred<CalendarEvent[]>()
    vi.mocked(loadTodos)
      .mockResolvedValueOnce([event('cached', '2026-07-01')])
      .mockReturnValueOnce(refresh.promise)

    const store = useDashboardTodosStore()
    store.backendAssignableUsers = [currentUser]
    const july = { startDate: '2026-07-01', endDate: '2026-07-31' }

    await expect(store.loadForRange(july, { force: true })).resolves.toBe(true)
    const backgroundRefresh = store.loadForRange(july, { force: true })
    await expect(store.loadForRange(july)).resolves.toBe(true)

    refresh.resolve([event('stale', '2026-07-02')])
    await expect(backgroundRefresh).resolves.toBe(false)
    expect(store.allEvents).toEqual([event('cached', '2026-07-01')])
    expect(store.isLoading).toBe(false)
  })

  it('logs out on a structured unauthorized error', async () => {
    vi.mocked(loadTodos).mockRejectedValue(new RequestError('接口拒绝访问', { status: 401 }))

    const store = useDashboardTodosStore()
    store.backendAssignableUsers = [currentUser]
    const onUnauthorized = vi.fn()

    await expect(
      store.loadForRange(
        { startDate: '2026-07-01', endDate: '2026-07-31' },
        { force: true, onUnauthorized },
      ),
    ).resolves.toBe(false)

    expect(useUserStore().isLoggedIn).toBe(false)
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })
})
