import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createSeedTodos,
  createTodo,
  deleteTodo,
  listTodos,
  loadTodos,
  parseTodoText,
  saveTodos,
  TODO_STORAGE_KEY,
  updateTodoStatus,
} from './todo.service'
import { mockUsers } from './todoMock'

const leader = mockUsers[0]
const employee = mockUsers[1]

function createMemoryStorage() {
  const values = new Map<string, string>()

  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      values.delete(key)
    },
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}

describe('todo.service', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('seeds todos relative to the current week', () => {
    const seededTodos = createSeedTodos(new Date('2026-06-03T12:00:00'))

    expect(seededTodos.some((event) => event.date === '2026-06-03')).toBe(true)
    expect(seededTodos.every((event) => event.id.startsWith('seed-'))).toBe(true)
  })

  it('persists todos to localStorage when storage is available', () => {
    const localStorage = createMemoryStorage()
    vi.stubGlobal('window', { localStorage })

    const saved = saveTodos([
      {
        id: 'todo-1',
        date: '2026-06-04',
        title: '官网首页验收',
        type: 'task',
        owner: employee.name,
        status: 'todo',
        assigneeId: employee.id,
        assigneeName: employee.name,
      },
    ])
    const loaded = loadTodos(new Date('2026-06-03T12:00:00'))

    expect(localStorage.getItem(TODO_STORAGE_KEY)).toContain('官网首页验收')
    expect(loaded).toEqual(saved)
  })

  it('creates assigned todos and filters visibility by user', async () => {
    const events = await createTodo([], leader, {
      date: '2026-06-04',
      time: '14:00',
      title: '官网首页验收',
      assigneeId: employee.id,
      assigneeName: employee.name,
    })

    const leaderEvents = listTodos(events, leader)
    const employeeEvents = listTodos(events, employee)

    expect(leaderEvents[0]).toMatchObject({
      scope: 'assigned_by_me',
      editable: true,
      completable: false,
    })
    expect(employeeEvents[0]).toMatchObject({
      scope: 'assigned_to_me',
      editable: false,
      completable: true,
    })
  })

  it('only lets assignees complete and creators delete todos', async () => {
    const [event] = await createTodo([], leader, {
      date: '2026-06-04',
      title: '官网首页验收',
      assigneeId: employee.id,
      assigneeName: employee.name,
    })

    const leaderUpdate = updateTodoStatus([event], leader, event.id, 'done')
    const employeeUpdate = updateTodoStatus([event], employee, event.id, 'done')
    const employeeDelete = deleteTodo([event], employee, event.id)
    const leaderDelete = deleteTodo([event], leader, event.id)

    expect(leaderUpdate[0].status).toBe('todo')
    expect(employeeUpdate[0].status).toBe('done')
    expect(employeeDelete).toHaveLength(1)
    expect(leaderDelete).toHaveLength(0)
  })

  it('parses Chinese natural language into a todo draft', async () => {
    const parsed = await parseTodoText('明天下午给刘畅安排官网首页验收', leader, mockUsers, {
      date: '2026-06-03',
      title: '',
    })

    expect(parsed).toMatchObject({
      date: '2026-06-04',
      time: '14:00',
      assigneeId: employee.id,
      title: '明天下午给刘畅安排官网首页验收',
    })
  })
})
