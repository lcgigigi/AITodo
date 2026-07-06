import { httpClient } from '@/shared/request/http'

const SYS_MESSAGE_REQUEST_TIMEOUT = 60_000
const SYS_MESSAGE_WS_PATH = '/websocket'

export type SysMessageStatus = 0 | 1
export type SysMessageFilter = 'unread' | 'all'

export interface SysMessage {
  id: string
  rawId: string | number
  msgSubject: string
  msgContent: string
  receiverEmpNo?: string
  msgStatus: SysMessageStatus
  msgType: number
  bizType?: number
  bizId?: string
  deletedFlag?: number
  createTime?: string
  readTime?: string | null
  deletedTime?: string | null
}

export interface SysMessagePageParams {
  pageNum?: number
  pageSize?: number
  msgStatus?: SysMessageStatus
  msgType?: number
  bizType?: number
}

export interface SysMessagePageResult {
  total: number
  rows: SysMessage[]
  pageNum: number
  pageSize: number
  hasMore: boolean
}

export interface SysMessagePushPayload {
  type: 'sys_message'
  id?: string | number
  msgSubject?: string
  msgContent?: string
  msgStatus?: number
  msgType?: number
  bizType?: number
  bizId?: string | number
  createTime?: string
}

interface SysMessageResponse<T = unknown> {
  code?: number
  msg?: string
  message?: string
  data?: T | null
  success?: boolean
}

interface SysMessageBackendItem {
  id?: string | number
  msgSubject?: string | null
  msgContent?: string | null
  receiverEmpNo?: string | null
  msgStatus?: number | null
  msgType?: number | null
  bizType?: number | null
  bizId?: string | number | null
  deletedFlag?: number | null
  createTime?: string | null
  readTime?: string | null
  deletedTime?: string | null
}

interface SysMessagePagePayload {
  total?: number | string | null
  rows?: SysMessageBackendItem[] | null
  list?: SysMessageBackendItem[] | null
}

export interface SysMessageLocationLike {
  protocol: string
  host: string
}

function getResponseMessage(response: SysMessageResponse, fallbackMessage: string) {
  return response.msg || response.message || fallbackMessage
}

function unwrapSysMessageResponse<T>(response: SysMessageResponse<T>, fallbackMessage: string): T {
  if (response.success === false) {
    throw new Error(getResponseMessage(response, fallbackMessage))
  }

  if (typeof response.code === 'number' && response.code !== 200) {
    throw new Error(getResponseMessage(response, fallbackMessage))
  }

  if (response.data === null || response.data === undefined) {
    throw new Error(getResponseMessage(response, fallbackMessage))
  }

  return response.data
}

async function requestSysMessageData<T>(config: {
  method: 'GET' | 'PUT' | 'DELETE'
  url: string
  params?: Record<string, unknown>
  data?: unknown
}) {
  const response = await httpClient.request<SysMessageResponse<T>>({
    timeout: SYS_MESSAGE_REQUEST_TIMEOUT,
    ...config,
  })

  return unwrapSysMessageResponse(response.data, '站内消息请求失败')
}

function toId(value?: string | number | null) {
  return value === null || value === undefined ? '' : String(value).trim()
}

function toNumber(value: unknown, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function toStatus(value: unknown): SysMessageStatus {
  return Number(value) === 1 ? 1 : 0
}

function normalizeRequestId(id: string | number) {
  if (typeof id === 'number') return id
  const numeric = Number(id)
  return Number.isFinite(numeric) && String(numeric) === id.trim() ? numeric : id
}

export function normalizeSysMessage(item: SysMessageBackendItem): SysMessage | null {
  const id = toId(item.id)
  if (!id) return null

  return {
    id,
    rawId: item.id ?? id,
    msgSubject: item.msgSubject?.trim() || '站内消息',
    msgContent: item.msgContent?.trim() || '',
    receiverEmpNo: item.receiverEmpNo?.trim() || undefined,
    msgStatus: toStatus(item.msgStatus),
    msgType: toNumber(item.msgType, 1),
    bizType:
      item.bizType === null || item.bizType === undefined ? undefined : toNumber(item.bizType),
    bizId: toId(item.bizId) || undefined,
    deletedFlag:
      item.deletedFlag === null || item.deletedFlag === undefined
        ? undefined
        : toNumber(item.deletedFlag),
    createTime: item.createTime?.trim() || undefined,
    readTime: item.readTime ?? null,
    deletedTime: item.deletedTime ?? null,
  }
}

export function normalizeSysMessagePush(payload: SysMessagePushPayload): SysMessage | null {
  if (payload.type !== 'sys_message') return null

  return normalizeSysMessage({
    id: payload.id,
    msgSubject: payload.msgSubject,
    msgContent: payload.msgContent,
    msgStatus: payload.msgStatus,
    msgType: payload.msgType,
    bizType: payload.bizType,
    bizId: payload.bizId,
    createTime: payload.createTime,
  })
}

export async function loadSysMessages(
  params: SysMessagePageParams = {},
): Promise<SysMessagePageResult> {
  const pageNum = params.pageNum ?? 1
  const pageSize = params.pageSize ?? 10
  const payload = await requestSysMessageData<SysMessagePagePayload>({
    method: 'GET',
    url: '/sys-message/page',
    params: {
      pageNum,
      pageSize,
      msgStatus: params.msgStatus,
      msgType: params.msgType,
      bizType: params.bizType,
    },
  })
  const rows = (payload.rows ?? payload.list ?? [])
    .map((item) => normalizeSysMessage(item))
    .filter((item): item is SysMessage => Boolean(item))
  const total = toNumber(payload.total, rows.length)

  return {
    total,
    rows,
    pageNum,
    pageSize,
    hasMore: pageNum * pageSize < total,
  }
}

export async function markSysMessagesRead(ids: Array<string | number>) {
  const normalizedIds = ids.map(normalizeRequestId).filter((id) => id !== '')
  if (normalizedIds.length === 0) return true

  return requestSysMessageData<boolean>({
    method: 'PUT',
    url: '/sys-message/read',
    data: { ids: normalizedIds },
  })
}

export async function markAllSysMessagesRead() {
  return requestSysMessageData<boolean>({
    method: 'PUT',
    url: '/sys-message/read-all',
  })
}

export async function deleteSysMessages(ids: Array<string | number>) {
  const normalizedIds = ids.map(normalizeRequestId).filter((id) => id !== '')
  if (normalizedIds.length === 0) return true

  return requestSysMessageData<boolean>({
    method: 'DELETE',
    url: '/sys-message',
    data: { ids: normalizedIds },
  })
}

function getDefaultLocation(): SysMessageLocationLike | undefined {
  if (typeof window === 'undefined') return undefined

  return {
    protocol: window.location.protocol,
    host: window.location.host,
  }
}

function toWsProtocol(protocol?: string) {
  return protocol === 'https:' ? 'wss:' : 'ws:'
}

function normalizeWebSocketBaseUrl(baseUrl: string, location?: SysMessageLocationLike) {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  const wsProtocol = toWsProtocol(location?.protocol)

  if (!trimmed) {
    if (!location?.host) return ''
    return `${wsProtocol}//${location.host}${SYS_MESSAGE_WS_PATH}`
  }

  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
    return trimmed.endsWith(SYS_MESSAGE_WS_PATH) ? trimmed : `${trimmed}${SYS_MESSAGE_WS_PATH}`
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const url = new URL(trimmed)
    url.protocol = toWsProtocol(url.protocol)
    const resolved = url.toString().replace(/\/+$/, '')
    return resolved.endsWith(SYS_MESSAGE_WS_PATH) ? resolved : `${resolved}${SYS_MESSAGE_WS_PATH}`
  }

  if (trimmed.startsWith('//')) {
    const resolved = `${wsProtocol}${trimmed}`
    return resolved.endsWith(SYS_MESSAGE_WS_PATH) ? resolved : `${resolved}${SYS_MESSAGE_WS_PATH}`
  }

  if (trimmed.startsWith('/')) {
    if (!location?.host) return ''
    const resolved = `${wsProtocol}//${location.host}${trimmed}`
    return resolved.endsWith(SYS_MESSAGE_WS_PATH) ? resolved : `${resolved}${SYS_MESSAGE_WS_PATH}`
  }

  const resolved = `${wsProtocol}//${trimmed}`
  return resolved.endsWith(SYS_MESSAGE_WS_PATH) ? resolved : `${resolved}${SYS_MESSAGE_WS_PATH}`
}

export function buildSysMessageWebSocketUrl(
  userId: string,
  options: {
    baseUrl?: string
    location?: SysMessageLocationLike
  } = {},
) {
  const location = options.location ?? getDefaultLocation()
  const envBaseUrl = import.meta.env.VITE_APP_SYS_MESSAGE_WS_BASE_URL || ''
  const baseUrl = normalizeWebSocketBaseUrl(options.baseUrl ?? envBaseUrl, location)

  if (!baseUrl || !userId.trim()) return ''

  return `${baseUrl}/${encodeURIComponent(userId.trim())}`
}
