import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../dashboard/config/types'
import {
  compareCalendarDisplayEvents,
  compareCalendarRangeBarEvents,
  getActiveCalendarDisplayEvents,
} from '../dashboard/helpers/todoDisplay'

function event(partial: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: partial.id ?? '1',
    date: '2026-07-02',
    title: partial.title ?? '测试',
    type: 'task',
    owner: 'me',
    status: 'todo',
    ...partial,
  }
}

describe('calendar cell display helpers', () => {
  it('sorts pending items before completed and rejected', () => {
    const done = event({ id: 'done', backendStatus: 6, status: 'done', time: '08:00' })
    const rejected = event({ id: 'rejected', backendStatus: 9, time: '09:00' })
    const active = event({ id: 'active', time: '10:00' })

    expect(getActiveCalendarDisplayEvents([done, rejected, active]).map((item) => item.id)).toEqual(
      ['active', 'done', 'rejected'],
    )
  })

  it('sorts meetings first by time, then todos, then cross-day events last within each status group', () => {
    const crossDay = event({
      id: 'range',
      title: '跨天',
      endDate: '2026-07-04',
      time: '08:00',
    })
    const meetingLate = event({ id: 'meeting-late', type: 'meeting', time: '11:00', title: '晚会' })
    const meetingEarly = event({
      id: 'meeting-early',
      type: 'meeting',
      time: '09:00',
      title: '早会',
    })
    const timedTodo = event({ id: 'todo', time: '10:00', title: '待办' })
    const allDayTodo = event({ id: 'allday', title: '全天' })

    const sorted = getActiveCalendarDisplayEvents([
      crossDay,
      allDayTodo,
      timedTodo,
      meetingLate,
      meetingEarly,
    ])

    expect(sorted.map((item) => item.id)).toEqual([
      'meeting-early',
      'meeting-late',
      'todo',
      'allday',
      'range',
    ])
    expect(compareCalendarDisplayEvents(meetingEarly, meetingLate)).toBeLessThan(0)
    expect(compareCalendarDisplayEvents(timedTodo, crossDay)).toBeLessThan(0)
  })

  it('sorts cross-day bars by status first, then start time', () => {
    const later = event({
      id: 'later',
      title: '后',
      date: '2026-07-03',
      endDate: '2026-07-05',
      time: '10:00',
    })
    const earlier = event({
      id: 'earlier',
      title: '前',
      date: '2026-07-02',
      endDate: '2026-07-04',
      time: '09:00',
    })
    const doneEarlier = event({
      id: 'done-earlier',
      title: '已完成',
      date: '2026-07-01',
      endDate: '2026-07-03',
      backendStatus: 6,
      status: 'done',
      time: '08:00',
    })

    expect(compareCalendarRangeBarEvents(earlier, later)).toBeLessThan(0)
    expect(compareCalendarRangeBarEvents(earlier, doneEarlier)).toBeLessThan(0)
  })
})
