import type { InternalAxiosRequestConfig } from 'axios'
import { useFeedbackStore } from '@/stores/feedback.store'

function resolveShowLoading(config: InternalAxiosRequestConfig) {
  if (config.showLoading === true) return true
  if (config.showLoading === false) return false

  const method = config.method?.toUpperCase()
  return method !== 'GET' && method !== 'HEAD'
}

function resolveShowError(config: InternalAxiosRequestConfig) {
  return config.showError !== false
}

export function trackRequestLoading(config: InternalAxiosRequestConfig) {
  if (!resolveShowLoading(config)) return
  useFeedbackStore().startLoading()
}

export function releaseRequestLoading(config?: InternalAxiosRequestConfig) {
  if (!config || !resolveShowLoading(config)) return
  useFeedbackStore().endLoading()
}

export function notifyRequestError(
  config: InternalAxiosRequestConfig | undefined,
  message: string,
) {
  if (!config || !resolveShowError(config)) return
  useFeedbackStore().error(message)
}
