export interface SelectOption<T = string> {
  label: string
  value: T
  disabled?: boolean
}

export type StatusType = 'default' | 'success' | 'warning' | 'error' | 'info'
