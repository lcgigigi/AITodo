import { beforeEach, describe, expect, it, vi } from 'vitest'
import { httpClient } from '@/shared/request/http'
import { getCurrentMonthKey, loadAdminTokenDashboard } from './token-usage.service'

vi.mock('@/shared/request/http', () => ({
  httpClient: {
    request: vi.fn(),
  },
}))

function backendResponse<T>(data: T) {
  return Promise.resolve({
    data: {
      code: 200,
      msg: '操作成功',
      data,
    },
  })
}

describe('token-usage.service admin dashboard', () => {
  beforeEach(() => {
    vi.mocked(httpClient.request).mockReset()
  })

  it('loads and normalizes admin dashboard for month query with month param', async () => {
    vi.mocked(httpClient.request).mockResolvedValueOnce(
      backendResponse({
        totalTokenUsage: 123456,
        queryType: 'month',
        startPeriod: '2026-06-01',
        endPeriod: '2026-06-30',
        trendList: [
          { period: '2026-06-30', tokenUsage: '300' },
          { period: '2026-06-01', tokenUsage: 1000 },
        ],
        deptDistributionList: [{ deptId: 1001, deptName: '某部门', tokenUsage: 30000 }],
        moduleDistributionList: [
          { bizModule: 'codeAssist', bizModuleName: '代码辅助', tokenUsage: 50000 },
        ],
      }) as never,
    )

    await expect(
      loadAdminTokenDashboard({
        queryType: 'month',
        month: '2026-06',
      }),
    ).resolves.toEqual({
      totalTokenUsage: 123456,
      queryType: 'month',
      startPeriod: '2026-06-01',
      endPeriod: '2026-06-30',
      trendList: [
        { period: '2026-06-01', tokenUsage: 1000 },
        { period: '2026-06-30', tokenUsage: 300 },
      ],
      deptDistributionList: [{ deptId: '1001', deptName: '某部门', tokenUsage: 30000 }],
      moduleDistributionList: [
        { moduleCode: 'codeAssist', moduleName: '代码辅助', tokenUsage: 50000 },
      ],
    })

    expect(httpClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/token-usage/admin-dashboard',
        params: {
          queryType: 'month',
          month: '2026-06',
        },
      }),
    )
  })

  it('defaults month query to current month when month is omitted', async () => {
    vi.mocked(httpClient.request).mockResolvedValueOnce(
      backendResponse({
        totalTokenUsage: 0,
        queryType: 'month',
        startPeriod: '2026-07-01',
        endPeriod: '2026-07-31',
        trendList: [],
        deptDistributionList: [],
        moduleDistributionList: [],
      }) as never,
    )

    await loadAdminTokenDashboard({ queryType: 'month' })

    expect(httpClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        params: {
          queryType: 'month',
          month: getCurrentMonthKey(),
        },
      }),
    )
  })

  it('loads year dashboard without month param', async () => {
    vi.mocked(httpClient.request).mockResolvedValueOnce(
      backendResponse({
        totalTokenUsage: 888,
        queryType: 'year',
        startPeriod: '2026-01',
        endPeriod: '2026-07',
        trendList: [{ period: '2026-07', tokenUsage: 888 }],
        deptDistributionList: [],
        moduleDistributionList: [],
      }) as never,
    )

    await expect(loadAdminTokenDashboard({ queryType: 'year' })).resolves.toMatchObject({
      queryType: 'year',
      startPeriod: '2026-01',
      endPeriod: '2026-07',
    })

    expect(httpClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        params: {
          queryType: 'year',
        },
      }),
    )
  })

  it('throws when admin dashboard response code is not 200', async () => {
    vi.mocked(httpClient.request).mockResolvedValueOnce({
      data: {
        code: 500,
        msg: '查询失败',
        data: null,
      },
    } as never)

    await expect(loadAdminTokenDashboard({ queryType: 'year' })).rejects.toThrow('查询失败')
  })
})
