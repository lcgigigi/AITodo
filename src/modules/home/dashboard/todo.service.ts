import axios from 'axios'
import type { AxiosRequestConfig } from 'axios'
import { httpClient } from '@/shared/request/http'
import { setupInterceptors } from '@/shared/request/interceptors'
import type {
  CalendarEvent,
  CalendarEventStatus,
  CalendarTodoDraft,
  CalendarTodoUpdate,
  CalendarUser,
  ParsedTodoDraft,
} from './types'
import { addDays, compareDate, parseDate, ymd } from './todoDisplay'
import {
  createTodo as createMockTodo,
  deleteTodo as deleteMockTodo,
  listTodos as listMockTodos,
  mockInitialTodos,
  mockUsers,
  parseTodoText as parseMockTodoText,
  updateTodo as updateMockTodo,
  updateTodoStatus as updateMockTodoStatus,
} from './todoMock'

export const TODO_STORAGE_KEY = 'ai-workbench.todos.v1'

const seedAnchorDate = '2026-05-04'
const SMART_TODO_CREATE_PATH = '/smart-todocreate'
const SMART_TODO_USER_LIST_PATH = '/smart-todouser-list'
const SMART_TODO_GENERATE_PATH = '/smartTodoGenerate'
const SMART_TODO_REQUEST_TIMEOUT = 20_000

interface SmartTodoResponse<T> {
  code?: number
  msg?: string
  message?: string
  data: T | null
  success?: boolean
}

interface SmartTodoBackendUser {
  badge?: string | number
  name?: string
}

interface SmartTodoCreatePayload {
  title: string
  timeType: 1 | 2 | 3 | 4 | 5
  specificDate?: string
  specificTime?: string
  startDate?: string
  endDate?: string
  content?: string
  assigneeId?: string
  remark?: string
}

interface SmartTodoGenerateResponse {
  state?: string
  message?: string
  msg?: string
  data?: SmartTodoGenerateData | null
}

interface SmartTodoGenerateData {
  assigneeId?: string
  date?: string
  endDate?: string
  startDate?: string
  task?: string
  time?: string
  timeType?: string
}

const smartTodoAiClient = axios.create({
  baseURL: import.meta.env.VITE_APP_GPT_API || '/gptData',
  timeout: SMART_TODO_REQUEST_TIMEOUT,
})

setupInterceptors(smartTodoAiClient)

function isBrowserStorageAvailable() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function cloneEvents(events: CalendarEvent[]) {
  return events.map((event) => ({ ...event }))
}

function shiftDate(date: string, days: number) {
  return ymd(addDays(parseDate(date), days))
}

function getWeekStart(date: Date) {
  const start = new Date(date)
  start.setHours(12, 0, 0, 0)
  const offset = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - offset)
  return start
}

function shouldUseRemoteSmartTodoApi() {
  return import.meta.env.MODE !== 'test'
}

function getMockAssignableUsers(currentUser: CalendarUser) {
  if (currentUser.role === 'leader') {
    const teamIds = currentUser.teamMemberIds ?? []
    return mockUsers.filter((user) => user.id === currentUser.id || teamIds.includes(user.id))
  }

  return [currentUser]
}

function unwrapSmartTodoResponse<T>(response: SmartTodoResponse<T>, fallbackMessage: string): T {
  if (response.success === false) {
    throw new Error(response.message || response.msg || fallbackMessage)
  }

  if (typeof response.code === 'number' && response.code !== 200) {
    throw new Error(response.msg || response.message || fallbackMessage)
  }

  if (response.data === null || response.data === undefined) {
    throw new Error(response.msg || response.message || fallbackMessage)
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

function normalizeBackendUsers(users: SmartTodoBackendUser[]) {
  return users
    .map((user): CalendarUser | null => {
      const id = String(user.badge ?? '').trim()
      const name = String(user.name ?? '').trim()

      if (!id || !name) return null

      return {
        id,
        name,
        role: 'employee',
      }
    })
    .filter((user): user is CalendarUser => Boolean(user))
}

function isLocalMockUserId(id?: string) {
  if (!id) return true
  return id === 'mock-user' || id.startsWith('leader-') || id.startsWith('employee-')
}

function normalizeBackendTime(time?: string) {
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

function normalizeFormTime(time?: string) {
  const backendTime = normalizeBackendTime(time)
  return backendTime.slice(0, 5)
}

function buildSmartTodoPayload(payload: CalendarTodoDraft): SmartTodoCreatePayload {
  const title = payload.title.trim()
  const assigneeId = payload.assigneeId?.trim()
  const remark = payload.source?.trim()
  const data: SmartTodoCreatePayload = {
    title,
    timeType: payload.endDate ? 2 : 1,
    content: title,
  }

  if (payload.endDate) {
    data.startDate = payload.date
    data.endDate = payload.endDate
  } else {
    data.specificDate = payload.date
    data.specificTime = normalizeBackendTime(payload.time)
  }

  if (assigneeId && !isLocalMockUserId(assigneeId)) {
    data.assigneeId = assigneeId
  }

  if (remark) {
    data.remark = remark
  }

  return data
}

function createEventFromBackendId(
  id: string | number,
  currentUser: CalendarUser,
  payload: CalendarTodoDraft,
): CalendarEvent {
  const assigneeName = payload.assigneeName ?? payload.owner ?? currentUser.name
  const assigneeId =
    payload.assigneeId && !isLocalMockUserId(payload.assigneeId)
      ? payload.assigneeId
      : currentUser.id

  return {
    id: `backend-${String(id)}`,
    date: payload.date,
    endDate: payload.endDate && payload.endDate !== payload.date ? payload.endDate : undefined,
    time: payload.time,
    title: payload.title.trim(),
    type: 'task',
    owner: assigneeName,
    status: 'todo',
    source: payload.source?.trim() || '自建待办',
    creatorId: currentUser.id,
    creatorName: currentUser.name,
    assigneeId,
    assigneeName,
  }
}

function resolveParsedAssignee(
  assigneeText: string | undefined,
  currentUser: CalendarUser,
  assignableUsers: CalendarUser[],
  fallback: ParsedTodoDraft,
) {
  const normalizedAssignee = assigneeText?.trim()
  const matchedAssignee = assignableUsers.find(
    (user) =>
      normalizedAssignee &&
      (user.id === normalizedAssignee ||
        user.name === normalizedAssignee ||
        normalizedAssignee.includes(user.name)),
  )

  if (matchedAssignee) return matchedAssignee

  return {
    id: fallback.assigneeId ?? currentUser.id,
    name: normalizedAssignee || fallback.assigneeName || fallback.owner || currentUser.name,
  }
}

async function parseRemoteTodoText(
  text: string,
  currentUser: CalendarUser,
  assignableUsers: CalendarUser[],
  fallback: ParsedTodoDraft,
): Promise<ParsedTodoDraft> {
  const response = await smartTodoAiClient.post<SmartTodoGenerateResponse>(
    SMART_TODO_GENERATE_PATH,
    {
      text: text.trim(),
    },
  )
  const result = response.data

  if (result.state !== 'success' || !result.data) {
    throw new Error(result.message || result.msg || 'AI分析待办失败')
  }

  const data = result.data
  const timeType = data.timeType ?? ''
  const isDeadline = timeType.includes('deadline')
  const date = data.startDate?.trim() || data.date?.trim() || fallback.date
  const endDate = isDeadline
    ? data.endDate?.trim() || data.date?.trim() || date
    : data.endDate?.trim() || fallback.endDate
  const assignee = resolveParsedAssignee(data.assigneeId, currentUser, assignableUsers, fallback)

  return {
    date,
    endDate: endDate || undefined,
    time: isDeadline ? undefined : normalizeFormTime(data.time ?? fallback.time),
    title: data.task?.trim() || fallback.title?.trim() || text.trim(),
    owner: assignee.name,
    assigneeId: assignee.id,
    assigneeName: assignee.name,
    source: fallback.source || 'AI预填',
  }
}

export function createSeedTodos(now = new Date()): CalendarEvent[] {
  const seedStart = getWeekStart(now)
  const shiftDays = Math.round(
    (seedStart.getTime() - parseDate(seedAnchorDate).getTime()) / 86_400_000,
  )

  return mockInitialTodos.map((event) => ({
    ...event,
    id: `seed-${event.id}`,
    date: shiftDate(event.date, shiftDays),
    endDate: event.endDate ? shiftDate(event.endDate, shiftDays) : undefined,
    priority: event.priority ?? 'normal',
  }))
}

function normalizeTodo(event: CalendarEvent): CalendarEvent {
  const removedLegacyKey = ['completion', 'Ideas'].join('')
  const todo = Object.fromEntries(
    Object.entries(event).filter(([key]) => key !== removedLegacyKey),
  ) as CalendarEvent

  return {
    ...todo,
    endDate: todo.endDate && compareDate(todo.endDate, todo.date) >= 0 ? todo.endDate : undefined,
    time: todo.time || undefined,
    title: todo.title.trim(),
    owner: todo.owner || todo.assigneeName || '未指定',
    status: todo.status === 'done' ? 'done' : 'todo',
    priority: todo.priority === 'urgent' ? 'urgent' : 'normal',
    source: todo.source?.trim() || undefined,
  }
}

export function saveTodos(events: CalendarEvent[]) {
  const normalizedEvents = events.map(normalizeTodo)

  if (isBrowserStorageAvailable()) {
    window.localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(normalizedEvents))
  }

  return cloneEvents(normalizedEvents)
}

export function loadTodos(now = new Date()) {
  if (isBrowserStorageAvailable()) {
    const raw = window.localStorage.getItem(TODO_STORAGE_KEY)

    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return saveTodos(parsed as CalendarEvent[])
      } catch {
        window.localStorage.removeItem(TODO_STORAGE_KEY)
      }
    }
  }

  return saveTodos(createSeedTodos(now))
}

export function listTodos(events: CalendarEvent[], currentUser: CalendarUser) {
  return listMockTodos(events, currentUser)
}

export async function loadAssignableUsers(currentUser: CalendarUser) {
  if (!shouldUseRemoteSmartTodoApi()) return getMockAssignableUsers(currentUser)

  try {
    const users = await requestSmartTodoData<SmartTodoBackendUser[]>(
      {
        method: 'GET',
        url: SMART_TODO_USER_LIST_PATH,
      },
      '查询用户列表失败',
    )
    const normalizedUsers = normalizeBackendUsers(users)

    return normalizedUsers.length ? normalizedUsers : getMockAssignableUsers(currentUser)
  } catch (error) {
    console.warn('[smart-todo] user-list fallback:', error)
    return getMockAssignableUsers(currentUser)
  }
}

export async function createTodo(
  events: CalendarEvent[],
  currentUser: CalendarUser,
  payload: CalendarTodoDraft,
) {
  if (shouldUseRemoteSmartTodoApi()) {
    const createdId = await requestSmartTodoData<string | number>(
      {
        method: 'POST',
        url: SMART_TODO_CREATE_PATH,
        data: buildSmartTodoPayload(payload),
      },
      '创建待办事项失败',
    )

    return saveTodos([...events, createEventFromBackendId(createdId, currentUser, payload)])
  }

  return saveTodos(createMockTodo(events, currentUser, payload))
}

export function updateTodo(
  events: CalendarEvent[],
  currentUser: CalendarUser,
  payload: CalendarTodoUpdate,
) {
  return saveTodos(updateMockTodo(events, currentUser, payload))
}

export function updateTodoStatus(
  events: CalendarEvent[],
  currentUser: CalendarUser,
  id: string,
  status: CalendarEventStatus,
) {
  return saveTodos(updateMockTodoStatus(events, currentUser, id, status))
}

export function deleteTodo(events: CalendarEvent[], currentUser: CalendarUser, id: string) {
  return saveTodos(deleteMockTodo(events, currentUser, id))
}

export function parseTodoText(
  text: string,
  currentUser: CalendarUser,
  assignableUsers: CalendarUser[],
  fallback: ParsedTodoDraft,
) {
  if (shouldUseRemoteSmartTodoApi()) {
    return parseRemoteTodoText(text, currentUser, assignableUsers, fallback).catch((error) => {
      console.warn('[smart-todo] ai-parse fallback:', error)
      return parseMockTodoText(text, currentUser, assignableUsers, fallback)
    })
  }

  return parseMockTodoText(text, currentUser, assignableUsers, fallback)
}
