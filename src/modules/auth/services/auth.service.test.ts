import { beforeEach, describe, expect, it, vi } from 'vitest'
import { httpClient } from '@/shared/request/http'
import { loadCurrentUser, markUserFeatureUsed } from './auth.service'

vi.mock('@/shared/request/http', () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

function mockGetInfo(
  options: {
    tokensPower?: boolean
    managerDashboardUrl?: string | null
    usedFeatureCodes?: string[]
  } = {},
) {
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
      ...(options.usedFeatureCodes === undefined
        ? {}
        : { usedFeatureCodes: options.usedFeatureCodes }),
    },
  })
}

describe('auth.service current user token dashboard permission', () => {
  beforeEach(() => {
    vi.mocked(httpClient.get).mockReset()
    vi.mocked(httpClient.post).mockReset()
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

  it('maps usedFeatureCodes from getInfo', async () => {
    mockGetInfo({ usedFeatureCodes: ['user_guide_init'] })

    await expect(loadCurrentUser()).resolves.toMatchObject({
      usedFeatureCodes: ['user_guide_init'],
    })
  })

  it('marks a user feature as used', async () => {
    vi.mocked(httpClient.post).mockResolvedValueOnce({
      data: { code: 200, data: true },
    })

    await expect(
      markUserFeatureUsed('user_guide_init', {
        version: 'v1',
        remark: '已完成用户导览',
      }),
    ).resolves.toBe(true)

    expect(httpClient.post).toHaveBeenCalledWith(
      '/user-feature-status/mark-used',
      {
        featureCode: 'user_guide_init',
        version: 'v1',
        remark: '已完成用户导览',
      },
      expect.objectContaining({ showError: false }),
    )
  })
})
