import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from './types'
import {
  isCompletedTodoEvent,
  isOtherStatusTodoEvent,
  isPendingProcessTodoEvent,
  matchesDetailStatusFilter,
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
  it('groups active work into pending', () => {
    expect(isPendingProcessTodoEvent(event({ backendStatus: 0 }))).toBe(true)
    expect(isPendingProcessTodoEvent(event({ backendStatus: 3, receiveStatus: 1 }))).toBe(true)
    expect(isPendingProcessTodoEvent(event({ backendStatus: 6, status: 'done' }))).toBe(false)
  })

  it('groups collaboration and edge states into other', () => {
    expect(isOtherStatusTodoEvent(event({ receiveStatus: 2 }))).toBe(true)
    expect(isOtherStatusTodoEvent(event({ backendStatus: 9 }))).toBe(true)
    expect(isOtherStatusTodoEvent(event({ backendStatus: 0 }))).toBe(false)
  })

  it('matches the four filter tabs without overlap', () => {
    const pending = event({ backendStatus: 0 })
    const accepted = event({ backendStatus: 3, receiveStatus: 1 })
    const done = event({ backendStatus: 6, status: 'done' })
    const rejected = event({ backendStatus: 9 })

    expect(matchesDetailStatusFilter(pending, 'pending')).toBe(true)
    expect(matchesDetailStatusFilter(accepted, 'pending')).toBe(true)
    expect(matchesDetailStatusFilter(done, 'done')).toBe(true)
    expect(isCompletedTodoEvent(done)).toBe(true)
    expect(matchesDetailStatusFilter(rejected, 'other')).toBe(true)
    expect(matchesDetailStatusFilter(pending, 'all')).toBe(true)
  })
})
