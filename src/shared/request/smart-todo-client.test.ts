import { describe, expect, it } from 'vitest'
import { unwrapSmartTodoResponse } from './smart-todo-client'

describe('smart todo response helpers', () => {
  it('returns successful response data', () => {
    expect(unwrapSmartTodoResponse({ code: 200, data: { id: 1 } }, '请求失败')).toEqual({
      id: 1,
    })
  })

  it('rejects failed business responses with the backend message', () => {
    expect(() =>
      unwrapSmartTodoResponse({ code: 500, msg: '业务失败', data: null }, '请求失败'),
    ).toThrow('业务失败')
  })

  it('rejects explicit unsuccessful responses', () => {
    expect(() =>
      unwrapSmartTodoResponse({ success: false, message: '操作失败' }, '请求失败'),
    ).toThrow('操作失败')
  })

  it('rejects successful envelopes without data', () => {
    expect(() => unwrapSmartTodoResponse({ code: 200 }, '数据缺失')).toThrow('数据缺失')
  })
})
