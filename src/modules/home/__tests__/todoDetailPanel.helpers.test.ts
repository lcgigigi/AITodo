import { describe, expect, it } from 'vitest'
import {
  buildAssigneeProgressBreakdown,
  buildTodoDetailPanelViewModel,
  buildDispatchProgressSummary,
  canAddTodoProcess,
  formatAssigneeProgressBreakdownText,
  isPendingAcceptanceTask,
  mergeCalendarEventWithDetail,
  resolveProgressTargetTodo,
} from '../dashboard/helpers/todoDetailPanel.helpers'
import type { CalendarEvent, CalendarUser } from '../dashboard/config/types'

const creator: CalendarUser = {
  id: '1110691',
  name: '田坤坤',
  role: 'employee',
}

const assignee: CalendarUser = {
  id: '1102080',
  name: '李四',
  role: 'employee',
}

function buildTask(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: '100',
    date: '2026-07-16',
    time: '11:20',
    title: '跟进需求',
    type: 'task',
    owner: '李四、王五',
    status: 'todo',
    creatorId: '1110691',
    creatorName: '田坤坤',
    assigneeId: '1102080,1102081',
    assigneeName: '李四、王五',
    scope: 'assigned_by_me',
    backendStatus: 0,
    childTodos: [
      {
        id: '101',
        date: '2026-07-16',
        time: '11:20',
        title: '跟进需求',
        type: 'task',
        owner: '李四',
        status: 'done',
        creatorId: '1110691',
        assigneeId: '1102080',
        currentHandlerId: '1102080',
        handlerName: '李四',
        backendStatus: 6,
        lastProcess: '联调已完成',
      },
      {
        id: '102',
        date: '2026-07-16',
        time: '11:20',
        title: '跟进需求',
        type: 'task',
        owner: '王五',
        status: 'todo',
        creatorId: '1110691',
        assigneeId: '1102081',
        currentHandlerId: '1102081',
        handlerName: '王五',
        backendStatus: 3,
        receiveStatus: 1,
        lastProcess: '正在测试验证',
      },
    ],
    ...overrides,
  }
}

describe('buildTodoDetailPanelViewModel assignee progress', () => {
  it('shows rejection note when dispatched todo is rejected with a reason', () => {
    const panel = buildTodoDetailPanelViewModel(
      buildTask({
        backendStatus: 9,
        status: 'todo',
        childTodos: undefined,
        handleDesc: '不想干了我要辞职',
      }),
      creator,
    )

    expect(panel.rejectionNote).toBe('拒绝原因：不想干了我要辞职')
    expect(panel.statusLabel).toBe('已拒绝')
    expect(panel.statusTone).toBe('rejected')
  })

  it('shows assignee progress for creator and hides single receiver field', () => {
    const panel = buildTodoDetailPanelViewModel(buildTask(), creator)

    expect(panel.meta.some((item) => item.key === 'receiver')).toBe(false)
    expect(panel.statusLabel).toBe('1/2 已完成')
    expect(panel.statusTone).toBe('accepted')
    expect(panel.assigneeProgressBreakdown).toEqual({
      total: 2,
      text: '1 已接受 · 1 已完成',
      segments: [
        { label: '已接受', count: 1, tone: 'accepted' },
        { label: '已完成', count: 1, tone: 'done' },
      ],
    })
    expect(panel.assigneeProgress).toEqual([
      {
        id: '102',
        name: '王五',
        statusLabel: '已接受',
        statusTone: 'accepted',
        lastProcess: '正在测试验证',
      },
      {
        id: '101',
        name: '李四',
        statusLabel: '已完成',
        statusTone: 'done',
        lastProcess: '联调已完成',
      },
    ])
  })

  it('summarizes mixed child todo progress for header badge', () => {
    expect(buildDispatchProgressSummary(buildTask().childTodos ?? [])).toEqual({
      label: '1/2 已完成',
      tone: 'accepted',
    })
  })

  it('builds assignee progress breakdown for mixed child todo statuses', () => {
    expect(buildAssigneeProgressBreakdown(buildTask().childTodos ?? [])).toEqual({
      total: 2,
      text: '1 已接受 · 1 已完成',
      segments: [
        { label: '已接受', count: 1, tone: 'accepted' },
        { label: '已完成', count: 1, tone: 'done' },
      ],
    })
  })

  it('orders breakdown segments by workflow priority and omits zero counts', () => {
    const breakdown = buildAssigneeProgressBreakdown([
      {
        id: '201',
        date: '2026-07-16',
        time: '11:20',
        title: '跟进需求',
        type: 'task',
        owner: 'A',
        status: 'todo',
        assigneeId: '1',
        backendStatus: 0,
        receiveStatus: 2,
      },
      {
        id: '202',
        date: '2026-07-16',
        time: '11:20',
        title: '跟进需求',
        type: 'task',
        owner: 'B',
        status: 'todo',
        assigneeId: '2',
        backendStatus: 3,
      },
      {
        id: '203',
        date: '2026-07-16',
        time: '11:20',
        title: '跟进需求',
        type: 'task',
        owner: 'C',
        status: 'done',
        assigneeId: '3',
        backendStatus: 6,
      },
      {
        id: '204',
        date: '2026-07-16',
        time: '11:20',
        title: '跟进需求',
        type: 'task',
        owner: 'D',
        status: 'todo',
        assigneeId: '4',
        backendStatus: 9,
      },
    ])

    expect(breakdown.total).toBe(4)
    expect(breakdown.segments).toEqual([
      { label: '待接受', count: 1, tone: 'pending' },
      { label: '已接受', count: 1, tone: 'accepted' },
      { label: '已完成', count: 1, tone: 'done' },
      { label: '已拒绝', count: 1, tone: 'rejected' },
    ])
    expect(breakdown.text).toBe('1 待接受 · 1 已接受 · 1 已完成 · 1 已拒绝')
    expect(formatAssigneeProgressBreakdownText(breakdown.segments)).toBe(breakdown.text)
  })

  it('collapses same-status assignees into one breakdown segment', () => {
    const breakdown = buildAssigneeProgressBreakdown([
      {
        id: '301',
        date: '2026-07-16',
        time: '11:20',
        title: '跟进需求',
        type: 'task',
        owner: 'A',
        status: 'todo',
        assigneeId: '1',
        backendStatus: 3,
      },
      {
        id: '302',
        date: '2026-07-16',
        time: '11:20',
        title: '跟进需求',
        type: 'task',
        owner: 'B',
        status: 'todo',
        assigneeId: '2',
        backendStatus: 3,
      },
      {
        id: '303',
        date: '2026-07-16',
        time: '11:20',
        title: '跟进需求',
        type: 'task',
        owner: 'C',
        status: 'todo',
        assigneeId: '3',
        backendStatus: 9,
      },
    ])

    expect(breakdown).toEqual({
      total: 3,
      text: '2 已接受 · 1 已拒绝',
      segments: [
        { label: '已接受', count: 2, tone: 'accepted' },
        { label: '已拒绝', count: 1, tone: 'rejected' },
      ],
    })
  })

  it('returns empty breakdown for empty child todo list', () => {
    expect(buildAssigneeProgressBreakdown([])).toEqual({
      total: 0,
      text: '',
      segments: [],
    })
  })

  it('shows process section for accepted handler and hides it for dispatch creator', () => {
    const handlerPanel = buildTodoDetailPanelViewModel(
      buildTask({
        scope: 'assigned_to_me',
        assigneeId: '1102080',
        currentHandlerId: '1102080',
        backendStatus: 3,
        childTodos: undefined,
        processList: [
          {
            processId: '10001',
            todoId: '100',
            todoProcess: '正在联调',
            creatorId: '1102080',
            createTime: '2026-07-14T09:30:00',
            updateTime: '2026-07-14T09:30:00',
          },
        ],
      }),
      assignee,
      [assignee],
    )

    expect(handlerPanel.processSection).toMatchObject({
      targetTodoId: '100',
      canAdd: true,
      items: [
        expect.objectContaining({
          processId: '10001',
          todoProcess: '正在联调',
          editable: true,
        }),
      ],
    })

    const creatorPanel = buildTodoDetailPanelViewModel(buildTask(), creator, [assignee])
    expect(creatorPanel.processSection).toBeUndefined()
    expect(creatorPanel.assigneeProgress?.[0].lastProcess).toBe('正在测试验证')
  })

  it('resolves child todo as progress target for dispatched assignee', () => {
    const task = buildTask({ scope: 'assigned_to_me', assigneeId: '1102080,1102081' })
    const target = resolveProgressTargetTodo(task, assignee)

    expect(target?.id).toBe('101')
    expect(canAddTodoProcess(task, assignee)).toBe(false)

    const acceptedTask = buildTask({
      childTodos: task.childTodos?.map((child) =>
        child.id === '101' ? { ...child, backendStatus: 3 } : child,
      ),
    })
    expect(canAddTodoProcess(acceptedTask, assignee)).toBe(true)
  })

  it('preserves child todos when merging list item with cached detail', () => {
    const listEvent = buildTask({ title: '列表标题' })
    const cachedDetail = buildTask({ title: '详情标题' })

    expect(mergeCalendarEventWithDetail(listEvent, cachedDetail)).toMatchObject({
      title: '列表标题',
      childTodos: cachedDetail.childTodos,
    })
  })

  it('preserves process list and last process when merging list item with cached detail', () => {
    const listEvent = buildTask({ title: '列表标题', status: 'done', backendStatus: 6 })
    const cachedDetail = buildTask({
      title: '详情标题',
      lastProcess: '第二次进展',
      processList: [
        {
          processId: '10001',
          todoId: '100',
          todoProcess: '第一次进展',
          creatorId: '1102080',
          createTime: '2026-07-14T09:30:00',
          updateTime: '2026-07-14T09:30:00',
        },
        {
          processId: '10002',
          todoId: '100',
          todoProcess: '第二次进展',
          creatorId: '1102080',
          createTime: '2026-07-14T10:30:00',
          updateTime: '2026-07-14T10:30:00',
        },
      ],
    })

    expect(mergeCalendarEventWithDetail(listEvent, cachedDetail)).toMatchObject({
      title: '列表标题',
      status: 'done',
      lastProcess: '第二次进展',
      processList: [
        expect.objectContaining({ processId: '10001' }),
        expect.objectContaining({ processId: '10002' }),
      ],
    })
  })

  it('shows full process history for dispatch creator in assignee progress', () => {
    const panel = buildTodoDetailPanelViewModel(
      buildTask({
        childTodos: [
          {
            id: '101',
            date: '2026-07-16',
            time: '11:20',
            title: '跟进需求',
            type: 'task',
            owner: '李四',
            status: 'todo',
            creatorId: '1110691',
            assigneeId: '1102080',
            currentHandlerId: '1102080',
            handlerName: '李四',
            backendStatus: 3,
            lastProcess: '第二次进展',
            processList: [
              {
                processId: '10001',
                todoId: '101',
                todoProcess: '第一次进展',
                creatorId: '1102080',
                createTime: '2026-07-14T09:30:00',
                updateTime: '2026-07-14T09:30:00',
              },
              {
                processId: '10002',
                todoId: '101',
                todoProcess: '第二次进展',
                creatorId: '1102080',
                createTime: '2026-07-14T10:30:00',
                updateTime: '2026-07-14T10:30:00',
              },
            ],
          },
        ],
      }),
      creator,
      [assignee],
    )

    expect(panel.assigneeProgress?.[0].processHistory).toEqual([
      {
        processId: '10001',
        todoProcess: '第一次进展',
        createTime: '2026-07-14 09:30',
      },
      {
        processId: '10002',
        todoProcess: '第二次进展',
        createTime: '2026-07-14 10:30',
      },
    ])
  })

  it('does not show assignee progress for assignee viewer', () => {
    const panel = buildTodoDetailPanelViewModel(buildTask({ scope: 'assigned_to_me' }), assignee)

    expect(panel.assigneeProgress).toBeUndefined()
    expect(panel.assigneeProgressBreakdown).toBeUndefined()
    expect(panel.meta).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'receiver', label: '接受人' })]),
    )
  })

  it('uses handler fields for receiver display in detail panel', () => {
    const panel = buildTodoDetailPanelViewModel(
      buildTask({
        scope: 'assigned_to_me',
        assigneeId: '1110691',
        assigneeName: '田坤坤',
        currentHandlerId: '1102080',
        handlerName: '徐逸臣',
      }),
      assignee,
      [assignee],
    )

    expect(panel.meta).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'receiver', label: '接受人', value: '徐逸臣' }),
      ]),
    )
  })

  it('uses content as the detail title and keeps remark as the detail description', () => {
    expect(
      buildTodoDetailPanelViewModel(buildTask({ content: '下午 3 点开会' }), creator).title,
    ).toBe('下午 3 点开会')
    expect(
      buildTodoDetailPanelViewModel(buildTask({ content: '会议室 317' }), creator).content,
    ).toBe('会议室 317')
    expect(
      buildTodoDetailPanelViewModel(buildTask({ content: '会议室 317' }), creator)
        .contentIsEmpty,
    ).toBe(false)
    expect(buildTodoDetailPanelViewModel(buildTask({ content: '' }), creator).content).toBe('暂无内容')
    expect(
      buildTodoDetailPanelViewModel(buildTask({ content: '' }), creator).contentIsEmpty,
    ).toBe(true)
    expect(buildTodoDetailPanelViewModel(buildTask({ content: '   ' }), creator).content).toBe(
      '暂无内容',
    )
    expect(
      buildTodoDetailPanelViewModel(buildTask({ remark: '会议室 317' }), creator).remark,
    ).toBe('会议室 317')
    expect(
      buildTodoDetailPanelViewModel(buildTask({ remark: '' }), creator).remark,
    ).toBe('暂无备注')
  })
})

describe('isPendingAcceptanceTask', () => {
  it('returns true only when assignee still needs to accept', () => {
    expect(
      isPendingAcceptanceTask(
        buildTask({
          scope: 'assigned_to_me',
          assigneeId: '1102080',
          receiveStatus: 2,
        }),
        assignee,
      ),
    ).toBe(true)
  })

  it('returns false for deleted, rejected, or already accepted todos', () => {
    expect(
      isPendingAcceptanceTask(
        buildTask({ scope: 'assigned_to_me', assigneeId: '1102080', backendStatus: 99 }),
        assignee,
      ),
    ).toBe(false)
    expect(
      isPendingAcceptanceTask(
        buildTask({ scope: 'assigned_to_me', assigneeId: '1102080', backendStatus: 9 }),
        assignee,
      ),
    ).toBe(false)
    expect(
      isPendingAcceptanceTask(
        buildTask({
          scope: 'assigned_to_me',
          assigneeId: '1102080',
          receiveStatus: 1,
          backendStatus: 3,
        }),
        assignee,
      ),
    ).toBe(false)
  })

  it('does not treat assigned_to_me scope alone as pending acceptance', () => {
    expect(
      isPendingAcceptanceTask(
        buildTask({ scope: 'assigned_to_me', assigneeId: '1102080', backendStatus: 0 }),
        assignee,
      ),
    ).toBe(false)
  })
})
