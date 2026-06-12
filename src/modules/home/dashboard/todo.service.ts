import type { AxiosRequestConfig } from 'axios'
import { httpClient } from '@/shared/request/http'
import type {
  CalendarEvent,
  CalendarEventStatus,
  CalendarTodoDraft,
  CalendarTodoScope,
  CalendarTodoUpdate,
  CalendarUser,
  ParsedTodoDraft,
} from './types'
import { compareEvents, ymd } from './todoDisplay'

const SMART_TODO_REQUEST_TIMEOUT = 60_000
const DEFAULT_LOGIN_USERNAME = import.meta.env.VITE_APP_TODO_USERNAME || 'admin'
const DEFAULT_LOGIN_PASSWORD = import.meta.env.VITE_APP_TODO_PASSWORD || 'admin123'

interface SmartTodoResponse<T = unknown> {
  code?: number
  msg?: string
  message?: string
  traceId?: string
  data?: T | null
  success?: boolean
}

interface SmartTodoLoginResponse extends SmartTodoResponse {
  token?: string
}

interface SmartTodoInfoResponse extends SmartTodoResponse {
  user?: {
    userId?: string | number
    userName?: string
    nickName?: string
    avatar?: string
    deptName?: string
    department?: string
    isSecurityPassword?: 'yes' | 'no'
  }
  roles?: string[]
  permissions?: string[]
}

interface SmartTodoBackendUser {
  badge?: string | number
  name?: string
}

interface SmartTodoBackendItem {
  id?: string | number
  title?: string
  timeType?: 1 | 2
  startDateShow?: string | null
  endDateShow?: string | null
  content?: string | null
  assigneeId?: string | number | null
  remark?: string | null
  creatorId?: string | number | null
  creatorName?: string | null
  createTime?: string | null
  status?: 0 | 3 | 6 | 9 | 99
  currentHandlerId?: string | number | null
  handlerIds?: string | null
  receiveStatus?: number | null
}

interface SmartTodoAnalyzeData {
  task?: string
  timeType?: number | string
  date?: string
  time?: string
  startDate?: string
  endDate?: string
  endTime?: string
  startDateShow?: string
  endDateShow?: string
  assigneeId?: string | number
  remark?: string
}

interface SmartTodoPayload {
  id?: string | number
  title: string
  timeType: 1 | 2
  startDateShow: string
  endDateShow?: string
  content: string
  assigneeId?: string
  remark: string
}

export interface SmartTodoLoginCredentials {
  username?: string
  password?: string
}

export interface SmartTodoCurrentUser extends CalendarUser {
  roles: string[]
  permissions: string[]
  isSecurityPassword?: 'yes' | 'no'
}

function getResponseMessage(response: SmartTodoResponse, fallbackMessage: string) {
  return response.msg || response.message || fallbackMessage
}

function unwrapSmartTodoResponse<T>(response: SmartTodoResponse<T>, fallbackMessage: string): T {
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

async function requestSmartTodoData<T>(config: AxiosRequestConfig, fallbackMessage: string) {
  const response = await httpClient.request<SmartTodoResponse<T>>({
    timeout: SMART_TODO_REQUEST_TIMEOUT,
    ...config,
  })

  return unwrapSmartTodoResponse(response.data, fallbackMessage)
}

function toId(value?: string | number | null) {
  return value === null || value === undefined ? '' : String(value).trim()
}

function todayDate() {
  return ymd(new Date())
}

function normalizeBackendTime(time?: string | null) {
  const trimmed = time?.trim()

  if (!trimmed) return '00:00:00'

  if (trimmed.includes(':')) {
    const [hour = '0', minute = '0', second = '0'] = trimmed.split(':')
    return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`
  }

  const digits = trimmed.replace(/\D/g, '')
  if (digits.length >= 6) {
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4, 6)}`
  }
  if (digits.length >= 4) {
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:00`
  }

  return '00:00:00'
}

function normalizeFormTime(time?: string | null, preserveMidnight = false) {
  const backendTime = normalizeBackendTime(time)
  if (!preserveMidnight && backendTime === '00:00:00') return undefined
  return backendTime.slice(0, 5)
}

function parseDateTimeShow(value?: string | null, preserveMidnight = false) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return {
      date: undefined,
      time: undefined,
    }
  }

  const [datePart, timePart] = trimmed.split(/\s+/)
  if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return {
      date: undefined,
      time: undefined,
    }
  }

  return {
    date: datePart,
    time: timePart ? normalizeFormTime(timePart, preserveMidnight) : undefined,
  }
}

function buildDateTimeShow(date: string, time?: string | null) {
  return `${date} ${normalizeBackendTime(time)}`
}

function resolveAnalyzeTimeType(value?: number | string | null): 1 | 2 {
  if (value === 2 || value === '2') return 2

  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()

  if (['deadline', 'date_range', 'range', 'deadline_range'].includes(normalized)) {
    return 2
  }

  return 1
}

function isValidAnalyzeDate(value?: string | null) {
  const trimmed = value?.trim()
  return Boolean(trimmed && /^\d{4}-\d{2}-\d{2}$/.test(trimmed))
}

function normalizeAnalyzeSchedule(data: SmartTodoAnalyzeData) {
  const isRangeByType = resolveAnalyzeTimeType(data.timeType) === 2
  const startDate = data.startDate?.trim()
  const endDate = data.endDate?.trim()
  const hasRangeDates = isValidAnalyzeDate(startDate) && isValidAnalyzeDate(endDate)
  const isRange = isRangeByType || hasRangeDates
  const preserveMidnight = isRange

  if (isValidAnalyzeDate(data.date)) {
    return {
      isRange,
      date: isRange && isValidAnalyzeDate(startDate) ? startDate! : data.date!.trim(),
      time: normalizeFormTime(data.time, preserveMidnight),
      endDate: isRange ? endDate : undefined,
      endTime: isRange ? normalizeFormTime(data.endTime, true) : undefined,
    }
  }

  if (isRange && isValidAnalyzeDate(startDate)) {
    return {
      isRange: true,
      date: startDate!,
      time: normalizeFormTime(data.time, true),
      endDate: endDate || startDate,
      endTime: normalizeFormTime(data.endTime, true),
    }
  }

  const start = parseDateTimeShow(data.startDateShow, preserveMidnight)
  const end = parseDateTimeShow(data.endDateShow, preserveMidnight)

  return {
    isRange,
    date: start.date,
    time: start.time,
    endDate: isRange ? end.date : undefined,
    endTime: isRange ? end.time : undefined,
  }
}

function resolveRole(roles: string[] = []): CalendarUser['role'] {
  return roles.some((role) => ['admin', 'leader'].includes(role)) ? 'leader' : 'employee'
}

function createUserMap(users: CalendarUser[]) {
  return new Map(users.map((user) => [user.id, user]))
}

function resolveScope(
  creatorId: string,
  assigneeId: string,
  currentUser: CalendarUser,
): CalendarTodoScope | undefined {
  if (!currentUser.id || !creatorId || !assigneeId) return undefined
  if (creatorId === currentUser.id && assigneeId === currentUser.id) return 'self'
  if (creatorId === currentUser.id && assigneeId !== currentUser.id) return 'assigned_by_me'
  return 'assigned_to_me'
}

function mapBackendStatus(status?: SmartTodoBackendItem['status']): CalendarEventStatus {
  return status === 6 ? 'done' : 'todo'
}

function normalizeBackendTodo(
  item: SmartTodoBackendItem,
  currentUser: CalendarUser,
  users: CalendarUser[] = [],
): CalendarEvent {
  const userMap = createUserMap(users)
  const id = toId(item.id) || `todo-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const assigneeId = toId(item.assigneeId)
  const creatorId = toId(item.creatorId)
  const currentHandlerId = toId(item.currentHandlerId)
  const assignee = userMap.get(assigneeId)
  const creator = userMap.get(creatorId)
  const assigneeName = assignee?.name || assigneeId || '未指定'
  const creatorName = item.creatorName?.trim() || creator?.name || (creatorId === currentUser.id ? currentUser.name : '')
  const timeType = item.timeType === 2 ? 2 : 1
  const preserveMidnight = timeType === 2
  const start = parseDateTimeShow(item.startDateShow, preserveMidnight)
  const end = parseDateTimeShow(item.endDateShow, preserveMidnight)
  const date = start.date || todayDate()
  const endDate = timeType === 2 ? end.date || date : undefined
  const title = item.title?.trim() || item.content?.trim() || '未命名待办'
  const status = mapBackendStatus(item.status)
  const completable = resolveCompletable(assigneeId, currentHandlerId, currentUser)

  return {
    id,
    date,
    endDate,
    time: start.time,
    endTime: timeType === 2 ? end.time : undefined,
    title,
    type: 'task',
    owner: assigneeName,
    status,
    source: item.remark?.trim() || item.content?.trim() || undefined,
    creatorId: creatorId || undefined,
    creatorName: creatorName || undefined,
    assigneeId: assigneeId || undefined,
    assigneeName,
    scope: resolveScope(creatorId, assigneeId, currentUser),
    editable: status !== 'done' && (!creatorId || creatorId === currentUser.id),
    completable,
    backendStatus: item.status,
    receiveStatus: item.receiveStatus ?? undefined,
    currentHandlerId: currentHandlerId || undefined,
    handlerIds: item.handlerIds ?? undefined,
    content: item.content ?? undefined,
    remark: item.remark ?? undefined,
  }
}

function normalizeBackendTodos(
  items: SmartTodoBackendItem[],
  currentUser: CalendarUser,
  users: CalendarUser[] = [],
) {
  return items
    .filter((item) => item.status !== 99)
    .map((item) => normalizeBackendTodo(item, currentUser, users))
    .sort(compareEvents)
}

function findAssignee(
  assigneeText: string | number | undefined,
  currentUser: CalendarUser,
  assignableUsers: CalendarUser[],
  fallback: ParsedTodoDraft,
) {
  const normalizedAssignee = toId(assigneeText)
  const matchedAssignee = assignableUsers.find(
    (user) =>
      normalizedAssignee &&
      (user.id === normalizedAssignee ||
        user.name === normalizedAssignee ||
        normalizedAssignee.includes(user.name)),
  )

  if (matchedAssignee) return matchedAssignee

  return {
    id: fallback.assigneeId || normalizedAssignee || currentUser.id,
    name: fallback.assigneeName || fallback.owner || normalizedAssignee || currentUser.name,
  }
}

function normalizeAnalyzeData(
  data: SmartTodoAnalyzeData,
  currentUser: CalendarUser,
  assignableUsers: CalendarUser[],
  fallback: ParsedTodoDraft,
): ParsedTodoDraft {
  const schedule = normalizeAnalyzeSchedule(data)
  const date = schedule.date || fallback.date
  const endDate = schedule.isRange ? schedule.endDate || date : undefined
  const assignee = findAssignee(data.assigneeId, currentUser, assignableUsers, fallback)

  return {
    mode: schedule.isRange ? 'deadline' : 'scheduled',
    date,
    endDate,
    time: schedule.time || fallback.time,
    endTime: schedule.isRange ? schedule.endTime || fallback.endTime : undefined,
    title: data.task?.trim() || fallback.title?.trim() || '',
    owner: assignee.name,
    assigneeId: assignee.id,
    assigneeName: assignee.name,
    source: data.remark?.trim() || fallback.source || 'AI预填',
  }
}

function buildSmartTodoPayload(payload: CalendarTodoDraft | CalendarTodoUpdate): SmartTodoPayload {
  const isRange = Boolean(payload.endDate)
  const title = payload.title.trim()

  if (isRange) {
    const endDate = payload.endDate || payload.date
    const endTime = payload.endTime?.trim()

    return {
      id: 'id' in payload ? payload.id : undefined,
      title,
      timeType: 2,
      startDateShow: buildDateTimeShow(payload.date, payload.time),
      endDateShow: endTime ? buildDateTimeShow(endDate, endTime) : `${endDate} 23:59:59`,
      content: title,
      assigneeId: payload.assigneeId?.trim() || undefined,
      remark: payload.source?.trim() || '',
    }
  }

  return {
    id: 'id' in payload ? payload.id : undefined,
    title,
    timeType: 1,
    startDateShow: buildDateTimeShow(payload.date, payload.time),
    content: title,
    assigneeId: payload.assigneeId?.trim() || undefined,
    remark: payload.source?.trim() || '',
  }
}

function resolveCompletable(
  assigneeId: string,
  currentHandlerId: string,
  currentUser: CalendarUser,
) {
  return currentHandlerId
    ? currentHandlerId === currentUser.id
    : !assigneeId || assigneeId === currentUser.id
}

function buildIds(ids: string | string[]) {
  return Array.isArray(ids) ? ids.join(',') : ids
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
      showLoading: false,
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
  const response = await httpClient.post<SmartTodoResponse>(
    '/logout',
    undefined,
    {
      timeout: SMART_TODO_REQUEST_TIMEOUT,
    },
  )

  if (typeof response.data.code === 'number' && response.data.code !== 200) {
    throw new Error(getResponseMessage(response.data, '退出登录失败'))
  }
}

export async function loadCurrentUser(options?: { silent?: boolean }): Promise<SmartTodoCurrentUser> {
  const response = await httpClient.get<SmartTodoInfoResponse>('/getInfo', {
    timeout: SMART_TODO_REQUEST_TIMEOUT,
    showLoading: false,
    showError: !options?.silent,
  })
  const result = response.data

  if (typeof result.code === 'number' && result.code !== 200) {
    throw new Error(getResponseMessage(result, '获取当前用户失败'))
  }

  if (!result.user) {
    throw new Error(getResponseMessage(result, '获取当前用户失败'))
  }

  const roles = result.roles ?? []
  const id = result.user.userName || toId(result.user.userId)

  return {
    id,
    name: result.user.nickName || result.user.userName || id || '未命名用户',
    avatar: result.user.avatar,
    department: result.user.department || result.user.deptName,
    role: resolveRole(roles),
    roles,
    permissions: result.permissions ?? [],
    isSecurityPassword: result.user.isSecurityPassword,
  }
}

export async function analyzeTodoText(
  text: string,
  currentUser: CalendarUser,
  assignableUsers: CalendarUser[],
  fallback: ParsedTodoDraft,
) {
  const data = await requestSmartTodoData<SmartTodoAnalyzeData>(
    {
      method: 'POST',
      url: '/smart-todo/analyze',
      data: { text: text.trim() },
    },
    'AI解析待办失败',
  )

  return normalizeAnalyzeData(data, currentUser, assignableUsers, fallback)
}

export async function analyzeTodoTextByGet(
  text: string,
  currentUser: CalendarUser,
  assignableUsers: CalendarUser[],
  fallback: ParsedTodoDraft,
) {
  const data = await requestSmartTodoData<SmartTodoAnalyzeData>(
    {
      method: 'GET',
      url: '/smart-todo/analyze',
      params: { text: text.trim() },
    },
    'AI解析待办失败',
  )

  return normalizeAnalyzeData(data, currentUser, assignableUsers, fallback)
}

export async function loadAssignableUsers() {
  const users = await requestSmartTodoData<SmartTodoBackendUser[]>(
    {
      method: 'GET',
      url: '/smart-todo/user-list',
    },
    '查询用户列表失败',
  )

  return users
    .map((user): CalendarUser | null => {
      const id = toId(user.badge)
      const name = user.name?.trim()

      if (!id || !name) return null

      return {
        id,
        name,
        role: 'employee',
      }
    })
    .filter((user): user is CalendarUser => Boolean(user))
}

export type TodoDateRange = {
  startDate: string
  endDate: string
}

export function getTodoMonthRange(month: Date): TodoDateRange {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()

  return {
    startDate: ymd(new Date(year, monthIndex, 1)),
    endDate: ymd(new Date(year, monthIndex + 1, 0)),
  }
}

export function getTodoWeekRange(anchorDate: string): TodoDateRange {
  const start = new Date(`${anchorDate}T12:00:00`)
  const offset = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - offset)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  return {
    startDate: ymd(start),
    endDate: ymd(end),
  }
}

export async function loadTodos(
  currentUser: CalendarUser,
  users: CalendarUser[] = [],
  range?: TodoDateRange,
) {
  const items = await requestSmartTodoData<SmartTodoBackendItem[]>(
    {
      method: 'GET',
      url: '/smart-todo/month-list',
      params: range,
    },
    '查询待办列表失败',
  )

  return normalizeBackendTodos(items, currentUser, users)
}

export async function loadPendingTodos(currentUser: CalendarUser, users: CalendarUser[] = []) {
  const items = await requestSmartTodoData<SmartTodoBackendItem[]>(
    {
      method: 'GET',
      url: '/smart-todo/pending-list',
    },
    '查询待接受待办失败',
  )

  return normalizeBackendTodos(items, currentUser, users)
}

export async function loadTodoDetail(
  id: string,
  currentUser: CalendarUser,
  users: CalendarUser[] = [],
) {
  const item = await requestSmartTodoData<SmartTodoBackendItem>(
    {
      method: 'GET',
      url: `/smart-todo/${encodeURIComponent(id)}`,
    },
    '查询待办详情失败',
  )

  return normalizeBackendTodo(item, currentUser, users)
}

export async function createTodo(payload: CalendarTodoDraft) {
  return requestSmartTodoData<string | number>(
    {
      method: 'POST',
      url: '/smart-todo/create',
      data: buildSmartTodoPayload(payload),
    },
    '创建待办事项失败',
  )
}

export async function updateTodo(payload: CalendarTodoUpdate) {
  return requestSmartTodoData<boolean>(
    {
      method: 'PUT',
      url: '/smart-todo',
      data: buildSmartTodoPayload(payload),
    },
    '更新待办事项失败',
  )
}

export async function deleteTodo(id: string) {
  return requestSmartTodoData<boolean>(
    {
      method: 'DELETE',
      url: `/smart-todo/${encodeURIComponent(id)}`,
    },
    '删除待办事项失败',
  )
}

export async function completeTodo(
  id: string,
  currentUser: CalendarUser,
  handleDesc = '已完成',
) {
  return requestSmartTodoData<boolean>(
    {
      method: 'POST',
      url: `/smart-todo/complete/${encodeURIComponent(id)}`,
      params: { handleDesc },
      headers: currentUser.id ? { userId: currentUser.id } : undefined,
    },
    '完成待办事项失败',
  )
}

export async function rejectTodo(id: string, handleDesc: string) {
  return requestSmartTodoData<boolean>(
    {
      method: 'POST',
      url: '/smart-todo/reject',
      data: { id, handleDesc },
    },
    '拒绝待办事项失败',
  )
}

export async function acceptTodos(ids: string | string[]) {
  return requestSmartTodoData<boolean>(
    {
      method: 'POST',
      url: '/smart-todo/accept',
      data: { ids: buildIds(ids) },
    },
    '接受待办事项失败',
  )
}

export async function transferTodos(ids: string | string[], assigneeId: string) {
  return requestSmartTodoData<boolean>(
    {
      method: 'POST',
      url: '/smart-todo/transfer',
      data: {
        ids: buildIds(ids),
        assigneeId,
      },
    },
    '转发待办事项失败',
  )
}

export async function syncCalendar() {
  return requestSmartTodoData<boolean>(
    {
      method: 'POST',
      url: '/smart-todo/sync-calendar',
      showError: false,
    },
    '同步邮箱日程失败',
  )
}

export function listTodos(events: CalendarEvent[], currentUser: CalendarUser) {
  return events
    .map((event) => {
      const creatorId = event.creatorId ?? ''
      const assigneeId = event.assigneeId ?? ''

      return {
        ...event,
        scope: event.scope ?? resolveScope(creatorId, assigneeId, currentUser),
        editable:
          event.editable ??
          (event.status !== 'done' && (!creatorId || creatorId === currentUser.id)),
        completable:
          event.completable ??
          resolveCompletable(
            assigneeId,
            event.currentHandlerId ?? '',
            currentUser,
          ),
      }
    })
    .sort(compareEvents)
}

export async function cancelTodoComplete(id: string, handleDesc = '撤销完成') {
  return requestSmartTodoData<boolean>(
    {
      method: 'POST',
      url: '/smart-todo/cancel',
      data: { id, handleDesc },
    },
    '撤销待办事项失败',
  )
}

export async function revokeTodoComplete(
  id: string,
  _currentUser?: CalendarUser,
  _users: CalendarUser[] = [],
  handleDesc = '撤销完成',
) {
  return cancelTodoComplete(id, handleDesc)
}

export async function updateTodoStatus(
  id: string,
  currentUser: CalendarUser,
  status: CalendarEventStatus,
  users: CalendarUser[] = [],
) {
  if (status === 'done') {
    return completeTodo(id, currentUser)
  }

  return revokeTodoComplete(id, currentUser, users)
}

export function parseTodoText(
  text: string,
  currentUser: CalendarUser,
  assignableUsers: CalendarUser[],
  fallback: ParsedTodoDraft,
) {
  return analyzeTodoText(text, currentUser, assignableUsers, fallback)
}
