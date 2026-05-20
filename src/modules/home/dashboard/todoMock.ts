import type {
  CalendarEvent,
  CalendarEventStatus,
  CalendarTodoDraft,
  CalendarTodoScope,
  CalendarTodoUpdate,
  CalendarUser,
  ParsedTodoDraft,
} from './types'

export const mockUsers: CalendarUser[] = [
  {
    id: 'leader-zhang',
    name: '张经理',
    role: 'leader',
    department: 'AI平台部',
    teamMemberIds: ['employee-liu'],
  },
  {
    id: 'employee-liu',
    name: '刘畅',
    role: 'employee',
    department: '研发组',
    leaderId: 'leader-zhang',
  },
]

export const mockInitialTodos: CalendarEvent[] = [
  {
    id: 'evt-0504-approval',
    date: '2026-05-04',
    time: '10:00',
    title: '请假申请审批',
    type: 'approval',
    owner: '张经理',
    status: 'todo',
    creatorId: 'leader-zhang',
    creatorName: '张经理',
    assigneeId: 'leader-zhang',
    assigneeName: '张经理',
  },
  {
    id: 'evt-0504-meeting-09',
    date: '2026-05-04',
    time: '09:00',
    title: '周计划校准',
    type: 'meeting',
    owner: '张经理',
    status: 'todo',
    source: '会议纪要',
    creatorId: 'leader-zhang',
    creatorName: '张经理',
    assigneeId: 'leader-zhang',
    assigneeName: '张经理',
  },
  {
    id: 'evt-0505-ai',
    date: '2026-05-05',
    time: '15:30',
    title: '图文素材分析',
    type: 'ai',
    owner: '刘畅',
    status: 'done',
    source: '图文分析',
    creatorId: 'employee-liu',
    creatorName: '刘畅',
    assigneeId: 'employee-liu',
    assigneeName: '刘畅',
  },
  {
    id: 'evt-0505-task-11',
    date: '2026-05-05',
    time: '11:00',
    title: '确认需求清单',
    type: 'task',
    owner: '张经理',
    status: 'todo',
    creatorId: 'leader-zhang',
    creatorName: '张经理',
    assigneeId: 'leader-zhang',
    assigneeName: '张经理',
  },
  {
    id: 'evt-0505-approval-12',
    date: '2026-05-05',
    time: '12:00',
    title: '预算申请复核',
    type: 'approval',
    owner: '张经理',
    status: 'todo',
    creatorId: 'leader-zhang',
    creatorName: '张经理',
    assigneeId: 'leader-zhang',
    assigneeName: '张经理',
  },
  {
    id: 'evt-0506-meeting',
    date: '2026-05-06',
    time: '09:30',
    title: '周会纪要整理',
    type: 'meeting',
    owner: '刘畅',
    status: 'todo',
    source: '会议纪要',
    creatorId: 'employee-liu',
    creatorName: '刘畅',
    assigneeId: 'employee-liu',
    assigneeName: '刘畅',
  },
  {
    id: 'evt-0506-ai-13',
    date: '2026-05-06',
    time: '13:00',
    title: '整理汇报素材',
    type: 'ai',
    owner: '张经理',
    status: 'todo',
    source: '智能PPT',
    creatorId: 'leader-zhang',
    creatorName: '张经理',
    assigneeId: 'leader-zhang',
    assigneeName: '张经理',
  },
  {
    id: 'evt-0507-meeting-14',
    date: '2026-05-07',
    time: '14:00',
    title: '跨部门进度同步',
    type: 'meeting',
    owner: '张经理',
    status: 'todo',
    source: '会议纪要',
    creatorId: 'leader-zhang',
    creatorName: '张经理',
    assigneeId: 'leader-zhang',
    assigneeName: '张经理',
  },
  {
    id: 'evt-0508-meeting',
    date: '2026-05-08',
    time: '09:30',
    title: '产品方案同步会',
    type: 'meeting',
    owner: '刘畅',
    status: 'todo',
    source: '会议纪要',
    creatorId: 'employee-liu',
    creatorName: '刘畅',
    assigneeId: 'employee-liu',
    assigneeName: '刘畅',
  },
  {
    id: 'evt-0508-task-15',
    date: '2026-05-08',
    time: '15:00',
    title: '检查上线风险',
    type: 'task',
    owner: '张经理',
    status: 'todo',
    priority: 'urgent',
    creatorId: 'leader-zhang',
    creatorName: '张经理',
    assigneeId: 'leader-zhang',
    assigneeName: '张经理',
  },
  {
    id: 'evt-0508-task',
    date: '2026-05-08',
    time: '11:00',
    title: '补充首页日历需求',
    type: 'task',
    owner: '刘畅',
    status: 'todo',
    priority: 'urgent',
    completionIdeas: '同步会议结论后，先整理需求差异，再补充首页日历交互说明。',
    creatorId: 'employee-liu',
    creatorName: '刘畅',
    assigneeId: 'employee-liu',
    assigneeName: '刘畅',
  },
  {
    id: 'evt-0508-ai',
    date: '2026-05-08',
    time: '16:00',
    title: '生成汇报 PPT 初稿',
    type: 'ai',
    owner: '刘畅',
    status: 'todo',
    source: '智能PPT',
    creatorId: 'leader-zhang',
    creatorName: '张经理',
    assigneeId: 'employee-liu',
    assigneeName: '刘畅',
  },
  {
    id: 'evt-0509-approval-17',
    date: '2026-05-09',
    time: '17:00',
    title: '调休事项确认',
    type: 'approval',
    owner: '张经理',
    status: 'todo',
    creatorId: 'leader-zhang',
    creatorName: '张经理',
    assigneeId: 'leader-zhang',
    assigneeName: '张经理',
  },
  {
    id: 'evt-0510-task-18',
    date: '2026-05-10',
    time: '18:00',
    title: '下周重点预排',
    type: 'task',
    owner: '张经理',
    status: 'todo',
    creatorId: 'leader-zhang',
    creatorName: '张经理',
    assigneeId: 'leader-zhang',
    assigneeName: '张经理',
  },
  {
    id: 'evt-0511-task',
    date: '2026-05-11',
    time: '14:00',
    title: '制度问答验收',
    type: 'task',
    owner: '刘畅',
    status: 'todo',
    source: '力宝百问',
    creatorId: 'leader-zhang',
    creatorName: '张经理',
    assigneeId: 'employee-liu',
    assigneeName: '刘畅',
  },
  {
    id: 'evt-0514-ai',
    date: '2026-05-14',
    time: '10:30',
    title: '智能体脚本评审',
    type: 'ai',
    owner: '张经理',
    status: 'todo',
    creatorId: 'leader-zhang',
    creatorName: '张经理',
    assigneeId: 'leader-zhang',
    assigneeName: '张经理',
  },
  {
    id: 'evt-0517-approval',
    date: '2026-05-17',
    time: '18:00',
    title: '考勤异常确认',
    type: 'approval',
    owner: '张经理',
    status: 'todo',
    priority: 'urgent',
    creatorId: 'leader-zhang',
    creatorName: '张经理',
    assigneeId: 'leader-zhang',
    assigneeName: '张经理',
  },
  {
    id: 'evt-0521-meeting',
    date: '2026-05-21',
    time: '13:30',
    title: '季度复盘材料会',
    type: 'meeting',
    owner: '刘畅',
    status: 'todo',
    source: '智能PPT',
    creatorId: 'leader-zhang',
    creatorName: '张经理',
    assigneeId: 'employee-liu',
    assigneeName: '刘畅',
  },
]

function resolveScope(event: CalendarEvent, currentUser: CalendarUser): CalendarTodoScope {
  if (event.creatorId === currentUser.id && event.assigneeId === currentUser.id) return 'self'
  if (event.creatorId === currentUser.id && event.assigneeId !== currentUser.id)
    return 'assigned_by_me'
  return 'assigned_to_me'
}

function canSeeTodo(event: CalendarEvent, currentUser: CalendarUser) {
  return event.creatorId === currentUser.id || event.assigneeId === currentUser.id
}

export function listTodos(events: CalendarEvent[], currentUser: CalendarUser): CalendarEvent[] {
  return events
    .filter((event) => canSeeTodo(event, currentUser))
    .map((event) => {
      const editable = event.creatorId === currentUser.id
      const completable = event.assigneeId === currentUser.id

      return {
        ...event,
        scope: resolveScope(event, currentUser),
        editable,
        completable,
      }
    })
}

export function createTodo(
  events: CalendarEvent[],
  currentUser: CalendarUser,
  payload: CalendarTodoDraft,
): CalendarEvent[] {
  const assigneeId = payload.assigneeId ?? currentUser.id
  const assigneeName = payload.assigneeName ?? payload.owner ?? currentUser.name

  return [
    ...events,
    {
      id: `evt-${payload.date}-${Date.now()}`,
      date: payload.date,
      time: payload.time,
      title: payload.title.trim(),
      type: 'task',
      owner: assigneeName,
      status: 'todo',
      priority: 'normal',
      source: payload.source?.trim() || '自建待办',
      completionIdeas: payload.completionIdeas?.trim() || undefined,
      creatorId: currentUser.id,
      creatorName: currentUser.name,
      assigneeId,
      assigneeName,
    },
  ]
}

export function updateTodo(
  events: CalendarEvent[],
  currentUser: CalendarUser,
  payload: CalendarTodoUpdate,
): CalendarEvent[] {
  return events.map((event) => {
    if (event.id !== payload.id || event.creatorId !== currentUser.id) return event

    const assigneeName = payload.assigneeName ?? payload.owner.trim()

    return {
      ...event,
      date: payload.date,
      time: payload.time,
      title: payload.title.trim(),
      owner: assigneeName,
      source: payload.source?.trim() || undefined,
      completionIdeas: payload.completionIdeas?.trim() || undefined,
      assigneeId: payload.assigneeId ?? event.assigneeId,
      assigneeName,
    }
  })
}

export function updateTodoStatus(
  events: CalendarEvent[],
  currentUser: CalendarUser,
  id: string,
  status: CalendarEventStatus,
): CalendarEvent[] {
  return events.map((event) => {
    if (event.id !== id || event.assigneeId !== currentUser.id) return event
    return { ...event, status }
  })
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function ymd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function normalizeTime(hour: number, minute = 0) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export async function parseTodoText(
  text: string,
  currentUser: CalendarUser,
  assignableUsers: CalendarUser[],
  fallback: ParsedTodoDraft,
) {
  await new Promise((resolve) => window.setTimeout(resolve, 360))

  const baseDate = new Date('2026-05-14T12:00:00+08:00')
  let date = fallback.date

  if (text.includes('后天')) {
    date = ymd(addDays(baseDate, 2))
  } else if (text.includes('明天')) {
    date = ymd(addDays(baseDate, 1))
  } else if (text.includes('今天')) {
    date = ymd(baseDate)
  }

  const monthDayMatch = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/)
  if (monthDayMatch) {
    date = ymd(
      new Date(baseDate.getFullYear(), Number(monthDayMatch[1]) - 1, Number(monthDayMatch[2])),
    )
  }

  let time = fallback.time
  if (text.includes('上午')) time = '09:00'
  if (text.includes('下午')) time = '14:00'
  if (text.includes('晚上')) time = '19:00'

  const timeMatch = text.match(/(\d{1,2})\s*(?:点|时|:|：)\s*(\d{1,2})?\s*分?/)
  if (timeMatch) {
    let hour = Number(timeMatch[1])
    const minute = Number(timeMatch[2] ?? 0)
    if ((text.includes('下午') || text.includes('晚上')) && hour < 12) hour += 12
    time = normalizeTime(Math.min(hour, 23), Math.min(minute, 59))
  }

  const ownerMatch = text.match(/给(.+?)(?:布置|安排|派发)/)
  const ownerText = ownerMatch?.[1]?.trim()
  const assignee =
    assignableUsers.find((user) => ownerText && ownerText.includes(user.name)) ?? currentUser
  const titleMatch = text.match(/任务内容(?:为|是)[“"']?([^”"'，。,.]+)/)

  return {
    date,
    time,
    owner: assignee.name,
    assigneeId: assignee.id,
    assigneeName: assignee.name,
    title: titleMatch?.[1]?.trim() ?? fallback.title,
    source: fallback.source || 'AI预填',
  }
}
