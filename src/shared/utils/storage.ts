export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const value = localStorage.getItem(key)
      if (!value) return fallback
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  },
  set<T>(key: string, value: T) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch {
      return false
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key)
      return true
    } catch {
      return false
    }
  },
}
