import { beforeEach, describe, expect, it, vi } from 'vitest'
import { httpClient } from '@/shared/request/http'
import {
  acceptTodos,
  analyzeTodoText,
  completeTodo,
  createTodo,
  deleteTodo,
  listTodos,
  loadAssignableUsers,
  loadCurrentUser,
  loadPendingTodos,
  loadLatestWorkSummary,
  loadTodoDetail,
  getTodoMonthRange,
  getTodoWeekRange,
  loadTodos,
  loginSmartTodo,
  rejectTodo,
  selectEmailProvider,
  cancelTodoComplete,
  revokeTodoComplete,
  syncCalendar,
  transferTodos,
  updateTodo,
  updateTodoStatus,
} from '../dashboard/services/todo.service'
import type { CalendarUser } from '../dashboard/config/types'

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

  it('submits the selected email provider choice', async () => {
    vi.mocked(httpClient.request).mockResolvedValue({
      data: {
        code: 200,
        msg: '操作成功',
      },
    })

    await expect(selectEmailProvider('outlook')).resolves.toBe(true)
    await expect(selectEmailProvider('coremail')).resolves.toBe(true)

    expect(httpClient.request).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        method: 'POST',
        url: '/smart-todo/select-email',
        params: { choice: 1 },
      }),
    )
    expect(httpClient.request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        method: 'POST',
        url: '/smart-todo/select-email',
        params: { choice: 2 },
      }),
    )
  })

  it('loads the current employee work summary text', async () => {
    vi.mocked(httpClient.request).mockResolvedValueOnce({
      data: {
        code: 200,
        msg: '操作成功',
        data: {
          aiReportText: '这是 AI 生成的工作总结内容',
        },
      },
    })

    await expect(loadLatestWorkSummary()).resolves.toBe('这是 AI 生成的工作总结内容')
    expect(httpClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/work-summary/latest',
      }),
    )
  })

  it('wires the active smart-todo endpoints and normalizes list data for the page', async () => {
    const calls: Array<{ method?: string; url?: string }> = []

    vi.mocked(httpClient.request).mockImplementation((config) => {
      calls.push({ method: String(config.method), url: String(config.url) })

      if (config.url === '/smart-todo/analyze') {
        return backendResponse({
          task: '项目复盘',
          timeType: 1,
          startDateShow: '2026-06-07 17:00:00',
          assigneeIds: '1102080',
          type: 1,
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
            startDateShow: '2026-06-07 17:00:00',
            status: 0,
            assigneeId: '1102080',
            creatorId: '1102080',
          },
        ]) as never
      }

      if (config.url === '/smart-todo/123' && config.method === 'GET') {
        return backendResponse({
          mainTodo: {
            id: 123,
            title: '项目复盘',
            timeType: 1,
            startDateShow: '2026-06-07 17:00:00',
            content: '完成项目复盘',
            status: 0,
            assigneeIds: '1102080',
            creatorId: '1101001',
            handlerId: '1102080',
            receiveStatus: 2,
            type: 1,
          },
          childTodoList: [],
        }) as never
      }

      if (config.url === '/smart-todo/create') {
        expect(config.data).toMatchObject({
          title: '',
          content: '项目复盘',
          timeType: 1,
          startDateShow: '2026-06-07 17:00:00',
          assigneeIds: '1102080',
          type: 1,
        })
        return backendResponse(123) as never
      }

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
      type: 1,
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
      content: '完成项目复盘',
      timeType: 1,
      startDateShow: '2026-06-07 17:00:00',
      handlerName: '李四',
      receiveStatus: 2,
    })
    await expect(
      createTodo({
        date: '2026-06-07',
        time: '17:00',
        title: '项目复盘',
        assigneeId: '1102080',
        type: 1,
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
    await expect(cancelTodoComplete('123')).resolves.toBe(true)
    await expect(revokeTodoComplete('123', currentUser, assignableUsers)).resolves.toBe(true)
    await expect(updateTodoStatus('123', currentUser, 'todo', assignableUsers)).resolves.toBe(true)
    await expect(rejectTodo('123', '暂不处理')).resolves.toBe(true)
    await expect(acceptTodos(['123', '124'])).resolves.toBe(true)
    await expect(transferTodos(['123', '124'], '1102080')).resolves.toBe(true)

    expect(calls).toEqual(
      expect.arrayContaining([
        { method: 'POST', url: '/smart-todo/analyze' },
        { method: 'GET', url: '/smart-todo/user-list' },
        { method: 'GET', url: '/smart-todo/month-list' },
        { method: 'GET', url: '/smart-todo/pending-list' },
        { method: 'GET', url: '/smart-todo/123' },
        { method: 'POST', url: '/smart-todo/create' },
        { method: 'PUT', url: '/smart-todo' },
        { method: 'DELETE', url: '/smart-todo/123' },
        { method: 'POST', url: '/smart-todo/complete/123' },
        { method: 'POST', url: '/smart-todo/cancel' },
        { method: 'POST', url: '/smart-todo/reject' },
        { method: 'POST', url: '/smart-todo/accept' },
        { method: 'POST', url: '/smart-todo/transfer' },
      ]),
    )
  })

  it('maps analyze result type and multiple assigneeIds', async () => {
    vi.mocked(httpClient.request).mockResolvedValueOnce({
      data: {
        code: 200,
        msg: '操作成功',
        data: {
          task: '产品评审会',
          timeType: 1,
          startDateShow: '2026-06-12 10:00:00',
          assigneeIds: '1102080,1102081',
          type: 2,
          remark: '会议室A',
        },
      },
    })

    const parsed = await analyzeTodoText(
      '周五上午产品评审会',
      currentUser,
      [currentUser, { id: '1102081', name: '王五', role: 'employee' }],
      {
        date: '2026-06-09',
        title: '',
      },
    )

    expect(parsed).toMatchObject({
      title: '产品评审会',
      assigneeId: '1102080,1102081',
      assigneeName: '李四、王五',
      type: 2,
    })
  })

  it('maps analyze result assigneeId by name to assignable user id', async () => {
    vi.mocked(httpClient.request).mockResolvedValueOnce({
      data: {
        code: 200,
        msg: '操作成功',
        data: {
          task: '开会',
          timeType: 'deadline',
          date: '',
          time: '',
          startDate: '2026-07-03 15:17',
          endDate: '2026-07-03 17:15',
          assigneeId: '徐逸臣',
          remark: '',
          type: 2,
        },
      },
    })

    const parsed = await analyzeTodoText(
      '下午让徐逸臣开会',
      currentUser,
      [currentUser, { id: '1102999', name: '徐逸臣', role: 'employee' }],
      {
        date: '2026-07-03',
        title: '',
      },
    )

    expect(parsed).toMatchObject({
      title: '开会',
      assigneeId: '1102999',
      assigneeName: '徐逸臣',
      type: 2,
    })
  })

  it('sends assigneeIds and meeting type when creating todos', async () => {
    vi.mocked(httpClient.request).mockImplementation((config) => {
      if (config.url === '/smart-todo/create') {
        expect(config.data).toMatchObject({
          title: '',
          content: '产品评审会',
          assigneeIds: '1102080,1102081',
          type: 2,
        })
        return backendResponse(458) as never
      }

      return backendResponse(true) as never
    })

    await expect(
      createTodo({
        date: '2026-06-07',
        time: '10:00',
        title: '产品评审会',
        assigneeId: '1102080,1102081',
        type: 2,
      }),
    ).resolves.toBe(458)
  })

  it('uses original ai prompt as title when creating todos parsed from natural language', async () => {
    vi.mocked(httpClient.request).mockImplementation((config) => {
      if (config.url === '/smart-todo/create') {
        expect(config.data).toMatchObject({
          title: '明天下午5点项目复盘',
          content: '项目复盘',
          timeType: 1,
          startDateShow: '2026-06-07 17:00:00',
        })
        return backendResponse(459) as never
      }

      return backendResponse(true) as never
    })

    await expect(
      createTodo({
        date: '2026-06-07',
        time: '17:00',
        title: '项目复盘',
        aiPrompt: '明天下午5点项目复盘',
        assigneeId: '1102080',
        type: 1,
      }),
    ).resolves.toBe(459)
  })

  it('maps analyze result with date and time fields for specific_time', async () => {
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
      '这周五上午九点在317开部门会议',
      currentUser,
      assignableUsers,
      {
        date: '2026-06-02',
        endDate: '2026-06-02',
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

  it('keeps timeType=1 analyze result in scheduled mode without fallback endDate', async () => {
    vi.mocked(httpClient.request).mockResolvedValueOnce({
      data: {
        code: 200,
        msg: '操作成功',
        data: {
          task: '开部门会议',
          timeType: 1,
          startDateShow: '2026-06-12 09:00:00',
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

  it('maps timeType=deadline analyze result with startDate and endDate datetime fields', async () => {
    vi.mocked(httpClient.request).mockResolvedValueOnce({
      data: {
        code: 200,
        msg: '操作成功',
        data: {
          task: '开发官网',
          timeType: 'deadline',
          date: '',
          time: '',
          startDate: '2026-06-15 08:45',
          endDate: '2026-06-15 17:15',
          assigneeId: '',
          remark: '',
        },
      },
    })

    const parsed = await analyzeTodoText(
      '今天8点45到17点15开发官网',
      currentUser,
      assignableUsers,
      {
        date: '2026-06-09',
        title: '',
      },
    )

    expect(parsed).toMatchObject({
      mode: 'deadline',
      date: '2026-06-15',
      time: '08:45',
      endDate: '2026-06-15',
      endTime: '17:15',
      title: '开发官网',
    })
  })

  it('maps timeType=2 analyze result to deadline mode with startDateShow and endDateShow', async () => {
    vi.mocked(httpClient.request).mockResolvedValueOnce({
      data: {
        code: 200,
        msg: '操作成功',
        data: {
          task: '季度总结',
          timeType: 2,
          startDateShow: '2026-06-01 00:00:00',
          endDateShow: '2026-06-30 23:59:59',
          assigneeId: '1102080',
          remark: '',
        },
      },
    })

    const parsed = await analyzeTodoText('本月完成季度总结', currentUser, assignableUsers, {
      date: '2026-06-09',
      title: '',
    })

    expect(parsed).toMatchObject({
      mode: 'deadline',
      date: '2026-06-01',
      time: '00:00',
      endDate: '2026-06-30',
      endTime: '23:59',
      title: '季度总结',
    })
  })

  it('sends startDateShow and endDateShow when saving deadline todos', async () => {
    vi.mocked(httpClient.request).mockImplementation((config) => {
      if (config.url === '/smart-todo/create') {
        expect(config.data).toMatchObject({
          title: '',
          content: '季度总结',
          timeType: 2,
          startDateShow: '2026-06-01 00:00:00',
          endDateShow: '2026-06-30 23:59:59',
          assigneeIds: '1102080',
          type: 1,
        })
        return backendResponse(456) as never
      }

      return backendResponse(true) as never
    })

    await expect(
      createTodo({
        date: '2026-06-01',
        endDate: '2026-06-30',
        title: '季度总结',
        assigneeId: '1102080',
      }),
    ).resolves.toBe(456)
  })

  it('sends selected start and end times when saving deadline todos with time', async () => {
    vi.mocked(httpClient.request).mockImplementation((config) => {
      if (config.url === '/smart-todo/create') {
        expect(config.data).toMatchObject({
          title: '',
          content: '季度总结',
          timeType: 2,
          startDateShow: '2026-06-01 09:00:00',
          endDateShow: '2026-06-30 18:30:00',
          assigneeIds: '1102080',
          type: 1,
        })
        return backendResponse(457) as never
      }

      return backendResponse(true) as never
    })

    await expect(
      createTodo({
        date: '2026-06-01',
        endDate: '2026-06-30',
        time: '09:00',
        endTime: '18:30',
        title: '季度总结',
        assigneeId: '1102080',
      }),
    ).resolves.toBe(457)
  })

  it('calls sync-calendar to sync mailbox schedules', async () => {
    vi.mocked(httpClient.request).mockImplementation((config) => {
      if (config.url === '/smart-todo/sync-calendar') {
        expect(config.method).toBe('POST')
        return backendResponse(true) as never
      }

      return backendResponse(true) as never
    })

    await expect(syncCalendar()).resolves.toBe(true)
  })

  it('preserves midnight start time for deadline todos from backend list', async () => {
    vi.mocked(httpClient.request).mockImplementation((config) => {
      if (config.url === '/smart-todo/month-list') {
        return backendResponse([
          {
            id: 2,
            title: '11',
            timeType: 2,
            startDateShow: '2026-06-11 00:00:00',
            endDateShow: '2026-06-27 23:59:59',
            status: 3,
            assigneeId: '1102080',
            creatorId: '1102080',
          },
        ]) as never
      }

      return backendResponse(true) as never
    })

    await expect(loadTodos(currentUser, assignableUsers)).resolves.toMatchObject([
      {
        id: '2',
        date: '2026-06-11',
        time: '00:00',
        endDate: '2026-06-27',
        endTime: '23:59',
      },
    ])
  })

  it('dedupes parent and child todos returned together from month-list', async () => {
    const creator: CalendarUser = {
      id: '1110691',
      name: '田坤坤',
      role: 'employee',
    }

    vi.mocked(httpClient.request).mockImplementation((config) => {
      if (config.url === '/smart-todo/month-list') {
        return backendResponse([
          {
            id: 100,
            title: '',
            timeType: 1,
            startDateShow: '2026-07-16 11:20:00',
            content: '跟进需求',
            assigneeIds: '1102080',
            creatorId: '1110691',
            status: 0,
            fid: null,
            type: 1,
          },
          {
            id: 101,
            title: '',
            timeType: 1,
            startDateShow: '2026-07-16 11:20:00',
            content: '跟进需求',
            assigneeIds: '1102080',
            creatorId: '1110691',
            status: 0,
            fid: 100,
            type: 1,
          },
        ]) as never
      }

      return backendResponse(true) as never
    })

    const events = await loadTodos(creator, assignableUsers)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      id: '100',
      title: '跟进需求',
      content: '跟进需求',
      scope: 'assigned_by_me',
    })
  })

  it('merges child assignees into parent so dispatched todos show assigned_by_me scope', async () => {
    const creator: CalendarUser = {
      id: '1110691',
      name: '田坤坤',
      role: 'employee',
    }

    vi.mocked(httpClient.request).mockImplementation((config) => {
      if (config.url === '/smart-todo/month-list') {
        return backendResponse([
          {
            id: 100,
            title: '',
            timeType: 1,
            startDateShow: '2026-07-10 09:15:00',
            content: '11',
            assigneeIds: '1110691',
            creatorId: '1110691',
            status: 0,
            fid: null,
            type: 1,
          },
          {
            id: 101,
            title: '',
            timeType: 1,
            startDateShow: '2026-07-10 09:15:00',
            content: '11',
            assigneeIds: '1102999',
            creatorId: '1110691',
            handlerId: '1102999',
            status: 0,
            receiveStatus: 2,
            fid: 100,
            type: 1,
          },
        ]) as never
      }

      return backendResponse(true) as never
    })

    const events = await loadTodos(creator, [
      { id: '1102999', name: '徐逸臣', role: 'employee' },
    ])
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      id: '100',
      scope: 'assigned_by_me',
      assigneeId: '1110691,1102999',
    })
  })

  it('infers assigned_by_me when list item lacks creatorId but assignee is someone else', async () => {
    const creator: CalendarUser = {
      id: '1110691',
      name: '田坤坤',
      role: 'employee',
    }

    vi.mocked(httpClient.request).mockImplementation((config) => {
      if (config.url === '/smart-todo/month-list') {
        return backendResponse([
          {
            id: 100,
            title: '11',
            timeType: 1,
            startDateShow: '2026-07-10 09:15:00',
            content: '11',
            assigneeIds: '1102999',
            status: 0,
            type: 1,
          },
        ]) as never
      }

      return backendResponse(true) as never
    })

    await expect(
      loadTodos(creator, [{ id: '1102999', name: '徐逸臣', role: 'employee' }]),
    ).resolves.toMatchObject([
      {
        id: '100',
        scope: 'assigned_by_me',
      },
    ])
  })

  it('keeps child todo when parent is absent from month-list', async () => {
    vi.mocked(httpClient.request).mockImplementation((config) => {
      if (config.url === '/smart-todo/month-list') {
        return backendResponse([
          {
            id: 101,
            title: '',
            timeType: 1,
            startDateShow: '2026-07-16 11:20:00',
            content: '跟进需求',
            assigneeIds: '1102080',
            creatorId: '1110691',
            handlerId: '1102080',
            status: 0,
            fid: 100,
            type: 1,
          },
        ]) as never
      }

      return backendResponse(true) as never
    })

    await expect(loadTodos(currentUser, assignableUsers)).resolves.toMatchObject([
      {
        id: '101',
        title: '跟进需求',
        content: '跟进需求',
      },
    ])
  })

  it('loads todo detail with child todos for assignee progress', async () => {
    vi.mocked(httpClient.request).mockImplementation((config) => {
      if (config.url === '/smart-todo/100' && config.method === 'GET') {
        return backendResponse({
          mainTodo: {
            id: 100,
            title: '',
            timeType: 1,
            startDateShow: '2026-07-16 11:20:00',
            content: '跟进需求',
            assigneeIds: '1102080,1102081',
            creatorId: '1110691',
            status: 0,
            type: 1,
          },
          childTodoList: [
            {
              id: 101,
              title: '',
              timeType: 1,
              startDateShow: '2026-07-16 11:20:00',
              content: '跟进需求',
              assigneeIds: '1102080',
              creatorId: '1110691',
              handlerId: '1102080',
              status: 6,
              receiveStatus: 1,
              fid: 100,
              type: 1,
            },
            {
              id: 102,
              title: '',
              timeType: 1,
              startDateShow: '2026-07-16 11:20:00',
              content: '跟进需求',
              assigneeIds: '1102081',
              creatorId: '1110691',
              handlerId: '1102081',
              status: 0,
              receiveStatus: 2,
              fid: 100,
              type: 1,
            },
          ],
        }) as never
      }

      return backendResponse(true) as never
    })

    await expect(
      loadTodoDetail('100', { id: '1110691', name: '田坤坤', role: 'employee' }, [
        { id: '1102080', name: '李四', role: 'employee' },
        { id: '1102081', name: '王五', role: 'employee' },
      ]),
    ).resolves.toMatchObject({
      id: '100',
      childTodos: [
        { id: '101', handlerName: '李四' },
        { id: '102', handlerName: '王五' },
      ],
    })
  })

  it('loads month-list with startDate and endDate query params', async () => {
    vi.mocked(httpClient.request).mockImplementation(async (config) => {
      if (config.url === '/smart-todo/month-list') {
        expect(config.params).toEqual({
          startDate: '2026-05-01',
          endDate: '2026-05-31',
        })
        return backendResponse([]) as never
      }

      return backendResponse(true) as never
    })

    await loadTodos(currentUser, assignableUsers, {
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    })
  })

  it('filters malformed backend todos and falls back to content for the title', async () => {
    vi.mocked(httpClient.request).mockResolvedValueOnce(
      backendResponse([
        {
          title: '缺少 ID',
          startDateShow: '2026-07-01 09:00:00',
        },
        {
          id: 2,
          title: '非法日期',
          startDateShow: '2026-02-30 09:00:00',
        },
        {
          id: 3,
          title: '',
          content: '来自内容字段的标题',
          startDateShow: '2026-07-03 09:00:00',
        },
      ]) as never,
    )

    await expect(loadTodos(currentUser, assignableUsers)).resolves.toMatchObject([
      {
        id: '3',
        date: '2026-07-03',
        title: '来自内容字段的标题',
      },
    ])
  })

  it('builds month and week date ranges for calendar loading', () => {
    expect(getTodoMonthRange(new Date(2026, 4, 15))).toEqual({
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    })
    expect(getTodoWeekRange('2026-06-10')).toEqual({
      startDate: '2026-06-08',
      endDate: '2026-06-14',
    })
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

  it('normalizes rejected todos from month-list with read-only permissions', async () => {
    vi.mocked(httpClient.request).mockResolvedValueOnce(
      backendResponse([
        {
          id: 456,
          title: '被拒绝的任务',
          timeType: 1,
          startDateShow: '2026-06-07 17:00:00',
          status: 9,
          assigneeId: '1102081',
          creatorId: '1102080',
          creatorName: '李四',
          handleDesc: '时间冲突',
        },
      ]) as never,
    )

    await expect(loadTodos(currentUser, assignableUsers)).resolves.toMatchObject([
      {
        id: '456',
        backendStatus: 9,
        handleDesc: '时间冲突',
        editable: false,
        completable: false,
        status: 'todo',
      },
    ])
  })

  it('filters rejected todos out of pending inbox list', async () => {
    vi.mocked(httpClient.request).mockResolvedValueOnce(
      backendResponse([
        {
          id: 123,
          title: '待接受任务',
          timeType: 1,
          startDateShow: '2026-06-07 17:00:00',
          status: 0,
          assigneeId: '1102080',
          creatorId: '1101001',
          receiveStatus: 2,
        },
        {
          id: 456,
          title: '已拒绝任务',
          timeType: 1,
          startDateShow: '2026-06-07 18:00:00',
          status: 9,
          assigneeId: '1102080',
          creatorId: '1101001',
          handleDesc: '时间冲突',
        },
      ]) as never,
    )

    await expect(loadPendingTodos(currentUser, assignableUsers)).resolves.toMatchObject([
      { id: '123', backendStatus: 0 },
    ])
  })
})
