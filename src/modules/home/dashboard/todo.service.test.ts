import { beforeEach, describe, expect, it, vi } from 'vitest'
import { httpClient } from '@/shared/request/http'
import {
  acceptTodos,
  analyzeTodoText,
  analyzeTodoTextByGet,
  completeTodo,
  createTodo,
  deleteTodo,
  listTodos,
  loadAssignableUsers,
  loadCurrentUser,
  loadPendingTodos,
  loadTodoDetail,
  loadTodos,
  loginSmartTodo,
  rejectTodo,
  transferTodos,
  updateTodo,
} from './todo.service'
import type { CalendarUser } from './types'

vi.mock('@/shared/request/http', () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
    request: vi.fn(),
  },
}))

const currentUser: CalendarUser = {
  id: '1102080',
  name: '李四',
  role: 'employee',
}

const assignableUsers: CalendarUser[] = [currentUser]

function backendResponse<T>(data: T) {
  return Promise.resolve({
    data: {
      code: 200,
      msg: '操作成功',
      data,
    },
  })
}

describe('todo.service real backend adapter', () => {
  beforeEach(() => {
    vi.mocked(httpClient.get).mockReset()
    vi.mocked(httpClient.post).mockReset()
    vi.mocked(httpClient.request).mockReset()
  })

  it('logs in and maps current user info from the real auth endpoints', async () => {
    vi.mocked(httpClient.post).mockResolvedValueOnce({
      data: {
        code: 200,
        msg: '操作成功',
        token: 'real-token',
      },
    })
    vi.mocked(httpClient.get).mockResolvedValueOnce({
      data: {
        code: 200,
        msg: '操作成功',
        user: {
          userId: 1,
          userName: '1102080',
          nickName: '李四',
          isSecurityPassword: 'yes',
        },
        roles: ['admin'],
        permissions: ['*:*:*'],
      },
    })

    await expect(loginSmartTodo({ username: 'admin', password: 'admin123' })).resolves.toBe(
      'real-token',
    )
    await expect(loadCurrentUser()).resolves.toMatchObject({
      id: '1102080',
      name: '李四',
      role: 'leader',
      roles: ['admin'],
      permissions: ['*:*:*'],
    })

    expect(httpClient.post).toHaveBeenCalledWith(
      '/login',
      { username: 'admin', password: 'admin123' },
      expect.any(Object),
    )
    expect(httpClient.get).toHaveBeenCalledWith('/getInfo', expect.any(Object))
  })

  it('wires the 13 smart-todo endpoints and normalizes list data for the page', async () => {
    const calls: Array<{ method?: string; url?: string }> = []

    vi.mocked(httpClient.request).mockImplementation((config) => {
      calls.push({ method: String(config.method), url: String(config.url) })

      if (config.url === '/smart-todo/analyze') {
        return backendResponse({
          task: '项目复盘',
          timeType: 'specific_time',
          date: '2026-06-07',
          time: '17:00',
          assigneeId: '1102080',
          remark: '',
        }) as never
      }

      if (config.url === '/smart-todo/user-list') {
        return backendResponse([{ badge: '1102080', name: '李四' }]) as never
      }

      if (config.url === '/smart-todo/month-list' || config.url === '/smart-todo/pending-list') {
        return backendResponse([
          {
            id: 123,
            title: '项目复盘',
            timeType: 1,
            specificDate: '2026-06-07',
            specificTime: '17:00:00',
            status: 0,
            assigneeId: '1102080',
            creatorId: '1102080',
          },
        ]) as never
      }

      if (config.url === '/smart-todo/123' && config.method === 'GET') {
        return backendResponse({
          id: 123,
          title: '项目复盘',
          timeType: 1,
          specificDate: '2026-06-07',
          specificTime: '17:00:00',
          status: 0,
          assigneeId: '1102080',
          creatorId: '1102080',
        }) as never
      }

      if (config.url === '/smart-todo/create') return backendResponse(123) as never

      return backendResponse(true) as never
    })

    await expect(
      analyzeTodoText('明天下午5点项目复盘', currentUser, assignableUsers, {
        date: '2026-06-06',
        title: '',
      }),
    ).resolves.toMatchObject({
      date: '2026-06-07',
      time: '17:00',
      title: '项目复盘',
      assigneeId: '1102080',
    })
    await analyzeTodoTextByGet('明天下午5点项目复盘', currentUser, assignableUsers, {
      date: '2026-06-06',
      title: '',
    })
    await expect(loadAssignableUsers()).resolves.toEqual([
      { id: '1102080', name: '李四', role: 'employee' },
    ])
    await expect(loadTodos(currentUser, assignableUsers)).resolves.toMatchObject([
      {
        id: '123',
        date: '2026-06-07',
        time: '17:00',
        title: '项目复盘',
        editable: true,
        completable: true,
      },
    ])
    await expect(loadPendingTodos(currentUser, assignableUsers)).resolves.toHaveLength(1)
    await expect(loadTodoDetail('123', currentUser, assignableUsers)).resolves.toMatchObject({
      id: '123',
      assigneeName: '李四',
    })
    await expect(
      createTodo({
        date: '2026-06-07',
        time: '17:00',
        title: '项目复盘',
        assigneeId: '1102080',
      }),
    ).resolves.toBe(123)
    await expect(
      updateTodo({
        id: '123',
        date: '2026-06-07',
        time: '17:00',
        title: '项目复盘',
        owner: '李四',
        assigneeId: '1102080',
      }),
    ).resolves.toBe(true)
    await expect(deleteTodo('123')).resolves.toBe(true)
    await expect(completeTodo('123', currentUser)).resolves.toBe(true)
    await expect(rejectTodo('123', '暂不处理')).resolves.toBe(true)
    await expect(acceptTodos(['123', '124'])).resolves.toBe(true)
    await expect(transferTodos(['123', '124'], '1102080')).resolves.toBe(true)

    expect(calls).toEqual(
      expect.arrayContaining([
        { method: 'POST', url: '/smart-todo/analyze' },
        { method: 'GET', url: '/smart-todo/analyze' },
        { method: 'GET', url: '/smart-todo/user-list' },
        { method: 'GET', url: '/smart-todo/month-list' },
        { method: 'GET', url: '/smart-todo/pending-list' },
        { method: 'GET', url: '/smart-todo/123' },
        { method: 'POST', url: '/smart-todo/create' },
        { method: 'PUT', url: '/smart-todo' },
        { method: 'DELETE', url: '/smart-todo/123' },
        { method: 'POST', url: '/smart-todo/complete/123' },
        { method: 'POST', url: '/smart-todo/reject' },
        { method: 'POST', url: '/smart-todo/accept' },
        { method: 'POST', url: '/smart-todo/transfer' },
      ]),
    )
  })

  it('keeps specific_time analyze result in scheduled mode without fallback endDate', async () => {
    vi.mocked(httpClient.request).mockResolvedValueOnce({
      data: {
        code: 200,
        msg: '操作成功',
        data: {
          task: '开部门会议',
          timeType: 'specific_time',
          date: '2026-06-12',
          time: '09:00',
          startDate: '',
          endDate: '',
          assigneeId: '',
          remark: '在317',
        },
      },
    })

    const parsed = await analyzeTodoText(
      '周五早上九点在317开部门会议',
      currentUser,
      assignableUsers,
      {
        date: '2026-06-09',
        endDate: '2026-06-09',
        title: '',
      },
    )

    expect(parsed).toMatchObject({
      mode: 'scheduled',
      date: '2026-06-12',
      time: '09:00',
      title: '开部门会议',
      source: '在317',
    })
    expect(parsed.endDate).toBeUndefined()
  })

  it('keeps sorting and permission enrichment local without mock seed data', () => {
    const [event] = listTodos(
      [
        {
          id: '123',
          date: '2026-06-07',
          title: '项目复盘',
          type: 'task',
          owner: '李四',
          status: 'todo',
          creatorId: '1102080',
          assigneeId: '1102080',
        },
      ],
      currentUser,
    )

    expect(event).toMatchObject({
      scope: 'self',
      editable: true,
      completable: true,
    })
  })
})
