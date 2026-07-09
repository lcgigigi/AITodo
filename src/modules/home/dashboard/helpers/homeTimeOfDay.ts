export type HomeTimePeriod = 'morning' | 'noon' | 'afternoon' | 'night'

/** 与首页四张背景图（早 / 中 / 下午 / 晚）对齐的时段划分 */
export function getHomeTimePeriod(date: Date): HomeTimePeriod {
  const hour = date.getHours()

  if (hour >= 11 && hour < 14) return 'noon'
  if (hour >= 14 && hour < 18) return 'afternoon'
  if (hour >= 18 || hour < 6) return 'night'
  return 'morning'
}

export function resolveHomeGreetingText(date: Date): string {
  const hour = date.getHours()
  const isWeekend = date.getDay() === 0 || date.getDay() === 6
  const period = getHomeTimePeriod(date)

  if (period === 'night' && (hour >= 22 || hour < 5)) return '夜深了'
  if (isWeekend && period !== 'night') return '周末好'

  switch (period) {
    case 'morning':
      return '早上好'
    case 'noon':
      return '中午好'
    case 'afternoon':
      return '下午好'
    case 'night':
      return '晚上好'
  }
}

/** 问候语或背景图会发生变化的下一时刻（每天最多几次，用于精准调度） */
export function getNextHomeAmbienceChangeAt(date: Date): Date {
  const changeHours = [5, 6, 11, 14, 18, 22]
  const candidates = changeHours.map((hour) => {
    const next = new Date(date)
    next.setHours(hour, 0, 0, 0)
    if (next.getTime() <= date.getTime()) {
      next.setDate(next.getDate() + 1)
    }
    return next.getTime()
  })

  const nextMidnight = new Date(date)
  nextMidnight.setHours(0, 0, 0, 0)
  nextMidnight.setDate(nextMidnight.getDate() + 1)
  candidates.push(nextMidnight.getTime())

  return new Date(Math.min(...candidates))
}
