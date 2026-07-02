import type { AxiosRequestConfig } from 'axios'
import type { ApiResponse } from '@/shared/types/api'

export interface RequestConfig<T = unknown> extends AxiosRequestConfig {
  showError?: boolean
  rawResponse?: boolean
  mockData?: T
}

export type RequestResponse<T = unknown> = ApiResponse<T>
