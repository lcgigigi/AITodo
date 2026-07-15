import { httpClient } from '@/shared/request/http'
import { getSafeBackendMessage } from '@/shared/request/backend-message'
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
  collectDatesInRange,
  collectTrendDates,
  getMonthDateRange,
  getTokenUsagePeriodDayCount,
  getTokenUsagePeriodName,
  getYearDateRange,
  isDateInRange,
  resolveTokenUsageDateRange,
  sumDailyInRange,
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

interface AdminTokenTrendPayload {
  period?: string | null
  tokenUsage?: number | string | null
}

interface AdminTokenDeptDistributionPayload {
  deptId?: string | number | null
  deptName?: string | null
  tokenUsage?: number | string | null
}

interface AdminTokenModuleDistributionPayload {
  bizModule?: string | null
  bizModuleName?: string | null
  tokenUsage?: number | string | null
}

interface AdminTokenDashboardPayload {
  totalTokenUsage?: number | string | null
  queryType?: AdminTokenQueryType | null
  startPeriod?: string | null
  endPeriod?: string | null
  trendList?: AdminTokenTrendPayload[] | null
  deptDistributionList?: AdminTokenDeptDistributionPayload[] | null
  moduleDistributionList?: AdminTokenModuleDistributionPayload[] | null
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

export type AdminTokenQueryType = 'month' | 'year'

export interface LoadAdminTokenDashboardQuery {
  queryType?: AdminTokenQueryType
  month?: string
}

export interface AdminTokenTrendPoint {
  period: string
  tokenUsage: number
}

export interface AdminTokenDeptDistribution {
  deptId: string
  deptName: string
  tokenUsage: number
}

export interface AdminTokenModuleDistribution {
  moduleCode: string
  moduleName: string
  tokenUsage: number
}

export interface AdminTokenUsageDashboard {
  totalTokenUsage: number
  queryType: AdminTokenQueryType
  startPeriod: string
  endPeriod: string
  trendList: AdminTokenTrendPoint[]
  deptDistributionList: AdminTokenDeptDistribution[]
  moduleDistributionList: AdminTokenModuleDistribution[]
}

function getResponseMessage(response: TokenUsageResponse, fallbackMessage: string) {
  return getSafeBackendMessage(response.msg || response.message, fallbackMessage)
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

function normalizeAdminTrendPoint(item: AdminTokenTrendPayload): AdminTokenTrendPoint {
  return {
    period: toText(item.period),
    tokenUsage: toNumber(item.tokenUsage),
  }
}

function normalizeAdminDeptDistribution(
  item: AdminTokenDeptDistributionPayload,
): AdminTokenDeptDistribution {
  const deptId = toText(item.deptId)

  return {
    deptId,
    deptName: toText(item.deptName) || deptId || '未命名部门',
    tokenUsage: toNumber(item.tokenUsage),
  }
}

function normalizeAdminModuleDistribution(
  item: AdminTokenModuleDistributionPayload,
): AdminTokenModuleDistribution {
  const moduleCode = toText(item.bizModule)

  return {
    moduleCode,
    moduleName: toText(item.bizModuleName) || moduleCode || '未命名模块',
    tokenUsage: toNumber(item.tokenUsage),
  }
}

function normalizeAdminQueryType(value?: string | null): AdminTokenQueryType {
  return value === 'year' ? 'year' : 'month'
}

export function getCurrentMonthKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function normalizeMonthKey(value?: string | null) {
  const normalized = toText(value)
  return /^\d{4}-\d{2}$/.test(normalized) ? normalized : ''
}

function resolveAdminDashboardParams(query: LoadAdminTokenDashboardQuery = {}) {
  const queryType = normalizeAdminQueryType(query.queryType)
  const params: Record<string, string> = { queryType }

  if (queryType === 'month') {
    const month = normalizeMonthKey(query.month) || getCurrentMonthKey()
    params.month = month
  }

  return { queryType, params }
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
  query: LoadAdminTokenDashboardQuery = {},
): Promise<AdminTokenUsageDashboard> {
  const { queryType, params } = resolveAdminDashboardParams(query)
  const payload = await requestTokenUsageData<AdminTokenDashboardPayload>(
    '/token-usage/admin-dashboard',
    '查询管理员 Token 看板失败',
    params,
  )

  return {
    totalTokenUsage: toNumber(payload.totalTokenUsage),
    queryType: normalizeAdminQueryType(payload.queryType) || queryType,
    startPeriod: toText(payload.startPeriod),
    endPeriod: toText(payload.endPeriod),
    trendList: (payload.trendList ?? [])
      .map(normalizeAdminTrendPoint)
      .filter((item) => item.period)
      .sort((a, b) => a.period.localeCompare(b.period)),
    deptDistributionList: (payload.deptDistributionList ?? [])
      .map(normalizeAdminDeptDistribution)
      .filter((item) => item.deptId || item.deptName),
    moduleDistributionList: (payload.moduleDistributionList ?? [])
      .map(normalizeAdminModuleDistribution)
      .filter((item) => item.moduleCode || item.moduleName),
  }
}
