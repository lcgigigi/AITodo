export function formatTokenNumber(value: number) {
  return Math.round(value).toLocaleString('zh-CN')
}

export function formatTokenCompact(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}
