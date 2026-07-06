import { describe, expect, it } from 'vitest'
import {
  collectTrendDates,
  resolveTokenUsageDateRange,
  sumDailyTokenUsage,
} from './token-usage.helpers'

describe('token-usage.helpers', () => {
  const referenceDate = new Date(2026, 6, 3)

  it('resolves today as a single-day range', () => {
    expect(resolveTokenUsageDateRange('today', referenceDate)).toEqual({
      startDate: '2026-07-03',
      endDate: '2026-07-03',
    })
  })

  it('resolves last7Days as an inclusive 7-day range ending today', () => {
    expect(resolveTokenUsageDateRange('last7Days', referenceDate)).toEqual({
      startDate: '2026-06-27',
      endDate: '2026-07-03',
    })
  })

  it('resolves last30Days as an inclusive 30-day range ending today', () => {
    expect(resolveTokenUsageDateRange('last30Days', referenceDate)).toEqual({
      startDate: '2026-06-04',
      endDate: '2026-07-03',
    })
  })

  it('sums only the trailing days for a selected period', () => {
    const dailyList = [
      { usageDate: '2026-07-01', tokenUsage: 100 },
      { usageDate: '2026-07-02', tokenUsage: 200 },
      { usageDate: '2026-07-03', tokenUsage: 300 },
    ]

    expect(sumDailyTokenUsage(dailyList, 'today')).toBe(300)
    expect(sumDailyTokenUsage(dailyList, 'last7Days')).toBe(600)
    expect(collectTrendDates([dailyList], 'today')).toEqual(['2026-07-03'])
  })
})
