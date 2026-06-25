import { describe, expect, it } from 'vitest'
import type { SysMessage } from './sys-message.service'
import {
  countUnreadSysMessages,
  hasSysMessage,
  markAllSysMessagesReadInList,
  markSysMessageIdsReadInList,
  mergeSysMessages,
  removeSysMessageIdsFromList,
} from './sys-message.state'

function message(id: string | number, msgStatus: 0 | 1 = 0): SysMessage {
  return {
    id: String(id),
    rawId: id,
    msgSubject: `消息 ${id}`,
    msgContent: '',
    msgStatus,
    msgType: 1,
  }
}

describe('sys-message.state', () => {
  it('merges messages and keeps the newest pushed copy first', () => {
    const current = [message(1), message(2)]
    const pushed = [{ ...message(2), msgSubject: '重复推送' }, message(3)]

    expect(mergeSysMessages(current, pushed, { prepend: true }).map((item) => item.id)).toEqual([
      '2',
      '3',
      '1',
    ])
  })

  it('marks selected messages read and updates unread counts', () => {
    const next = markSysMessageIdsReadInList([message(1), message(2), message(3, 1)], [1])

    expect(next.find((item) => item.id === '1')?.msgStatus).toBe(1)
    expect(countUnreadSysMessages(next)).toBe(1)
  })

  it('marks all messages read', () => {
    const next = markAllSysMessagesReadInList([message(1), message(2)])

    expect(next.every((item) => item.msgStatus === 1)).toBe(true)
    expect(countUnreadSysMessages(next)).toBe(0)
  })

  it('removes messages by normalized or raw id', () => {
    const next = removeSysMessageIdsFromList(
      [message(1), message('custom-id'), message(3)],
      ['custom-id', 3],
    )

    expect(next.map((item) => item.id)).toEqual(['1'])
  })

  it('detects duplicate messages by normalized or raw id', () => {
    const messages = [message(1), { ...message('local-2'), rawId: 2 }]

    expect(hasSysMessage(messages, '1')).toBe(true)
    expect(hasSysMessage(messages, 2)).toBe(true)
    expect(hasSysMessage(messages, 3)).toBe(false)
  })
})
