import { httpClient } from '@/shared/request/http'
import { type SmartTodoResponse, unwrapSmartTodoResponse } from '@/shared/request/smart-todo-client'

export const DAILY_OPINION_LIMIT = 3

export type OpinionCategory = 'feature' | 'experience' | 'bug' | 'other'
export type OpinionType = 1 | 2 | 3 | 4

export interface SubmitOpinionPayload {
  content: string
  type: OpinionType
}

export interface OpinionRecord {
  id: string
  userNo: string
  userName: string
  content: string
  createTime: string
  type: OpinionType
}

export interface OpinionStatistics {
  totalCount: number
  todayCount: number
  type1Count: number
  type2Count: number
  type3Count: number
  type4Count: number
}

export interface OpinionPageParams {
  pageNum?: number
  pageSize?: number
  keyword?: string
  type?: OpinionType
}

export interface OpinionPageResult {
  total: number
  rows: OpinionRecord[]
  statistics: OpinionStatistics
  pageNum: number
  pageSize: number
}

interface OpinionBackendRecord {
  id?: string | number | null
  userNo?: string | null
  userName?: string | null
  content?: string | null
  createTime?: string | null
  type?: number | null
}

interface OpinionPagePayload {
  total?: string | number | null
  rows?: OpinionBackendRecord[] | null
  statistics?: Partial<Record<keyof OpinionStatistics, string | number | null>> | null
}

const OPINION_CATEGORY_TO_TYPE: Record<OpinionCategory, OpinionType> = {
  feature: 1,
  experience: 2,
  bug: 3,
  other: 4,
}

export function toOpinionType(category: OpinionCategory): OpinionType {
  return OPINION_CATEGORY_TO_TYPE[category]
}

export function isOpinionType(value: unknown): value is OpinionType {
  return value === 1 || value === 2 || value === 3 || value === 4
}

function toCount(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : 0
}

function normalizeOpinionRecord(item: OpinionBackendRecord): OpinionRecord | null {
  const id = item.id === null || item.id === undefined ? '' : String(item.id).trim()
  if (!id || !isOpinionType(item.type)) return null

  return {
    id,
    userNo: item.userNo?.trim() || '',
    userName: item.userName?.trim() || '未命名用户',
    content: item.content?.trim() || '',
    createTime: item.createTime?.trim() || '',
    type: item.type,
  }
}

function normalizeStatistics(statistics: OpinionPagePayload['statistics']): OpinionStatistics {
  return {
    totalCount: toCount(statistics?.totalCount),
    todayCount: toCount(statistics?.todayCount),
    type1Count: toCount(statistics?.type1Count),
    type2Count: toCount(statistics?.type2Count),
    type3Count: toCount(statistics?.type3Count),
    type4Count: toCount(statistics?.type4Count),
  }
}

export async function submitOpinion(payload: SubmitOpinionPayload): Promise<boolean> {
  const content = payload.content.trim()
  if (!content) {
    throw new Error('意见内容不能为空')
  }

  if (!isOpinionType(payload.type)) {
    throw new Error('意见类型无效')
  }

  const response = await httpClient.request<SmartTodoResponse<boolean>>({
    method: 'POST',
    url: '/opinion-box/submit',
    data: {
      content,
      type: payload.type,
    },
    showError: false,
  })

  unwrapSmartTodoResponse(response.data, '意见提交失败')
  return true
}

export async function loadTodayOpinionCount(): Promise<number> {
  try {
    const response = await httpClient.request<SmartTodoResponse<number>>({
      method: 'GET',
      url: '/opinion-box/today-count',
      showError: false,
    })

    return toCount(unwrapSmartTodoResponse(response.data, '查询今日意见数量失败'))
  } catch {
    return 0
  }
}

export async function loadOpinionPage(params: OpinionPageParams = {}): Promise<OpinionPageResult> {
  const pageNum = Math.max(1, Math.floor(params.pageNum ?? 1))
  const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 10)))
  const keyword = params.keyword?.trim()

  if (params.type !== undefined && !isOpinionType(params.type)) {
    throw new Error('意见类型无效')
  }

  const response = await httpClient.request<SmartTodoResponse<OpinionPagePayload>>({
    method: 'GET',
    url: '/opinion-box/page',
    params: {
      pageNum,
      pageSize,
      keyword: keyword || undefined,
      type: params.type,
    },
    showError: false,
  })
  const payload = unwrapSmartTodoResponse(response.data, '查询意见列表失败')
  const rows = (payload.rows ?? [])
    .map(normalizeOpinionRecord)
    .filter((item): item is OpinionRecord => Boolean(item))

  return {
    total: toCount(payload.total),
    rows,
    statistics: normalizeStatistics(payload.statistics),
    pageNum,
    pageSize,
  }
}
