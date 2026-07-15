import { httpClient } from '@/shared/request/http'
import {
  SMART_TODO_REQUEST_TIMEOUT,
  getOptionalText,
  getResponseMessage,
  toId,
  type SmartTodoResponse,
} from '@/shared/request/smart-todo-client'
import type { CalendarUser } from '@/modules/home/dashboard/config/types'

const DEFAULT_LOGIN_USERNAME = import.meta.env.VITE_APP_TODO_USERNAME || 'admin'
const DEFAULT_LOGIN_PASSWORD = import.meta.env.VITE_APP_TODO_PASSWORD || 'admin123'

interface SmartTodoLoginResponse extends SmartTodoResponse {
  token?: string
}

interface SmartTodoInfoPayload {
  user?: {
    userId?: string | number
    userName?: string
    nickName?: string
    avatar?: string
    deptName?: string
    department?: string
    isSecurityPassword?: 'yes' | 'no'
    checkEmail?: string | null
  }
  roles?: string[]
  permissions?: string[]
  tokensPower?: boolean
  managerDashboardUrl?: string | null
  checkEmail?: string | null
  usedFeatureCodes?: string[]
}

interface SmartTodoInfoResponse extends SmartTodoResponse<SmartTodoInfoPayload> {
  user?: SmartTodoInfoPayload['user']
  roles?: string[]
  permissions?: string[]
  tokensPower?: boolean
  managerDashboardUrl?: string | null
  checkEmail?: string | null
  usedFeatureCodes?: string[]
}

export interface SmartTodoLoginCredentials {
  username?: string
  password?: string
}

export interface SmartTodoCurrentUser extends CalendarUser {
  roles: string[]
  permissions: string[]
  tokensPower: boolean
  managerDashboardUrl?: string
  isSecurityPassword?: 'yes' | 'no'
  checkEmail?: string | null
  usedFeatureCodes: string[]
}

export type SmartTodoEmailProvider = 'outlook' | 'coremail'

export const USER_GUIDE_FEATURE_CODE = 'user_guide_init'

function resolveRole(roles: string[] = []): CalendarUser['role'] {
  return roles.some((role) => ['admin', 'leader'].includes(role)) ? 'leader' : 'employee'
}

function normalizeFeatureCodes(value: unknown) {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value
        .filter((featureCode): featureCode is string => typeof featureCode === 'string')
        .map((featureCode) => featureCode.trim())
        .filter(Boolean),
    ),
  )
}

export async function loginSmartTodo(credentials: SmartTodoLoginCredentials = {}) {
  const response = await httpClient.post<SmartTodoLoginResponse>(
    '/login',
    {
      username: credentials.username || DEFAULT_LOGIN_USERNAME,
      password: credentials.password || DEFAULT_LOGIN_PASSWORD,
    },
    {
      timeout: SMART_TODO_REQUEST_TIMEOUT,
      showError: false,
    },
  )

  if (typeof response.data.code === 'number' && response.data.code !== 200) {
    throw new Error(getResponseMessage(response.data, '登录失败'))
  }

  if (!response.data.token) {
    throw new Error(getResponseMessage(response.data, '登录失败，后台未返回 token'))
  }

  return response.data.token
}

export async function logoutSmartTodo() {
  const response = await httpClient.post<SmartTodoResponse>('/logout', undefined, {
    timeout: SMART_TODO_REQUEST_TIMEOUT,
  })

  if (typeof response.data.code === 'number' && response.data.code !== 200) {
    throw new Error(getResponseMessage(response.data, '退出登录失败'))
  }
}

export async function loadCurrentUser(options?: {
  silent?: boolean
}): Promise<SmartTodoCurrentUser> {
  const response = await httpClient.get<SmartTodoInfoResponse>('/getInfo', {
    timeout: SMART_TODO_REQUEST_TIMEOUT,
    showError: !options?.silent,
  })
  const result = response.data

  if (typeof result.code === 'number' && result.code !== 200) {
    throw new Error(getResponseMessage(result, '获取当前用户失败'))
  }

  const info = result.data && typeof result.data === 'object' ? result.data : result
  const user = info.user

  if (!user) {
    throw new Error(getResponseMessage(result, '获取当前用户失败'))
  }

  const roles = info.roles ?? []
  const id = user.userName || toId(user.userId)
  const checkEmail = getOptionalText(user.checkEmail) || getOptionalText(info.checkEmail)
  const usedFeatureCodes = normalizeFeatureCodes(info.usedFeatureCodes ?? result.usedFeatureCodes)

  return {
    id,
    name: user.nickName || user.userName || id || '未命名用户',
    avatar: user.avatar,
    department: user.department || user.deptName,
    role: resolveRole(roles),
    roles,
    permissions: info.permissions ?? [],
    tokensPower: info.tokensPower === true,
    managerDashboardUrl: getOptionalText(info.managerDashboardUrl),
    isSecurityPassword: user.isSecurityPassword,
    checkEmail,
    usedFeatureCodes,
  }
}

export async function markUserFeatureUsed(
  featureCode: string,
  options: { version?: string; remark?: string } = {},
) {
  const response = await httpClient.post<SmartTodoResponse<boolean>>(
    '/user-feature-status/mark-used',
    {
      featureCode,
      ...options,
    },
    {
      timeout: SMART_TODO_REQUEST_TIMEOUT,
      showError: false,
    },
  )
  const result = response.data

  if (typeof result.code === 'number' && result.code !== 200) {
    throw new Error(getResponseMessage(result, '保存用户功能状态失败'))
  }

  if (result.success === false || result.data === false) {
    throw new Error(getResponseMessage(result, '保存用户功能状态失败'))
  }

  return true
}

export async function selectEmailProvider(provider: SmartTodoEmailProvider) {
  const choice = provider === 'outlook' ? 1 : 2
  const response = await httpClient.request<SmartTodoResponse>({
    method: 'POST',
    url: '/smart-todo/select-email',
    params: { choice },
    timeout: SMART_TODO_REQUEST_TIMEOUT,
    showError: false,
  })
  const result = response.data

  if (typeof result.code === 'number' && result.code !== 200) {
    throw new Error(getResponseMessage(result, '邮箱类型确认失败'))
  }

  if (result.success === false) {
    throw new Error(getResponseMessage(result, '邮箱类型确认失败'))
  }

  return true
}
