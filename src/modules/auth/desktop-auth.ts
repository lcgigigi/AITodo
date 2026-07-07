import type { LocationQuery } from 'vue-router'
import type { UserProfile } from '@/stores/user.store'

export const DESKTOP_AUTH_CALLBACK = 'huali-ai-mascot://auth-callback'

export interface DesktopAuthRequest {
  callback: string
  state: string
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
