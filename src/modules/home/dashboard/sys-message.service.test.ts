import { beforeEach, describe, expect, it, vi } from 'vitest'
import { httpClient } from '@/shared/request/http'
import {
  buildSysMessageWebSocketUrl,
  deleteSysMessages,
  loadSysMessages,
  markAllSysMessagesRead,
  markSysMessagesRead,
  normalizeSysMessagePush,
} from './sys-message.service'

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

describe('sys-message.service', () => {
  beforeEach(() => {
    vi.mocked(httpClient.request).mockReset()
  })

  it('loads and normalizes paged sys messages', async () => {
    vi.mocked(httpClient.request).mockResolvedValueOnce(
      backendResponse({
        total: 2,
        rows: [
          {
            id: 1,
            msgSubject: '您有一条新的待办',
            msgContent: '创建人：10001\n标题：测试待办',
            receiverEmpNo: '10002',
            msgStatus: 0,
            msgType: 1,
            bizType: 1,
            bizId: 123,
            deletedFlag: 0,
            createTime: '2026-06-17T10:00:00',
            readTime: null,
            deletedTime: null,
          },
        ],
      }) as never,
    )

    await expect(
      loadSysMessages({ pageNum: 1, pageSize: 10, msgStatus: 0, bizType: 1 }),
    ).resolves.toMatchObject({
      total: 2,
      pageNum: 1,
      pageSize: 10,
      hasMore: false,
      rows: [
        {
          id: '1',
          rawId: 1,
          msgSubject: '您有一条新的待办',
          msgStatus: 0,
          msgType: 1,
          bizType: 1,
          bizId: '123',
        },
      ],
    })

    expect(httpClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/sys-message/page',
        params: expect.objectContaining({
          pageNum: 1,
          pageSize: 10,
          msgStatus: 0,
          bizType: 1,
        }),
      }),
    )
  })

  it('calls read, read-all, and delete endpoints with backend ids', async () => {
    vi.mocked(httpClient.request).mockResolvedValue(backendResponse(true) as never)

    await expect(markSysMessagesRead(['1', 2])).resolves.toBe(true)
    await expect(markAllSysMessagesRead()).resolves.toBe(true)
    await expect(deleteSysMessages(['3', 4])).resolves.toBe(true)

    expect(httpClient.request).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        method: 'PUT',
        url: '/sys-message/read',
        data: { ids: [1, 2] },
      }),
    )
    expect(httpClient.request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        method: 'PUT',
        url: '/sys-message/read-all',
      }),
    )
    expect(httpClient.request).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        method: 'DELETE',
        url: '/sys-message',
        data: { ids: [3, 4] },
      }),
    )
  })

  it('normalizes websocket push payloads', () => {
    expect(
      normalizeSysMessagePush({
        type: 'sys_message',
        id: 9,
        msgSubject: '会议提醒',
        msgContent: '标题：周会',
        msgStatus: 0,
        msgType: 1,
        bizType: 2,
        bizId: 88,
        createTime: '2026-06-17T10:00:00',
      }),
    ).toMatchObject({
      id: '9',
      rawId: 9,
      msgSubject: '会议提醒',
      bizType: 2,
      bizId: '88',
    })
  })

  it('builds websocket urls from fallback location or explicit base url', () => {
    expect(
      buildSysMessageWebSocketUrl('10002', {
        location: { protocol: 'http:', host: '127.0.0.1:5173' },
      }),
    ).toBe('ws://127.0.0.1:5173/websocket/10002')

    expect(
      buildSysMessageWebSocketUrl('10002', {
        baseUrl: 'https://todo.example.com',
        location: { protocol: 'https:', host: 'app.example.com' },
      }),
    ).toBe('wss://todo.example.com/websocket/10002')

    expect(
      buildSysMessageWebSocketUrl('100 02', {
        baseUrl: '/websocket',
        location: { protocol: 'https:', host: 'app.example.com' },
      }),
    ).toBe('wss://app.example.com/websocket/100%2002')
  })
})
