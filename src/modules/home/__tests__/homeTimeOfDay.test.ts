import { describe, expect, it } from 'vitest'
import {
  getHomeTimePeriod,
  resolveHomeGreetingText,
  getNextHomeAmbienceChangeAt,
} from '../dashboard/helpers/homeTimeOfDay'

function at(iso: string) {
  return new Date(iso)
}

describe('homeTimeOfDay', () => {
  it('maps hours to the four background periods', () => {
    expect(getHomeTimePeriod(at('2026-07-02T08:00:00'))).toBe('morning')
    expect(getHomeTimePeriod(at('2026-07-02T12:00:00'))).toBe('noon')
    expect(getHomeTimePeriod(at('2026-07-02T15:00:00'))).toBe('afternoon')
    expect(getHomeTimePeriod(at('2026-07-02T20:00:00'))).toBe('night')
    expect(getHomeTimePeriod(at('2026-07-02T02:00:00'))).toBe('night')
  })

  it('keeps greeting text aligned with the same period rules', () => {
    expect(resolveHomeGreetingText(at('2026-07-02T08:00:00'))).toBe('早上好')
    expect(resolveHomeGreetingText(at('2026-07-02T12:00:00'))).toBe('中午好')
    expect(resolveHomeGreetingText(at('2026-07-02T15:00:00'))).toBe('下午好')
    expect(resolveHomeGreetingText(at('2026-07-02T20:00:00'))).toBe('晚上好')
    expect(resolveHomeGreetingText(at('2026-07-02T23:00:00'))).toBe('夜深了')
    expect(resolveHomeGreetingText(at('2026-07-05T10:00:00'))).toBe('周末好')
  })

  it('schedules the next ambience change at period boundaries', () => {
    expect(getNextHomeAmbienceChangeAt(at('2026-07-02T08:00:00')).toISOString()).toBe(
      at('2026-07-02T11:00:00').toISOString(),
    )
    expect(getNextHomeAmbienceChangeAt(at('2026-07-02T20:00:00')).toISOString()).toBe(
      at('2026-07-02T22:00:00').toISOString(),
    )
  })
})
