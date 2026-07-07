import { describe, expect, it } from 'vitest'
import {
  clearDesktopTodoDetailQuery,
  getDesktopTodoDetailRequest,
} from './desktopTodoQuery'

describe('desktopTodoQuery', () => {
  it('reads desktop todo detail query fields', () => {
    expect(
      getDesktopTodoDetailRequest({
        desktopTodoId: 'todo-1',
        desktopMessageId: 'message-1',
        desktopBizType: '2',
      }),
    ).toEqual({
      todoId: 'todo-1',
      messageId: 'message-1',
      bizType: '2',
    })
  })

  it('ignores missing desktop todo ids', () => {
    expect(
      getDesktopTodoDetailRequest({
        desktopMessageId: 'message-1',
        desktopBizType: '2',
      }),
    ).toBeNull()
  })

  it('clears only desktop detail query fields', () => {
    expect(
      clearDesktopTodoDetailQuery({
        desktopTodoId: 'todo-1',
        desktopMessageId: 'message-1',
        desktopBizType: '2',
        desktopTodoText: '创建一个待办',
        keep: 'yes',
      }),
    ).toEqual({
      desktopTodoText: '创建一个待办',
      keep: 'yes',
    })
  })
})
