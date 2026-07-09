import type { AxiosRequestConfig } from 'axios'
import { httpClient } from '@/shared/request/http'
import {
  SMART_TODO_REQUEST_TIMEOUT,
  getResponseMessage,
  toId,
  type SmartTodoResponse,
} from '@/shared/request/smart-todo-client'
import type {
  CalendarEvent,
  CalendarEventStatus,
  CalendarTodoDraft,
  CalendarTodoScope,
  CalendarTodoUpdate,
  CalendarUser,
  ParsedTodoDraft,
  SmartTodoKind,
} from './types'
import { compareEvents, ymd } from './todoDisplay'

interface SmartTodoBackendUser {
  badge?: string | number
  name?: string
}

interface SmartTodoBackendItem {
  id?: string | number
  title?: string
  timeType?: 1 | 2
  startDate?: string | null
  endDate?: string | null
  startDateShow?: string | null
  endDateShow?: string | null
  content?: string | null
  assigneeId?: string | number | null
  assigneeIds?: string | null
  remark?: string | null
  creatorId?: string | number | null
  creatorName?: string | null
  creatorNickName?: string | null
  assigneeNickName?: string | null
  handlerNickName?: string | null
  createTime?: string | null
  status?: 0 | 3 | 6 | 9 | 99
  currentHandlerId?: string | number | null
  handlerId?: string | number | null
  handlerIds?: string | null
  receiveStatus?: number | null
  handleDesc?: string | null
  source?: string | null
  thirdId?: string | number | null
  fid?: string | number | null
  type?: number | string
}

export type TodayTodoStatus = 0 | 3 | 6 | 9
export type TodayTodoType = 1 | 2

export interface TodayTodoQuery {
  status?: TodayTodoStatus
  type?: TodayTodoType
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
  assigneeIds?: string
  remark?: string
  type?: number | string
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

interface SmartTodoCreatePayload {
  title: string
  timeType: 1 | 2
  startDateShow: string
  endDateShow?: string
  content: string
  assigneeIds?: string
  remark: string
  type: SmartTodoKind
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

function isValidDateText(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false

  const [year, month, day] = trimmed.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
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

function normalizeIsoDateTimeShow(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) return undefined

  return trimmed
    .replace('T', ' ')
    .replace(/\.\d{3}Z?$/, '')
    .replace(/Z$/, '')
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
  if (!isValidDateText(datePart)) {
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
  return isValidDateText(value)
}

function normalizeAnalyzeSchedule(data: SmartTodoAnalyzeData) {
  const isRangeByType = resolveAnalyzeTimeType(data.timeType) === 2
  const startFromDateTime = parseDateTimeShow(data.startDate, isRangeByType)
  const endFromDateTime = parseDateTimeShow(data.endDate, true)
  const startFromShow = parseDateTimeShow(data.startDateShow, isRangeByType)
  const endFromShow = parseDateTimeShow(data.endDateShow, true)
  const hasDateTimeRange = Boolean(startFromDateTime.date && endFromDateTime.date)
  const hasShowRange = Boolean(startFromShow.date && endFromShow.date)
  const isRange = isRangeByType || hasDateTimeRange || hasShowRange
  const preserveMidnight = isRange

  if (isValidAnalyzeDate(data.date)) {
    return {
      isRange,
      date: isRange && startFromDateTime.date ? startFromDateTime.date : data.date!.trim(),
      time: normalizeFormTime(data.time, preserveMidnight),
      endDate: isRange ? endFromDateTime.date || endFromShow.date : undefined,
      endTime: isRange ? endFromDateTime.time || endFromShow.time : undefined,
    }
  }

  if (isRange && startFromDateTime.date) {
    return {
      isRange: true,
      date: startFromDateTime.date,
      time: startFromDateTime.time,
      endDate: endFromDateTime.date || startFromDateTime.date,
      endTime: endFromDateTime.time,
    }
  }

  if (isRange && isValidAnalyzeDate(data.startDate)) {
    const startDate = data.startDate!.trim()
    const endDate = data.endDate?.trim()

    return {
      isRange: true,
      date: startDate,
      time: normalizeFormTime(data.time, true),
      endDate: isValidAnalyzeDate(endDate) ? endDate : startDate,
      endTime: normalizeFormTime(data.endTime, true),
    }
  }

  if (isRange && startFromShow.date) {
    return {
      isRange: true,
      date: startFromShow.date,
      time: startFromShow.time,
      endDate: endFromShow.date || startFromShow.date,
      endTime: endFromShow.time,
    }
  }

  const start = startFromShow.date ? startFromShow : startFromDateTime

  return {
    isRange: false,
    date: start.date,
    time: start.time,
    endDate: undefined,
    endTime: undefined,
  }
}

function resolveTodoKind(value?: number | string | null): SmartTodoKind {
  const normalized = typeof value === 'string' ? value.trim() : value
  if (normalized === 2 || normalized === '2' || normalized === 'meeting') return 2
  return 1
}

function resolveAssigneeIds(assigneeId?: string | number | null, assigneeIds?: string | null) {
  if (assigneeIds?.trim()) return assigneeIds.trim()
  if (assigneeId) return toId(assigneeId)
  return ''
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

function mapBackendEventType(value?: number | string | null): CalendarEvent['type'] {
  return resolveTodoKind(value) === 2 ? 'meeting' : 'task'
}

function normalizeBackendTodo(
  item: SmartTodoBackendItem,
  currentUser: CalendarUser,
  users: CalendarUser[] = [],
): CalendarEvent | null {
  const userMap = createUserMap(users)
  const id = toId(item.id)
  if (!id) return null
  const assigneeId = resolveAssigneeIds(item.assigneeId, item.assigneeIds)
  const creatorId = toId(item.creatorId)
  const currentHandlerId = toId(item.currentHandlerId) || toId(item.handlerId)
  const primaryAssigneeId = assigneeId.split(',')[0]?.trim() || ''
  const assignee = userMap.get(primaryAssigneeId)
  const creator = userMap.get(creatorId)
  const assigneeName =
    item.assigneeNickName?.trim() ||
    assignee?.name ||
    (assigneeId.includes(',')
      ? assigneeId
          .split(',')
          .map((value) => userMap.get(value.trim())?.name || value.trim())
          .join('、')
      : assigneeId) ||
    '未指定'
  const creatorName =
    item.creatorNickName?.trim() ||
    item.creatorName?.trim() ||
    creator?.name ||
    (creatorId === currentUser.id ? currentUser.name : '')
  const timeType = item.timeType === 2 ? 2 : 1
  const preserveMidnight = timeType === 2
  const startDateShow = item.startDateShow || normalizeIsoDateTimeShow(item.startDate)
  const endDateShow = item.endDateShow || normalizeIsoDateTimeShow(item.endDate)
  const start = parseDateTimeShow(startDateShow, preserveMidnight)
  const end = parseDateTimeShow(endDateShow, preserveMidnight)
  const date = start.date
  if (!date) return null
  const endDate = timeType === 2 ? end.date || date : undefined
  const title = item.title?.trim() || item.content?.trim() || ''
  if (!title) return null
  const status = mapBackendStatus(item.status)
  const isRejected = item.status === 9
  const completable = isRejected
    ? false
    : resolveCompletable(assigneeId, currentHandlerId, currentUser)

  return {
    id,
    date,
    endDate,
    time: start.time,
    endTime: timeType === 2 ? end.time : undefined,
    title,
    type: mapBackendEventType(item.type),
    owner: assigneeName,
    status,
    source: item.remark?.trim() || undefined,
    creatorId: creatorId || undefined,
    creatorName: creatorName || undefined,
    assigneeId: assigneeId || undefined,
    assigneeName,
    scope: resolveScope(creatorId, assigneeId, currentUser),
    editable: !isRejected && status !== 'done' && (!creatorId || creatorId === currentUser.id),
    completable,
    backendStatus: item.status,
    receiveStatus: item.receiveStatus ?? undefined,
    timeType,
    startDateShow: startDateShow || undefined,
    endDateShow: endDateShow || undefined,
    handlerName:
      item.handlerNickName?.trim() ||
      userMap.get(currentHandlerId)?.name ||
      (currentHandlerId ? currentHandlerId : undefined) ||
      '未指定',
    handleDesc: item.handleDesc?.trim() || undefined,
    currentHandlerId: currentHandlerId || undefined,
    handlerIds: item.handlerIds ?? undefined,
    content: item.content ?? undefined,
    remark: item.remark ?? undefined,
  }
}

function dedupeLinkedBackendTodoItems(items: SmartTodoBackendItem[]) {
  const ids = new Set(items.map((item) => toId(item.id)).filter(Boolean))

  // 派发待办时后台会返回主待办（fid 为空）和子待办（fid 指向主待办 id）。
  // 同一列表里两者内容重复，保留主待办即可。
  return items.filter((item) => {
    const parentId = toId(item.fid)
    if (!parentId) return true
    return !ids.has(parentId)
  })
}

function normalizeBackendTodos(
  items: SmartTodoBackendItem[],
  currentUser: CalendarUser,
  users: CalendarUser[] = [],
) {
  return dedupeLinkedBackendTodoItems(items.filter((item) => item.status !== 99))
    .map((item) => normalizeBackendTodo(item, currentUser, users))
    .filter((item): item is CalendarEvent => Boolean(item))
    .sort(compareEvents)
}

function matchAssignableUser(token: string, assignableUsers: CalendarUser[]) {
  if (!token) return undefined

  return assignableUsers.find(
    (user) => user.id === token || user.name === token || token.includes(user.name),
  )
}

function findAssignees(
  assigneeId: string | number | undefined,
  assigneeIds: string | undefined,
  currentUser: CalendarUser,
  assignableUsers: CalendarUser[],
  fallback: ParsedTodoDraft,
) {
  const rawIds = resolveAssigneeIds(assigneeId, assigneeIds)
  const ids = rawIds
    ? rawIds
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : []

  if (ids.length === 0) {
    return findAssignee(assigneeId, currentUser, assignableUsers, fallback)
  }

  const matched = ids.map(
    (token) => matchAssignableUser(token, assignableUsers) ?? { id: token, name: token },
  )

  return {
    id: matched.map((user) => user.id).join(','),
    name: matched.map((user) => user.name).join('、'),
  }
}

function findAssignee(
  assigneeText: string | number | undefined,
  currentUser: CalendarUser,
  assignableUsers: CalendarUser[],
  fallback: ParsedTodoDraft,
) {
  const normalizedAssignee = toId(assigneeText)
  const matchedAssignee = matchAssignableUser(normalizedAssignee, assignableUsers)

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
  const assignee = findAssignees(
    data.assigneeId,
    data.assigneeIds,
    currentUser,
    assignableUsers,
    fallback,
  )

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
    source: data.remark?.trim() || undefined,
    type: resolveTodoKind(data.type ?? fallback.type),
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

function buildSmartTodoCreatePayload(payload: CalendarTodoDraft): SmartTodoCreatePayload {
  const isRange = Boolean(payload.endDate)
  const content = payload.title.trim()
  const title = payload.aiPrompt?.trim() || ''

  if (isRange) {
    const endDate = payload.endDate || payload.date
    const endTime = payload.endTime?.trim()

    return {
      title,
      timeType: 2,
      startDateShow: buildDateTimeShow(payload.date, payload.time),
      endDateShow: endTime ? buildDateTimeShow(endDate, endTime) : `${endDate} 23:59:59`,
      content,
      assigneeIds: payload.assigneeId?.trim() || undefined,
      remark: payload.source?.trim() || '',
      type: resolveTodoKind(payload.type),
    }
  }

  return {
    title,
    timeType: 1,
    startDateShow: buildDateTimeShow(payload.date, payload.time),
    content,
    assigneeIds: payload.assigneeId?.trim() || undefined,
    remark: payload.source?.trim() || '',
    type: resolveTodoKind(payload.type),
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

// 认证相关接口已迁移至 auth 模块（src/modules/auth/services/auth.service.ts）。
// 为兼容既有引用（测试、store、DashboardTopBar、DashboardPage 等），此处保留 re-export。
export {
  loginSmartTodo,
  logoutSmartTodo,
  loadCurrentUser,
  selectEmailProvider,
} from '@/modules/auth/services/auth.service'
export type {
  SmartTodoLoginCredentials,
  SmartTodoCurrentUser,
  SmartTodoEmailProvider,
} from '@/modules/auth/services/auth.service'

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

  return normalizeBackendTodos(items, currentUser, users).filter(
    (event) => event.backendStatus !== 9,
  )
}

export async function loadTodayTodos(
  currentUser: CalendarUser,
  users: CalendarUser[] = [],
  query: TodayTodoQuery = {},
) {
  const items = await requestSmartTodoData<SmartTodoBackendItem[]>(
    {
      method: 'GET',
      url: '/smart-todo/today-list',
      params: {
        status: query.status,
        type: query.type,
      },
    },
    '查询当天待办失败',
  )

  return normalizeBackendTodos(items, currentUser, users)
}

interface SmartTodoDetailResponse {
  mainTodo?: SmartTodoBackendItem | null
  childTodoList?: SmartTodoBackendItem[] | null
}

function extractTodoDetailItem(
  data: SmartTodoBackendItem | SmartTodoDetailResponse | null | undefined,
): SmartTodoBackendItem | null {
  if (!data) return null
  if (typeof data === 'object' && 'mainTodo' in data) {
    return data.mainTodo ?? null
  }
  return data as SmartTodoBackendItem
}

function extractChildTodoList(
  data: SmartTodoBackendItem | SmartTodoDetailResponse | null | undefined,
) {
  if (!data || typeof data !== 'object' || !('childTodoList' in data)) return []

  return (data.childTodoList ?? []).filter((item): item is SmartTodoBackendItem => Boolean(item))
}

export async function loadTodoDetail(
  id: string,
  currentUser: CalendarUser,
  users: CalendarUser[] = [],
) {
  const data = await requestSmartTodoData<SmartTodoBackendItem | SmartTodoDetailResponse>(
    {
      method: 'GET',
      url: `/smart-todo/${encodeURIComponent(id)}`,
    },
    '查询待办详情失败',
  )

  const item = extractTodoDetailItem(data)
  if (!item) {
    throw new Error('查询待办详情失败')
  }

  const todo = normalizeBackendTodo(item, currentUser, users)
  if (!todo) {
    throw new Error('查询待办详情失败，返回数据不完整')
  }
  const childTodos = extractChildTodoList(data)
    .map((child) => normalizeBackendTodo(child, currentUser, users))
    .filter((child): child is CalendarEvent => Boolean(child))
    .sort(compareEvents)

  if (childTodos.length) {
    todo.childTodos = childTodos
  }

  return todo
}

export async function createTodo(payload: CalendarTodoDraft) {
  return requestSmartTodoData<string | number>(
    {
      method: 'POST',
      url: '/smart-todo/create',
      data: buildSmartTodoCreatePayload(payload),
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

export async function completeTodo(id: string, currentUser: CalendarUser, handleDesc = '已完成') {
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
          (event.backendStatus !== 9 &&
            event.status !== 'done' &&
            (!creatorId || creatorId === currentUser.id)),
        completable:
          event.completable ??
          (event.backendStatus === 9
            ? false
            : resolveCompletable(assigneeId, event.currentHandlerId ?? '', currentUser)),
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
  _users?: CalendarUser[],
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
