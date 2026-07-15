import { describe, expect, it } from 'vitest'
import { getSafeBackendMessage, isTechnicalBackendMessage } from './backend-message'

describe('backend message safety', () => {
  it('keeps short user-facing business messages', () => {
    expect(getSafeBackendMessage('待办已被其他人接受', '操作失败')).toBe('待办已被其他人接受')
    expect(getSafeBackendMessage('账号已停用，请联系管理员', '登录失败')).toBe(
      '账号已停用，请联系管理员',
    )
  })

  it('replaces database and Java details with the contextual fallback', () => {
    const sqlError =
      "### Error querying database. Cause: java.sql.SQLSyntaxErrorException: Unknown column 'u.smart_mode' in 'field list'"

    expect(isTechnicalBackendMessage(sqlError)).toBe(true)
    expect(getSafeBackendMessage(sqlError, '加载待办失败，请稍后再试')).toBe(
      '加载待办失败，请稍后再试',
    )
  })

  it('rejects stack traces, HTML error pages, multiline and oversized messages', () => {
    expect(
      isTechnicalBackendMessage('java.lang.NullPointerException\n\tat com.example.Service.run'),
    ).toBe(true)
    expect(isTechnicalBackendMessage('<html><title>500 Internal Server Error</title></html>')).toBe(
      true,
    )
    expect(isTechnicalBackendMessage('A'.repeat(181))).toBe(true)
  })
})
