import type { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { useUserStore } from '@/stores/user.store'
import { getErrorMessage } from './error-code'
import { notifyRequestError, releaseRequestLoading, trackRequestLoading } from './feedback'
import type { RequestResponse } from './types'

type BusinessErrorPayload = {
  code?: unknown
  message?: unknown
  msg?: unknown
}

function getBusinessErrorMessage(result: BusinessErrorPayload) {
  const message = result.msg || result.message
  if (typeof message === 'string' && message.trim()) return message.trim()

  const code = typeof result.code === 'number' ? result.code : undefined
  return getErrorMessage(code, '请求失败')
}

function rejectBusinessError(
  config: InternalAxiosRequestConfig,
  result: BusinessErrorPayload,
) {
  const message = getBusinessErrorMessage(result)
  notifyRequestError(config, message)
  return Promise.reject(new Error(message))
}

export function setupInterceptors(instance: AxiosInstance) {
  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const userStore = useUserStore()

    if (userStore.token) {
      config.headers.Authorization = `Bearer ${userStore.token}`
    }

    trackRequestLoading(config)
    return config
  })

  instance.interceptors.response.use(
    (response: AxiosResponse<RequestResponse>) => {
      releaseRequestLoading(response.config)
      const result = response.data

      if (result && typeof result === 'object') {
        if ('success' in result && !result.success) {
          return rejectBusinessError(response.config, result)
        }

        if (
          'code' in result &&
          typeof result.code === 'number' &&
          result.code !== 200
        ) {
          return rejectBusinessError(response.config, result)
        }
      }

      return response
    },
    (error: AxiosError) => {
      releaseRequestLoading(error.config)
      const message = getErrorMessage(error.response?.status, error.message)
      notifyRequestError(error.config, message)

      return Promise.reject(new Error(message))
    },
  )
}
