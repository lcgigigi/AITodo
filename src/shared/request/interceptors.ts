import type { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { useUserStore } from '@/stores/user.store'
import { getSafeBackendMessage } from './backend-message'
import { getErrorMessage } from './error-code'
import { notifyRequestError } from './feedback'
import { RequestError } from './request-error'
import type { RequestResponse } from './types'

type BusinessErrorPayload = {
  code?: unknown
  message?: unknown
  msg?: unknown
  traceId?: unknown
}

function getBusinessErrorMessage(result: BusinessErrorPayload) {
  const message = result.msg || result.message
  const code = typeof result.code === 'number' ? result.code : undefined
  const fallback = getErrorMessage(code, '请求失败，请稍后再试')

  return getSafeBackendMessage(message, fallback)
}

function rejectBusinessError(
  config: InternalAxiosRequestConfig,
  result: BusinessErrorPayload,
  status?: number,
) {
  const message = getBusinessErrorMessage(result)
  const code = typeof result.code === 'number' ? result.code : undefined
  const traceId = typeof result.traceId === 'string' ? result.traceId : undefined
  notifyRequestError(config, message)
  return Promise.reject(new RequestError(message, { status, code, traceId }))
}

export function setupInterceptors(instance: AxiosInstance) {
  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const userStore = useUserStore()

    if (userStore.token) {
      config.headers.Authorization = `Bearer ${userStore.token}`
    }

    return config
  })

  instance.interceptors.response.use(
    (response: AxiosResponse<RequestResponse>) => {
      const result = response.data

      if (result && typeof result === 'object') {
        if ('success' in result && !result.success) {
          return rejectBusinessError(response.config, result, response.status)
        }

        if ('code' in result && typeof result.code === 'number' && result.code !== 200) {
          return rejectBusinessError(response.config, result, response.status)
        }
      }

      return response
    },
    (error: AxiosError) => {
      const message = getErrorMessage(error.response?.status, error.message)
      notifyRequestError(error.config, message)

      const payload = error.response?.data
      const code =
        payload &&
        typeof payload === 'object' &&
        'code' in payload &&
        typeof payload.code === 'number'
          ? payload.code
          : undefined
      const traceId =
        payload &&
        typeof payload === 'object' &&
        'traceId' in payload &&
        typeof payload.traceId === 'string'
          ? payload.traceId
          : undefined

      return Promise.reject(
        new RequestError(message, {
          status: error.response?.status,
          code,
          traceId,
          cause: error,
        }),
      )
    },
  )
}
