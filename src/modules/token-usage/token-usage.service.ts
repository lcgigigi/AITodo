import { httpClient } from '@/shared/request/http'
import {
  type TokenUsageDateRange,
  type TokenUsageDailyPoint,
  type TokenUsagePeriodCode,
} from './token-usage.helpers'

export type {
  TokenUsageDateRange,
  TokenUsageDailyPoint,
  TokenUsagePeriodCode,
} from './token-usage.helpers'
export {
  collectTrendDates,
  getTokenUsagePeriodDayCount,
  getTokenUsagePeriodName,
  resolveTokenUsageDateRange,
  sumDailyTokenUsage,
} from './token-usage.helpers'

const TOKEN_USAGE_REQUEST_TIMEOUT = 60_000

interface TokenUsageResponse<T = unknown> {
  code?: number
  msg?: string
  message?: string
  data?: T | null
  success?: boolean
}

interface TokenUsageDailyPayload {
  usageDate?: string | null
  tokenUsage?: number | string | null
}

interface TokenUsagePeriodPayload {
  periodCode?: TokenUsagePeriodCode | null
  periodName?: string | null
  totalTokenUsage?: number | string | null
  tokenUsage?: number | string | null
  moduleList?: TokenUsageModulePayload[] | null
}

interface TokenUsageModulePayload {
  moduleCode?: string | null
  moduleName?: string | null
  tokenUsage?: number | string | null
  totalTokenUsage?: number | string | null
  periodList?: TokenUsagePeriodPayload[] | null
  dailyList?: TokenUsageDailyPayload[] | null
}

interface CurrentUserTokenUsagePayload {
  userId?: string | number | null
  periodList?: TokenUsagePeriodPayload[] | null
  trendList?: TokenUsageModulePayload[] | null
}

interface AdminTokenDeptPayload {
  deptId?: string | number | null
  deptName?: string | null
  totalTokenUsage?: number | string | null
  moduleList?: TokenUsageModulePayload[] | null
}

interface AdminTokenDashboardPayload {
  totalTokenUsage?: number | string | null
  deptList?: AdminTokenDeptPayload[] | null
}

export interface TokenUsageModulePeriod {
  periodCode: TokenUsagePeriodCode
  periodName: string
  tokenUsage: number
}

export interface CurrentUserTokenUsageModule {
  moduleCode: string
  moduleName: string
  tokenUsage: number
}

export interface CurrentUserTokenUsagePeriod {
  periodCode: TokenUsagePeriodCode
  periodName: string
  totalTokenUsage: number
  moduleList: CurrentUserTokenUsageModule[]
}

export interface CurrentUserTokenUsageTrend {
  moduleCode: string
  moduleName: string
  totalTokenUsage: number
  dailyList: TokenUsageDailyPoint[]
}

export interface CurrentUserTokenUsage {
  userId: string
  periodList: CurrentUserTokenUsagePeriod[]
  trendList: CurrentUserTokenUsageTrend[]
}

export interface AdminTokenUsageModule {
  moduleCode: string
  moduleName: string
  totalTokenUsage: number
  periodList: TokenUsageModulePeriod[]
  dailyList: TokenUsageDailyPoint[]
}

export interface AdminTokenUsageDept {
  deptId: string
  deptName: string
  totalTokenUsage: number
  moduleList: AdminTokenUsageModule[]
}

export interface AdminTokenUsageDashboard {
  totalTokenUsage: number
  deptList: AdminTokenUsageDept[]
}

export interface TokenUsageDeptOption {
  deptId: string
  deptName: string
}

function getResponseMessage(response: TokenUsageResponse, fallbackMessage: string) {
  return response.msg || response.message || fallbackMessage
}

function unwrapTokenUsageResponse<T>(response: TokenUsageResponse<T>, fallbackMessage: string): T {
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

async function requestTokenUsageData<T>(
  url: string,
  fallbackMessage: string,
  params?: Record<string, string>,
) {
  const response = await httpClient.request<TokenUsageResponse<T>>({
    method: 'GET',
    url,
    params,
    timeout: TOKEN_USAGE_REQUEST_TIMEOUT,
  })

  return unwrapTokenUsageResponse(response.data, fallbackMessage)
}

function toText(value?: string | number | null) {
  return value === null || value === undefined ? '' : String(value).trim()
}

function toNumber(value?: number | string | null) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function normalizeDailyList(items?: TokenUsageDailyPayload[] | null): TokenUsageDailyPoint[] {
  return (items ?? [])
    .map((item) => ({
      usageDate: toText(item.usageDate),
      tokenUsage: toNumber(item.tokenUsage),
    }))
    .filter((item) => item.usageDate)
    .sort((a, b) => a.usageDate.localeCompare(b.usageDate))
}

function normalizeModulePeriod(item: TokenUsagePeriodPayload): TokenUsageModulePeriod {
  return {
    periodCode: toText(item.periodCode),
    periodName: toText(item.periodName) || toText(item.periodCode),
    tokenUsage: toNumber(item.tokenUsage ?? item.totalTokenUsage),
  }
}

function normalizeCurrentUserPeriod(item: TokenUsagePeriodPayload): CurrentUserTokenUsagePeriod {
  return {
    periodCode: toText(item.periodCode),
    periodName: toText(item.periodName) || toText(item.periodCode),
    totalTokenUsage: toNumber(item.totalTokenUsage ?? item.tokenUsage),
    moduleList: (item.moduleList ?? [])
      .map((module) => ({
        moduleCode: toText(module.moduleCode),
        moduleName: toText(module.moduleName) || toText(module.moduleCode),
        tokenUsage: toNumber(module.tokenUsage ?? module.totalTokenUsage),
      }))
      .filter((module) => module.moduleCode || module.moduleName),
  }
}

function normalizeCurrentUserTrend(item: TokenUsageModulePayload): CurrentUserTokenUsageTrend {
  return {
    moduleCode: toText(item.moduleCode),
    moduleName: toText(item.moduleName) || toText(item.moduleCode),
    totalTokenUsage: toNumber(item.totalTokenUsage ?? item.tokenUsage),
    dailyList: normalizeDailyList(item.dailyList),
  }
}

function normalizeAdminModule(item: TokenUsageModulePayload): AdminTokenUsageModule {
  return {
    moduleCode: toText(item.moduleCode),
    moduleName: toText(item.moduleName) || toText(item.moduleCode),
    totalTokenUsage: toNumber(item.totalTokenUsage ?? item.tokenUsage),
    periodList: (item.periodList ?? []).map(normalizeModulePeriod),
    dailyList: normalizeDailyList(item.dailyList),
  }
}

function normalizeAdminDept(item: AdminTokenDeptPayload): AdminTokenUsageDept {
  const deptId = toText(item.deptId)

  return {
    deptId,
    deptName: toText(item.deptName) || deptId || '未命名部门',
    totalTokenUsage: toNumber(item.totalTokenUsage),
    moduleList: (item.moduleList ?? [])
      .map(normalizeAdminModule)
      .filter((module) => module.moduleCode || module.moduleName),
  }
}

function normalizeDeptOption(item: AdminTokenDeptPayload): TokenUsageDeptOption {
  const deptId = toText(item.deptId)

  return {
    deptId,
    deptName: toText(item.deptName) || deptId || '未命名部门',
  }
}

export async function loadCurrentUserTokenUsage(
  range: TokenUsageDateRange,
): Promise<CurrentUserTokenUsage> {
  const payload = await requestTokenUsageData<CurrentUserTokenUsagePayload>(
    '/token-usage/current-user',
    '查询当前用户 Token 用量失败',
    {
      startDate: range.startDate,
      endDate: range.endDate,
    },
  )

  return {
    userId: toText(payload.userId),
    periodList: (payload.periodList ?? []).map(normalizeCurrentUserPeriod),
    trendList: (payload.trendList ?? [])
      .map(normalizeCurrentUserTrend)
      .filter((module) => module.moduleCode || module.moduleName),
  }
}

export async function loadAdminTokenDashboard(
  range: TokenUsageDateRange,
): Promise<AdminTokenUsageDashboard> {
  const payload = await requestTokenUsageData<AdminTokenDashboardPayload>(
    '/token-usage/admin-dashboard',
    '查询管理员 Token 看板失败',
    {
      startDate: range.startDate,
      endDate: range.endDate,
    },
  )

  return {
    totalTokenUsage: toNumber(payload.totalTokenUsage),
    deptList: (payload.deptList ?? []).map(normalizeAdminDept),
  }
}

export async function loadTokenUsageDeptList(): Promise<TokenUsageDeptOption[]> {
  const payload = await requestTokenUsageData<AdminTokenDeptPayload[]>(
    '/token-usage/dept-list',
    '查询二级部门列表失败',
  )

  return (payload ?? []).map(normalizeDeptOption).filter((dept) => dept.deptId || dept.deptName)
}
