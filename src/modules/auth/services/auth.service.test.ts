import { beforeEach, describe, expect, it, vi } from 'vitest'
import { httpClient } from '@/shared/request/http'
import { loadCurrentUser } from './auth.service'

vi.mock('@/shared/request/http', () => ({
  httpClient: {
    get: vi.fn(),
  },
}))

function mockGetInfo(options: { tokensPower?: boolean; managerDashboardUrl?: string | null } = {}) {
  vi.mocked(httpClient.get).mockResolvedValueOnce({
    data: {
      code: 200,
      user: {
        userId: 1,
        userName: '1102080',
        nickName: '李四',
      },
      roles: ['admin'],
      permissions: ['*:*:*'],
      ...(options.tokensPower === undefined ? {} : { tokensPower: options.tokensPower }),
      ...(options.managerDashboardUrl === undefined
        ? {}
        : { managerDashboardUrl: options.managerDashboardUrl }),
    },
  })
}

describe('auth.service current user token dashboard permission', () => {
  beforeEach(() => {
    vi.mocked(httpClient.get).mockReset()
  })

  it('maps tokensPower=true from getInfo', async () => {
    mockGetInfo({ tokensPower: true })

    await expect(loadCurrentUser()).resolves.toMatchObject({ tokensPower: true })
  })

  it('defaults tokensPower to false when getInfo does not explicitly return true', async () => {
    mockGetInfo()

    await expect(loadCurrentUser()).resolves.toMatchObject({ tokensPower: false })
  })

  it('maps a non-empty managerDashboardUrl from getInfo', async () => {
    mockGetInfo({ managerDashboardUrl: ' https://example.com/manager-dashboard ' })

    await expect(loadCurrentUser()).resolves.toMatchObject({
      managerDashboardUrl: 'https://example.com/manager-dashboard',
    })
  })
})
