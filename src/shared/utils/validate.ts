export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function isValidUrl(value: string) {
  try {
    return Boolean(new URL(value))
  } catch {
    return false
  }
}
