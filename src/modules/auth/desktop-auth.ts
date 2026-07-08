import type { LocationQuery } from 'vue-router'
import type { UserProfile } from '@/stores/user.store'

export const DESKTOP_AUTH_CALLBACK = 'huali-ai-mascot://auth-callback'
export const DESKTOP_CLIENT = 'huali-ai-mascot'

export interface DesktopAuthRequest {
  callback: string
  state: string
}

export interface DesktopLaunchRequest {
  client: string
  userId: string
}

export interface DesktopAuthCallbackParams {
  callback: string
  state: string
  token: string
  profile: Pick<UserProfile, 'id'> & Partial<Pick<UserProfile, 'name' | 'department'>>
}

function getFirstQueryString(value: LocationQuery[string]) {
  const firstValue = Array.isArray(value) ? value[0] : value
  return typeof firstValue === 'string' ? firstValue.trim() : ''
}

export function getDesktopAuthRequest(query: LocationQuery): DesktopAuthRequest | null {
  const from = getFirstQueryString(query.from)
  const callback = getFirstQueryString(query.desktopCallback)
  const state = getFirstQueryString(query.state)

  if (from !== 'desktop') return null
  if (callback !== DESKTOP_AUTH_CALLBACK) return null
  if (!state) return null

  return {
    callback,
    state,
  }
}

export function getDesktopLaunchRequest(query: LocationQuery): DesktopLaunchRequest | null {
  const from = getFirstQueryString(query.from)
  const client = getFirstQueryString(query.desktopClient)
  const userId = getFirstQueryString(query.desktopUserId)

  if (from !== 'desktop') return null
  if (client !== DESKTOP_CLIENT) return null
  if (!userId) return null

  return {
    client,
    userId,
  }
}

export function isDesktopUserMismatch(query: LocationQuery, currentUserId?: string | null) {
  const request = getDesktopLaunchRequest(query)
  if (!request) return false

  const normalizedCurrentUserId = currentUserId?.trim()
  if (!normalizedCurrentUserId) return false

  return request.userId !== normalizedCurrentUserId
}

export function buildDesktopAuthCallbackUrl(params: DesktopAuthCallbackParams) {
  const url = new URL(params.callback)

  url.searchParams.set('token', params.token)
  url.searchParams.set('userId', params.profile.id)
  url.searchParams.set('state', params.state)

  if (params.profile.name) {
    url.searchParams.set('userName', params.profile.name)
  }

  if (params.profile.department) {
    url.searchParams.set('department', params.profile.department)
  }

  return url.toString()
}

export function redirectDesktopAuthCallback(params: DesktopAuthCallbackParams) {
  window.location.href = buildDesktopAuthCallbackUrl(params)
}
