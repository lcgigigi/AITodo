import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from './types'
import {
  getBackendTodoStatusLabel,
  getTodoScopeBadge,
  isCompletedTodoEvent,
  isOtherStatusTodoEvent,
  isPendingDetailStatusEvent,
  isPendingProcessTodoEvent,
  matchesDetailStatusFilter,
  matchesTodoScopeFilter,
  countTodoScopeEvents,
} from './todoDisplay'

function event(partial: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: '1',
    date: '2026-07-02',
    title: '测试',
    type: 'task',
    owner: 'me',
    status: 'todo',
    ...partial,
  }
}

describe('detail status filters', () => {
  it('derives status labels from backendStatus only', () => {
    expect(getBackendTodoStatusLabel(event({ backendStatus: 0 }))).toBe('待处理')
    expect(getBackendTodoStatusLabel(event({ backendStatus: 3 }))).toBe('已接受')
    expect(getBackendTodoStatusLabel(event({ backendStatus: 6 }))).toBe('已完成')
    expect(getBackendTodoStatusLabel(event({ backendStatus: 9 }))).toBe('已拒绝')
  })

  it('groups active work into pending', () => {
    expect(isPendingProcessTodoEvent(event({ backendStatus: 0 }))).toBe(true)
    expect(isPendingProcessTodoEvent(event({ backendStatus: 3 }))).toBe(true)
    expect(isPendingProcessTodoEvent(event({ backendStatus: 6, status: 'done' }))).toBe(false)
  })

  it('groups collaboration and edge states into other', () => {
    expect(isOtherStatusTodoEvent(event({ backendStatus: 9 }))).toBe(true)
    expect(isOtherStatusTodoEvent(event({ backendStatus: 0 }))).toBe(false)
  })

  it('groups pending work into pending detail status', () => {
    expect(isPendingDetailStatusEvent(event({ backendStatus: 0 }))).toBe(true)
    expect(isPendingDetailStatusEvent(event({ backendStatus: 3 }))).toBe(true)
    expect(isPendingDetailStatusEvent(event({ backendStatus: 9 }))).toBe(false)
  })

  it('matches the status sub-filters without overlap', () => {
    const pending = event({ backendStatus: 0 })
    const accepted = event({ backendStatus: 3 })
    const done = event({ backendStatus: 6, status: 'done' })
    const rejected = event({ backendStatus: 9 })

    expect(matchesDetailStatusFilter(pending, 'pending')).toBe(true)
    expect(matchesDetailStatusFilter(accepted, 'pending')).toBe(true)
    expect(matchesDetailStatusFilter(done, 'done')).toBe(true)
    expect(isCompletedTodoEvent(done)).toBe(true)
    expect(matchesDetailStatusFilter(rejected, 'rejected')).toBe(true)
    expect(matchesDetailStatusFilter(pending, 'all')).toBe(true)
  })
})

describe('todo scope filters', () => {
  it('matches assigned_by_me and assigned_to_me scopes', () => {
    const outgoing = event({ scope: 'assigned_by_me', assigneeName: '张三' })
    const incoming = event({ scope: 'assigned_to_me', creatorName: '李四' })
    const self = event({ scope: 'self' })

    expect(matchesTodoScopeFilter(outgoing, 'assigned_by_me')).toBe(true)
    expect(matchesTodoScopeFilter(incoming, 'assigned_to_me')).toBe(true)
    expect(matchesTodoScopeFilter(self, 'assigned_by_me')).toBe(false)
    expect(countTodoScopeEvents([outgoing, incoming, self], 'assigned_by_me')).toBe(1)
    expect(countTodoScopeEvents([outgoing, incoming, self], 'assigned_to_me')).toBe(1)
  })

  it('builds readable scope badges', () => {
    expect(
      getTodoScopeBadge(event({ scope: 'assigned_by_me', assigneeName: '张三', owner: '张三' })),
    ).toEqual({
      label: '我派发',
      tone: 'outgoing',
    })
    expect(getTodoScopeBadge(event({ scope: 'assigned_to_me', creatorName: '李四' }))).toEqual({
      label: '来自：李四',
      tone: 'incoming',
    })
    expect(getTodoScopeBadge(event({ scope: 'self' }))).toBeNull()
  })
})
