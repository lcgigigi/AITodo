import { httpClient } from '@/shared/request/http'

export const DAILY_OPINION_LIMIT = 3

export type OpinionCategory = 'feature' | 'experience' | 'bug' | 'other'
export type OpinionType = 1 | 2 | 3 | 4

export interface SubmitOpinionPayload {
  content: string
  type: OpinionType
}

const OPINION_CATEGORY_TO_TYPE: Record<OpinionCategory, OpinionType> = {
  feature: 1,
  experience: 2,
  bug: 3,
  other: 4,
}

interface OpinionBoxResponse<T = unknown> {
  code?: number
  msg?: string
  message?: string
  traceId?: string
  success?: boolean
  data?: T | null
}

export function toOpinionType(category: OpinionCategory): OpinionType {
  return OPINION_CATEGORY_TO_TYPE[category]
}

export function isOpinionType(value: unknown): value is OpinionType {
  return value === 1 || value === 2 || value === 3 || value === 4
}

function getResponseMessage(response: OpinionBoxResponse, fallbackMessage: string) {
  return response.msg || response.message || fallbackMessage
}

function unwrapOpinionBoxResponse<T>(response: OpinionBoxResponse<T>, fallbackMessage: string): T {
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

function toCount(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : 0
}

export async function submitOpinion(payload: SubmitOpinionPayload): Promise<boolean> {
  const content = payload.content.trim()
  if (!content) {
    throw new Error('意见内容不能为空')
  }

  if (!isOpinionType(payload.type)) {
    throw new Error('意见类型无效')
  }

  const response = await httpClient.request<OpinionBoxResponse<boolean>>({
    method: 'POST',
    url: '/opinion-box/submit',
    data: {
      content,
      type: payload.type,
    },
    showError: false,
  })

  unwrapOpinionBoxResponse(response.data, '意见提交失败')
  return true
}

export async function loadTodayOpinionCount(): Promise<number> {
  try {
    const response = await httpClient.request<OpinionBoxResponse<number>>({
      method: 'GET',
      url: '/opinion-box/today-count',
      showError: false,
    })

    return toCount(unwrapOpinionBoxResponse(response.data, '查询今日意见数量失败'))
  } catch {
    return 0
  }
}
