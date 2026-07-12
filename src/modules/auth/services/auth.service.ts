import { httpClient } from '@/shared/request/http'
import {
  SMART_TODO_REQUEST_TIMEOUT,
  getResponseMessage,
  type SmartTodoResponse,
} from '@/shared/request/smart-todo-client'
import type { CalendarUser } from '@/modules/home/dashboard/config/types'

const DEFAULT_LOGIN_USERNAME = import.meta.env.VITE_APP_TODO_USERNAME || 'admin'
const DEFAULT_LOGIN_PASSWORD = import.meta.env.VITE_APP_TODO_PASSWORD || 'admin123'

interface SmartTodoLoginResponse extends SmartTodoResponse {
  token?: string
}

export interface SmartTodoLoginCredentials {
  username?: string
  password?: string
}

export interface SmartTodoCurrentUser extends CalendarUser {
  roles: string[]
  permissions: string[]
  isSecurityPassword?: 'yes' | 'no'
  checkEmail?: string | null
}

export type SmartTodoEmailProvider = 'outlook' | 'coremail'

function resolveRole(roles: string[] = []): CalendarUser['role'] {
  return roles.some((role) => ['admin', 'leader'].includes(role)) ? 'leader' : 'employee'
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

export async function loadCurrentUser(username?: string): Promise<SmartTodoCurrentUser> {
  const id = username?.trim() || DEFAULT_LOGIN_USERNAME

  return {
    id,
    name: id || '未命名用户',
    role: resolveRole(),
    roles: [],
    permissions: [],
  }
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
