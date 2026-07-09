/**
 * Smart-Todo 后端通用请求底层。
 *
 * 中立层，不依赖任何业务模块（home/auth 等）。集中承载 Smart-Todo 系列接口共用的：
 * - 请求超时常量；
 * - 统一响应信封类型；
 * - 与业务无关的通用小工具（响应消息提取、可选文本归一化、ID 归一化）。
 *
 * 供 auth 认证服务与 home 待办服务共同复用，避免二者相互依赖。
 */

export const SMART_TODO_REQUEST_TIMEOUT = 60_000

export interface SmartTodoResponse<T = unknown> {
  code?: number
  msg?: string
  message?: string
  traceId?: string
  data?: T | null
  success?: boolean
}

export function getResponseMessage(response: SmartTodoResponse, fallbackMessage: string) {
  return response.msg || response.message || fallbackMessage
}

export function getOptionalText(value: unknown) {
  if (value === null || value === undefined) return undefined
  return String(value).trim()
}

export function toId(value?: string | number | null) {
  return value === null || value === undefined ? '' : String(value).trim()
}
