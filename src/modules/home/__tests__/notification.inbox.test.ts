import { describe, expect, it } from 'vitest'
import type { SysMessage } from '@/modules/home/dashboard/services/sys-message.service'
import type { CalendarEvent, CalendarUser } from '@/modules/home/dashboard/config/types'
import {
  buildInboxItems,
  countActionableInboxItems,
  filterInboxItems,
  findRelatedUnreadMessages,
} from '../dashboard/services/notification.inbox'

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

const assignableUsers: CalendarUser[] = [
  { id: '1102080', name: '李四', role: 'employee' },
  { id: '1110691', name: '田坤坤', role: 'employee' },
]

describe('notification.inbox', () => {
  it('dedupes pending todo and related sys message into one pending item', () => {
    const items = buildInboxItems([pendingTodo], [relatedMessage, systemMessage], assignableUsers)

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
    const items = buildInboxItems([pendingTodo], [systemMessage], assignableUsers)
    const actionable = filterInboxItems(items, 'actionable')

    expect(actionable).toHaveLength(2)
    expect(countActionableInboxItems(items)).toBe(2)
  })

  it('finds unread messages linked to a pending todo', () => {
    expect(findRelatedUnreadMessages([relatedMessage, systemMessage], '458')).toEqual([
      relatedMessage,
    ])
  })

  it('parses json todo message content into structured details', () => {
    const jsonMessage: SysMessage = {
      id: '97',
      rawId: 97,
      msgSubject: '您有一条新的待办',
      msgContent:
        '{"id":153,"title":"","timeType":1,"startDateShow":"2026-07-09 08:10:00","content":"开会哦","remark":"317"}',
      msgStatus: 0,
      msgType: 1,
      bizType: 1,
      bizId: '153',
      createTime: '2026-07-09T10:05:45',
    }

    const items = buildInboxItems([], [jsonMessage], assignableUsers)
    expect(items[0]).toMatchObject({
      title: '您有一条新的待办',
      summary: '开会哦',
      details: [
        { label: '时间', value: '2026-07-09 08:10' },
        { label: '备注', value: '317' },
      ],
    })
  })

  it('parses multiline meeting message into headline and detail rows', () => {
    const meetingMessage: SysMessage = {
      id: '94',
      rawId: 94,
      msgSubject: '任务即将结束',
      msgContent:
        '你的任务即将结束，请前往处理\n标题：明天早上九点开早会\n开始时间：2026-07-09T09:00\n结束时间：2026-07-09T10:00',
      msgStatus: 1,
      msgType: 1,
      bizType: 2,
      bizId: '148',
      createTime: '2026-07-09T09:45:00',
    }

    const items = buildInboxItems([], [meetingMessage], assignableUsers)
    expect(items[0]).toMatchObject({
      title: '任务即将结束',
      summary: '',
      details: [
        { label: '标题', value: '明天早上九点开早会' },
        { label: '开始时间', value: '2026-07-09 09:00' },
        { label: '结束时间', value: '2026-07-09 10:00' },
      ],
    })
  })

  it('builds pending todo with creator and schedule details', () => {
    const items = buildInboxItems([pendingTodo], [], assignableUsers)
    expect(items[0]).toMatchObject({
      title: '项目复盘',
      summary: '',
      details: [
        { label: '派发人', value: '李四' },
        { label: '时间', value: '2026-07-03 10:15' },
      ],
    })
  })

  it('uses todo content as pending title and avoids duplicate content rows', () => {
    const pendingWithContent: CalendarEvent = {
      ...pendingTodo,
      id: '153',
      title: '',
      content: '开会哦',
      startDateShow: '2026-07-09 08:10:00',
    }

    const items = buildInboxItems([pendingWithContent], [], assignableUsers)
    expect(items[0]).toMatchObject({
      title: '开会哦',
      summary: '',
      details: [
        { label: '派发人', value: '李四' },
        { label: '时间', value: '2026-07-09 08:10' },
      ],
    })
    expect(items[0]?.details.some((detail) => detail.label === '内容')).toBe(false)
  })

  it('drops duplicated summary when it already appears in details', () => {
    const jsonMessage: SysMessage = {
      id: '98',
      rawId: 98,
      msgSubject: '您有一条新的待办',
      msgContent:
        '{"id":154,"title":"开会哦","timeType":1,"startDateShow":"2026-07-09 08:10:00","content":"开会哦","remark":"317"}',
      msgStatus: 0,
      msgType: 1,
      bizType: 1,
      bizId: '154',
      createTime: '2026-07-09T10:05:45',
    }

    const items = buildInboxItems([], [jsonMessage], assignableUsers)
    expect(items[0]).toMatchObject({
      title: '您有一条新的待办',
      summary: '开会哦',
      details: [
        { label: '时间', value: '2026-07-09 08:10' },
        { label: '备注', value: '317' },
      ],
    })
  })

  it('resolves employee ids in handler and creator detail rows', () => {
    const completedMessage: SysMessage = {
      id: '93',
      rawId: 93,
      msgSubject: '待办已完成',
      msgContent: '处理人：1110691\n处理说明：已完成',
      msgStatus: 1,
      msgType: 1,
      bizType: 1,
      bizId: '147',
      createTime: '2026-07-08T19:05:51',
    }

    const items = buildInboxItems([], [completedMessage], assignableUsers)
    expect(items[0]?.details).toEqual([
      { label: '处理人', value: '田坤坤' },
      { label: '处理说明', value: '已完成' },
    ])
  })
})
