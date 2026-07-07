import { describe, expect, it } from 'vitest'
import {
  collectDatesInRange,
  collectTrendDates,
  getMonthDateRange,
  getYearDateRange,
  isDateInRange,
  resolveTokenUsageDateRange,
  sumDailyInRange,
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

  it('resolves month and year date ranges', () => {
    expect(getMonthDateRange('2026-07')).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    })
    expect(getYearDateRange(2026)).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    })
  })

  it('filters daily usage by explicit date range', () => {
    const dailyList = [
      { usageDate: '2026-06-30', tokenUsage: 50 },
      { usageDate: '2026-07-01', tokenUsage: 100 },
      { usageDate: '2026-07-02', tokenUsage: 200 },
      { usageDate: '2026-08-01', tokenUsage: 300 },
    ]
    const range = getMonthDateRange('2026-07')

    expect(sumDailyInRange(dailyList, range)).toBe(300)
    expect(collectDatesInRange([dailyList], range)).toEqual(['2026-07-01', '2026-07-02'])
    expect(isDateInRange('2026-07-01', range)).toBe(true)
    expect(isDateInRange('2026-06-30', range)).toBe(false)
  })
})
