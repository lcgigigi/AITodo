import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../dashboard/config/types'
import { formatAiFocusTodoLabel, isWeakTodoTitle } from '../dashboard/helpers/todoDisplay'

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

describe('AI focus todo labels', () => {
  it('detects weak titles', () => {
    expect(isWeakTodoTitle('1')).toBe(true)
    expect(isWeakTodoTitle('  42  ')).toBe(true)
    expect(isWeakTodoTitle('')).toBe(true)
    expect(isWeakTodoTitle('A')).toBe(true)
    expect(isWeakTodoTitle('项目评审')).toBe(false)
    expect(isWeakTodoTitle('OK')).toBe(false)
  })

  it('keeps descriptive titles unchanged', () => {
    expect(formatAiFocusTodoLabel(event({ title: '项目评审会议' }))).toBe('「项目评审会议」')
  })

  it('enriches numeric meeting titles with time and type', () => {
    expect(
      formatAiFocusTodoLabel(
        event({
          title: '1',
          type: 'meeting',
          time: '14:00',
        }),
      ),
    ).toBe('14:00 的会议「1」')
  })

  it('enriches all-day tasks with assignee when available', () => {
    expect(
      formatAiFocusTodoLabel(
        event({
          title: '1',
          creatorId: 'u1',
          creatorName: '王经理',
          assigneeId: 'u2',
          assigneeName: '张三',
          scope: 'assigned_to_me',
        }),
      ),
    ).toBe('张三 的待办「1」')
  })

  it('falls back to all-day label when no time or assignee context exists', () => {
    expect(formatAiFocusTodoLabel(event({ title: '1', owner: '' }))).toBe('全天待办「1」')
  })
})
