import { describe, expect, it } from 'vitest'
import {
  buildDesktopAuthCallbackUrl,
  DESKTOP_AUTH_CALLBACK,
  DESKTOP_CLIENT,
  getDesktopLaunchRequest,
  getDesktopAuthRequest,
  isDesktopUserMismatch,
} from './desktop-auth'

describe('desktop-auth', () => {
  it('recognizes a valid desktop auth request', () => {
    expect(
      getDesktopAuthRequest({
        from: 'desktop',
        desktopCallback: DESKTOP_AUTH_CALLBACK,
        state: 'state-123',
      }),
    ).toEqual({
      callback: DESKTOP_AUTH_CALLBACK,
      state: 'state-123',
    })
  })

  it('rejects non-desktop auth requests', () => {
    expect(
      getDesktopAuthRequest({
        from: 'web',
        desktopCallback: DESKTOP_AUTH_CALLBACK,
        state: 'state-123',
      }),
    ).toBeNull()
    expect(
      getDesktopAuthRequest({
        from: 'desktop',
        desktopCallback: 'huali-ai-mascot://other',
        state: 'state-123',
      }),
    ).toBeNull()
    expect(
      getDesktopAuthRequest({
        from: 'desktop',
        desktopCallback: DESKTOP_AUTH_CALLBACK,
        state: '',
      }),
    ).toBeNull()
  })

  it('builds an encoded callback URL with the required identity fields', () => {
    const callbackUrl = buildDesktopAuthCallbackUrl({
      callback: DESKTOP_AUTH_CALLBACK,
      state: 'state 123',
      token: 'token+value',
      profile: {
        id: 'user/001',
        name: '张 三',
        department: '信息技术部/AI',
      },
    })
    const url = new URL(callbackUrl)

    expect(url.protocol).toBe('huali-ai-mascot:')
    expect(url.host).toBe('auth-callback')
    expect(url.searchParams.get('token')).toBe('token+value')
    expect(url.searchParams.get('userId')).toBe('user/001')
    expect(url.searchParams.get('state')).toBe('state 123')
    expect(url.searchParams.get('userName')).toBe('张 三')
    expect(url.searchParams.get('department')).toBe('信息技术部/AI')
    expect(callbackUrl).toContain('token=token%2Bvalue')
    expect(callbackUrl).toContain('userId=user%2F001')
  })

  it('recognizes desktop launch identity parameters', () => {
    expect(
      getDesktopLaunchRequest({
        from: 'desktop',
        desktopClient: DESKTOP_CLIENT,
        desktopUserId: 'user-001',
      }),
    ).toEqual({
      client: DESKTOP_CLIENT,
      userId: 'user-001',
    })
  })

  it('compares desktop and web user ids', () => {
    const query = {
      from: 'desktop',
      desktopClient: DESKTOP_CLIENT,
      desktopUserId: 'desktop-user',
    }

    expect(isDesktopUserMismatch(query, 'desktop-user')).toBe(false)
    expect(isDesktopUserMismatch(query, 'web-user')).toBe(true)
    expect(isDesktopUserMismatch(query, '')).toBe(false)
  })
})
