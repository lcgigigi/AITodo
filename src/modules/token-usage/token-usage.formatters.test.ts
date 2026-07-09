import { describe, expect, it } from 'vitest'
import { formatTokenCompact, formatTokenNumber } from './token-usage.formatters'

describe('token usage formatters', () => {
  it('formats rounded token totals with the Chinese locale', () => {
    expect(formatTokenNumber(1234.6)).toBe((1235).toLocaleString('zh-CN'))
  })

  it('formats compact token totals', () => {
    expect(formatTokenCompact(12_300)).toBe(
      new Intl.NumberFormat('zh-CN', {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(12_300),
    )
  })
})
