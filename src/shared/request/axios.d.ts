import 'axios'

declare module 'axios' {
  export interface AxiosRequestConfig {
    showError?: boolean
  }
}
