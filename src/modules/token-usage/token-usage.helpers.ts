export type TokenUsagePeriodCode = 'today' | 'last7Days' | 'last30Days' | string

export interface TokenUsageDateRange {
  startDate: string
  endDate: string
}

export interface TokenUsageDailyPoint {
  usageDate: string
  tokenUsage: number
}

const PERIOD_NAME_BY_CODE: Record<string, string> = {
  today: '今天',
  last7Days: '近7天',
  last30Days: '近30天',
}

export function formatTokenUsageDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getTokenUsagePeriodDayCount(periodCode: TokenUsagePeriodCode) {
  if (periodCode === 'today') return 1
  if (periodCode === 'last7Days') return 7
  return 30
}

export function getTokenUsagePeriodName(periodCode: TokenUsagePeriodCode) {
  return PERIOD_NAME_BY_CODE[periodCode] ?? String(periodCode)
}

export function resolveTokenUsageDateRange(
  periodCode: TokenUsagePeriodCode,
  referenceDate: Date = new Date(),
): TokenUsageDateRange {
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())
  const dayCount = getTokenUsagePeriodDayCount(periodCode)
  const start = new Date(end)
  start.setDate(start.getDate() - (dayCount - 1))

  return {
    startDate: formatTokenUsageDate(start),
    endDate: formatTokenUsageDate(end),
  }
}

export function collectTrendDates(
  dailyLists: TokenUsageDailyPoint[][],
  periodCode: TokenUsagePeriodCode,
) {
  const dates = new Set<string>()

  for (const dailyList of dailyLists) {
    for (const point of dailyList) {
      if (point.usageDate) dates.add(point.usageDate)
    }
  }

  return [...dates].sort().slice(-getTokenUsagePeriodDayCount(periodCode))
}

export function sumDailyTokenUsage(
  dailyList: TokenUsageDailyPoint[],
  periodCode: TokenUsagePeriodCode,
) {
  const selectedDates = new Set(collectTrendDates([dailyList], periodCode))

  return dailyList
    .filter((point) => selectedDates.has(point.usageDate))
    .reduce((sum, point) => sum + point.tokenUsage, 0)
}
