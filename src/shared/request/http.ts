import axios from 'axios'
import type { ApiResponse } from '@/shared/types/api'
import { setupInterceptors } from './interceptors'
import type { RequestConfig } from './types'

const httpClient = axios.create({
  baseURL: import.meta.env.VITE_APP_BASE_API,
  timeout: 60_000,
})

setupInterceptors(httpClient)

export async function request<T = unknown>(config: RequestConfig<T>) {
  const response = await httpClient.request<ApiResponse<T>>(config)

  if (config.rawResponse) {
    return response.data
  }

  return response.data.data
}

export const http = {
  get<T = unknown>(url: string, config?: RequestConfig<T>) {
    return request<T>({ ...config, method: 'GET', url })
  },
  post<T = unknown, D = unknown>(url: string, data?: D, config?: RequestConfig<T>) {
    return request<T>({ ...config, method: 'POST', url, data })
  },
  put<T = unknown, D = unknown>(url: string, data?: D, config?: RequestConfig<T>) {
    return request<T>({ ...config, method: 'PUT', url, data })
  },
  delete<T = unknown>(url: string, config?: RequestConfig<T>) {
    return request<T>({ ...config, method: 'DELETE', url })
  },
}

export { httpClient }
