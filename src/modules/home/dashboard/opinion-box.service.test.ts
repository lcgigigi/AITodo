import { beforeEach, describe, expect, it, vi } from 'vitest'
import { httpClient } from '@/shared/request/http'
import {
  DAILY_OPINION_LIMIT,
  loadTodayOpinionCount,
  submitOpinion,
  toOpinionType,
} from './opinion-box.service'

vi.mock('@/shared/request/http', () => ({
  httpClient: {
    request: vi.fn(),
  },
}))

function backendResponse<T>(data: T, code = 200, msg = '操作成功') {
  return Promise.resolve({
    data: {
      code,
      msg,
      data,
    },
  })
}

describe('opinion-box.service', () => {
  beforeEach(() => {
    vi.mocked(httpClient.request).mockReset()
  })

  it('maps opinion categories to backend type codes', () => {
    expect(toOpinionType('feature')).toBe(1)
    expect(toOpinionType('experience')).toBe(2)
    expect(toOpinionType('bug')).toBe(3)
    expect(toOpinionType('other')).toBe(4)
  })

  it('submits trimmed opinion content with type', async () => {
    vi.mocked(httpClient.request).mockResolvedValueOnce(backendResponse(true) as never)

    await expect(
      submitOpinion({
        content: '  这是一条意见  ',
        type: 1,
      }),
    ).resolves.toBe(true)

    expect(httpClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/opinion-box/submit',
        data: {
          content: '这是一条意见',
          type: 1,
        },
        showError: false,
      }),
    )
  })

  it('rejects empty opinion content before request', async () => {
    await expect(
      submitOpinion({
        content: '   ',
        type: 1,
      }),
    ).rejects.toThrow('意见内容不能为空')

    expect(httpClient.request).not.toHaveBeenCalled()
  })

  it('rejects invalid opinion type before request', async () => {
    await expect(
      submitOpinion({
        content: '意见内容',
        type: 5 as 1,
      }),
    ).rejects.toThrow('意见类型无效')

    expect(httpClient.request).not.toHaveBeenCalled()
  })

  it('throws when submit response code is not 200', async () => {
    vi.mocked(httpClient.request).mockResolvedValueOnce(
      backendResponse(null, 500, '当天已提交 3 条') as never,
    )

    await expect(
      submitOpinion({
        content: '意见内容',
        type: 2,
      }),
    ).rejects.toThrow('当天已提交 3 条')
  })

  it('loads today opinion count', async () => {
    vi.mocked(httpClient.request).mockResolvedValueOnce(backendResponse(2) as never)

    await expect(loadTodayOpinionCount()).resolves.toBe(2)

    expect(httpClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/opinion-box/today-count',
        showError: false,
      }),
    )
  })

  it('falls back to zero when today count request fails', async () => {
    vi.mocked(httpClient.request).mockRejectedValueOnce(new Error('network error'))

    await expect(loadTodayOpinionCount()).resolves.toBe(0)
  })

  it('exposes daily opinion limit constant', () => {
    expect(DAILY_OPINION_LIMIT).toBe(3)
  })
})
