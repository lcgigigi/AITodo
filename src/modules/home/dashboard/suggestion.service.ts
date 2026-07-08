import { httpClient } from '@/shared/request/http'

export type SuggestionCategory = 'feature' | 'experience' | 'bug' | 'other'

export interface SubmitSuggestionPayload {
  category: SuggestionCategory
  content: string
  viewMode?: 'simple' | 'detail'
}

export interface SuggestionRecord {
  id: string
  category: SuggestionCategory
  content: string
  viewMode?: 'simple' | 'detail'
  pageUrl?: string
  userName: string
  userId?: string
  department?: string
  createTime?: string
}

interface SmartTodoResponse<T = unknown> {
  code?: number
  msg?: string
  message?: string
  success?: boolean
  data?: T | null
}

interface SmartTodoSuggestionBackend {
  id?: string | number
  category?: string
  content?: string
  viewMode?: string
  pageUrl?: string
  userName?: string
  nickName?: string
  userId?: string | number
  department?: string
  deptName?: string
  createTime?: string
}

const SUGGESTION_CATEGORIES: SuggestionCategory[] = ['feature', 'experience', 'bug', 'other']

function getResponseMessage(response: SmartTodoResponse, fallbackMessage: string) {
  return response.msg || response.message || fallbackMessage
}

function normalizeCategory(value?: string): SuggestionCategory {
  const category = value?.trim() as SuggestionCategory | undefined
  return category && SUGGESTION_CATEGORIES.includes(category) ? category : 'other'
}

function normalizeViewMode(value?: string): SuggestionRecord['viewMode'] {
  if (value === 'simple' || value === 'detail') return value
  return undefined
}

function normalizeSuggestionRecord(item: SmartTodoSuggestionBackend, index: number): SuggestionRecord {
  const id = item.id === null || item.id === undefined ? `suggestion-${index}` : String(item.id)

  return {
    id,
    category: normalizeCategory(item.category),
    content: String(item.content ?? '').trim(),
    viewMode: normalizeViewMode(item.viewMode),
    pageUrl: item.pageUrl?.trim() || undefined,
    userName: item.nickName?.trim() || item.userName?.trim() || '匿名同事',
    userId: item.userId === null || item.userId === undefined ? undefined : String(item.userId),
    department: item.department?.trim() || item.deptName?.trim() || undefined,
    createTime: item.createTime?.trim() || undefined,
  }
}

function unwrapSuggestionList(response: SmartTodoResponse<SmartTodoSuggestionBackend[]>) {
  if (response.success === false) {
    throw new Error(getResponseMessage(response, '加载建议列表失败'))
  }

  if (typeof response.code === 'number' && response.code !== 200) {
    throw new Error(getResponseMessage(response, '加载建议列表失败'))
  }

  const list = Array.isArray(response.data) ? response.data : []
  return list.map(normalizeSuggestionRecord).filter((item) => item.content)
}

export async function submitSuggestion(payload: SubmitSuggestionPayload) {
  const response = await httpClient.request<SmartTodoResponse>({
    method: 'POST',
    url: '/smart-todo/suggestion',
    data: {
      category: payload.category,
      content: payload.content.trim(),
      viewMode: payload.viewMode,
      pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
    },
    showError: false,
  })

  const result = response.data

  if (result.success === false) {
    throw new Error(getResponseMessage(result, '建议提交失败'))
  }

  if (typeof result.code === 'number' && result.code !== 200) {
    throw new Error(getResponseMessage(result, '建议提交失败'))
  }

  return true
}

export async function loadSuggestions() {
  const response = await httpClient.request<SmartTodoResponse<SmartTodoSuggestionBackend[]>>({
    method: 'GET',
    url: '/smart-todo/suggestion/list',
    showError: false,
  })

  return unwrapSuggestionList(response.data)
}
