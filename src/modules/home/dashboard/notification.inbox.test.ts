import { describe, expect, it } from 'vitest'
import type { SysMessage } from '@/modules/home/dashboard/sys-message.service'
import type { CalendarEvent } from '@/modules/home/dashboard/types'
import {
  buildInboxItems,
  countActionableInboxItems,
  filterInboxItems,
  findRelatedUnreadMessages,
} from './notification.inbox'

const pendingTodo: CalendarEvent = {
  id: '458',
  date: '2026-07-03',
  title: '项目复盘',
  type: 'task',
  owner: '徐逸臣',
  status: 'todo',
  creatorId: '1102080',
  creatorName: '李四',
  time: '10:15',
}

const relatedMessage: SysMessage = {
  id: '9',
  rawId: 9,
  msgSubject: '您有一条新的待办',
  msgContent: '创建人:1102080',
  msgStatus: 0,
  msgType: 1,
  bizType: 1,
  bizId: '458',
  createTime: '2026-07-03 10:15:00',
}

const systemMessage: SysMessage = {
  id: '10',
  rawId: 10,
  msgSubject: '邮箱同步完成',
  msgContent: 'Outlook 日程已同步',
  msgStatus: 0,
  msgType: 1,
  createTime: '2026-07-03 08:00:00',
}

describe('notification.inbox', () => {
  it('dedupes pending todo and related sys message into one pending item', () => {
    const items = buildInboxItems([pendingTodo], [relatedMessage, systemMessage])

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      id: 'pending:458',
      kind: 'todo_pending',
      title: '项目复盘',
      statusLabel: '待接受',
      todoId: '458',
    })
    expect(items.some((item) => item.id === 'message:9')).toBe(false)
    expect(items[1]).toMatchObject({
      id: 'message:10',
      kind: 'system',
      title: '邮箱同步完成',
    })
  })

  it('filters actionable items and counts badge total', () => {
    const items = buildInboxItems([pendingTodo], [systemMessage])
    const actionable = filterInboxItems(items, 'actionable')

    expect(actionable).toHaveLength(2)
    expect(countActionableInboxItems(items)).toBe(2)
  })

  it('finds unread messages linked to a pending todo', () => {
    expect(findRelatedUnreadMessages([relatedMessage, systemMessage], '458')).toEqual([
      relatedMessage,
    ])
  })
})
