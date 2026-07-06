import type { InternalAxiosRequestConfig } from 'axios'
import { useFeedbackStore } from '@/stores/feedback.store'

function resolveShowError(config: InternalAxiosRequestConfig) {
  return config.showError !== false
}

export function notifyRequestError(
  config: InternalAxiosRequestConfig | undefined,
  message: string,
) {
  if (!config || !resolveShowError(config)) return
  useFeedbackStore().error(message)
}
