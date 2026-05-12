import type { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { useUserStore } from '@/stores/user.store'
import { getErrorMessage } from './error-code'
import type { RequestResponse } from './types'

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

      if (result && typeof result === 'object' && 'success' in result && !result.success) {
        return Promise.reject(new Error(result.message || getErrorMessage(result.code)))
      }

      return response
    },
    (error: AxiosError) => {
      const message = getErrorMessage(error.response?.status, error.message)

      return Promise.reject(new Error(message))
    },
  )
}
