import { describe, expect, it } from 'vitest'
import {
  buildTodoDetailPanelViewModel,
  buildDispatchProgressSummary,
  isPendingAcceptanceTask,
  mergeCalendarEventWithDetail,
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
        handlerName: '李四',
        backendStatus: 6,
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
        handlerName: '王五',
        backendStatus: 0,
        receiveStatus: 2,
      },
    ],
    ...overrides,
  }
}

describe('buildTodoDetailPanelViewModel assignee progress', () => {
  it('shows assignee progress for creator and hides single receiver field', () => {
    const panel = buildTodoDetailPanelViewModel(buildTask(), creator)

    expect(panel.meta.some((item) => item.key === 'receiver')).toBe(false)
    expect(panel.statusLabel).toBe('1/2 已完成')
    expect(panel.statusTone).toBe('accepted')
    expect(panel.assigneeProgress).toEqual([
      {
        id: '102',
        name: '王五',
        statusLabel: '待接受',
        statusTone: 'pending',
      },
      {
        id: '101',
        name: '李四',
        statusLabel: '已完成',
        statusTone: 'done',
      },
    ])
  })

  it('summarizes mixed child todo progress for header badge', () => {
    expect(buildDispatchProgressSummary(buildTask().childTodos ?? [])).toEqual({
      label: '1/2 已完成',
      tone: 'accepted',
    })
  })

  it('preserves child todos when merging list item with cached detail', () => {
    const listEvent = buildTask({ title: '列表标题' })
    const cachedDetail = buildTask({ title: '详情标题' })

    expect(mergeCalendarEventWithDetail(listEvent, cachedDetail)).toMatchObject({
      title: '列表标题',
      childTodos: cachedDetail.childTodos,
    })
  })

  it('does not show assignee progress for assignee viewer', () => {
    const panel = buildTodoDetailPanelViewModel(buildTask({ scope: 'assigned_to_me' }), assignee)

    expect(panel.assigneeProgress).toBeUndefined()
    expect(panel.meta).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'receiver', label: '接受人' })]),
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
