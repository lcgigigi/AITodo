import axios, { AxiosError } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { setupInterceptors } from './interceptors'
import { RequestError, isUnauthorizedRequestError } from './request-error'

describe('request errors', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('preserves business code and trace id', async () => {
    const instance = axios.create()
    setupInterceptors(instance)

    const request = instance.request({
      url: '/test',
      showError: false,
      adapter: async (config) => ({
        config,
        data: {
          code: 500,
          msg: '业务处理失败',
          traceId: 'trace-business',
        },
        headers: {},
        status: 200,
        statusText: 'OK',
      }),
    })

    await expect(request).rejects.toMatchObject({
      name: 'RequestError',
      message: '业务处理失败',
      status: 200,
      code: 500,
      traceId: 'trace-business',
    })
  })

  it('preserves the HTTP status and original Axios error', async () => {
    const instance = axios.create()
    setupInterceptors(instance)

    let originalError: AxiosError | undefined
    const request = instance.request({
      url: '/private',
      showError: false,
      adapter: async (config) => {
        originalError = new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, undefined, {
          config,
          data: { code: 401, traceId: 'trace-http' },
          headers: {},
          status: 401,
          statusText: 'Unauthorized',
        })
        throw originalError
      },
    })

    try {
      await request
      throw new Error('Expected request to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(RequestError)
      expect(error).toMatchObject({
        status: 401,
        code: 401,
        traceId: 'trace-http',
        cause: originalError,
      })
      expect(isUnauthorizedRequestError(error)).toBe(true)
    }
  })

  it('keeps legacy unauthorized message detection as a fallback', () => {
    expect(isUnauthorizedRequestError(new Error('登录状态已过期'))).toBe(true)
    expect(isUnauthorizedRequestError(new Error('普通请求失败'))).toBe(false)
  })
})
