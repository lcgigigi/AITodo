export function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}
