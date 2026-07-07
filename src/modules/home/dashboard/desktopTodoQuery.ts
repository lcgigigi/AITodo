import type { LocationQuery } from 'vue-router'

export interface DesktopTodoDetailRequest {
  todoId: string
  messageId?: string
  bizType?: string
}

const DESKTOP_TODO_DETAIL_QUERY_KEYS = [
  'desktopTodoId',
  'desktopMessageId',
  'desktopBizType',
] as const

function getFirstQueryString(value: LocationQuery[string]) {
  const firstValue = Array.isArray(value) ? value[0] : value
  return typeof firstValue === 'string' ? firstValue.trim() : ''
}

export function getDesktopTodoDetailRequest(query: LocationQuery): DesktopTodoDetailRequest | null {
  const todoId = getFirstQueryString(query.desktopTodoId)
  if (!todoId) return null

  const messageId = getFirstQueryString(query.desktopMessageId)
  const bizType = getFirstQueryString(query.desktopBizType)

  return {
    todoId,
    ...(messageId ? { messageId } : {}),
    ...(bizType ? { bizType } : {}),
  }
}

export function clearDesktopTodoDetailQuery(query: LocationQuery) {
  const nextQuery = { ...query }

  for (const key of DESKTOP_TODO_DETAIL_QUERY_KEYS) {
    delete nextQuery[key]
  }

  return nextQuery
}
