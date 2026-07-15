import { describe, expect, it } from 'vitest'
import { RequestError } from '@/shared/request/request-error'
import { getLoginErrorMessage } from './login-error'

describe('getLoginErrorMessage', () => {
  it('does not expose backend implementation details', () => {
    const backendError = new RequestError(
      "### Error querying database. Cause: java.sql.SQLSyntaxErrorException: Unknown column 'u.smart_mode' in 'field list'",
      { status: 200, code: 500 },
    )

    expect(getLoginErrorMessage(backendError)).toBe('登录服务暂时不可用，请稍后再试')
  })

  it('returns a useful prompt for invalid credentials', () => {
    expect(getLoginErrorMessage(new RequestError('用户名或密码错误', { code: 500 }))).toBe(
      '账号或密码错误，请重新输入',
    )
    expect(getLoginErrorMessage(new RequestError('Unauthorized', { status: 401 }))).toBe(
      '账号或密码错误，请重新输入',
    )
  })

  it('distinguishes network and rate-limit failures', () => {
    expect(getLoginErrorMessage(new RequestError('Network Error'))).toBe(
      '网络连接异常，请检查网络后重试',
    )
    expect(getLoginErrorMessage(new RequestError('Too Many Requests', { status: 429 }))).toBe(
      '操作过于频繁，请稍后再试',
    )
  })
})
