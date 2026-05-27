# 待办事项接口文档

本文档描述首页日历待办功能的后端接口约定。当前前端使用本地 mock 数据实现，字段设计应与后端接口保持一致。

## 1. 用户与角色

### GET /api/users/me

返回当前登录用户、角色和可派发成员。

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "leader-zhang",
    "name": "刘美华",
    "role": "leader",
    "department": "信息技术部",
    "leaderId": null,
    "teamMembers": [
      {
        "id": "employee-liu",
        "name": "刘畅",
        "role": "employee",
        "department": "研发组"
      }
    ]
  }
}
```

字段说明：

| 字段        | 类型                   | 说明                                     |
| ----------- | ---------------------- | ---------------------------------------- |
| id          | string                 | 用户 ID                                  |
| name        | string                 | 用户名                                   |
| role        | `leader` \| `employee` | 用户角色                                 |
| department  | string                 | 部门                                     |
| leaderId    | string \| null         | 员工直属领导 ID                          |
| teamMembers | User[]                 | 领导可派发任务的员工列表，员工可为空数组 |

## 2. 待办模型

```ts
type TodoStatus = 'todo' | 'done'
type TodoPriority = 'normal' | 'urgent'
type TodoScope = 'self' | 'assigned_by_me' | 'assigned_to_me'

interface Todo {
  id: string
  date: string
  time: string
  title: string
  type: 'task' | 'meeting' | 'approval' | 'ai'
  owner: string
  status: TodoStatus
  priority?: TodoPriority
  source?: string
  completionIdeas?: string
  creatorId: string
  creatorName: string
  assigneeId: string
  assigneeName: string
  scope: TodoScope
  editable: boolean
  completable: boolean
}
```

后端应根据当前用户计算：

| 字段                 | 规则                         |
| -------------------- | ---------------------------- |
| scope=self           | 创建人和负责人都是当前用户   |
| scope=assigned_by_me | 当前用户创建，负责人是其他人 |
| scope=assigned_to_me | 其他人创建，负责人是当前用户 |
| editable             | 当前用户是 creatorId         |
| completable          | 当前用户是 assigneeId        |

## 3. 查询待办

### GET /api/todos?startDate=2026-05-01&endDate=2026-05-31&view=calendar

返回当前用户有权限查看的待办。后端负责权限过滤。

权限规则：

- 员工可见：自己创建的任务、别人派给自己的任务。
- 领导可见：自己创建的任务、别人派给自己的任务、自己派发出去的任务。

响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "id": "todo-001",
      "date": "2026-05-15",
      "time": "14:00",
      "title": "开发公司官方网站",
      "type": "task",
      "owner": "刘畅",
      "status": "todo",
      "priority": "normal",
      "source": "AI预填",
      "completionIdeas": "先确认官网栏目结构，再拆首页组件和素材需求。",
      "creatorId": "leader-zhang",
      "creatorName": "刘美华",
      "assigneeId": "employee-liu",
      "assigneeName": "刘畅",
      "scope": "assigned_by_me",
      "editable": true,
      "completable": false
    }
  ]
}
```

## 4. 创建待办

### POST /api/todos

创建自建任务或领导派发任务。

请求：

```json
{
  "date": "2026-05-15",
  "time": "14:00",
  "title": "开发公司官方网站",
  "assigneeId": "employee-liu",
  "assigneeName": "刘畅",
  "source": "AI预填",
  "completionIdeas": "先确认官网栏目结构，再拆首页组件和素材需求。",
  "priority": "normal"
}
```

规则：

- 员工只能把 assigneeId 设置为自己。
- 领导可以把 assigneeId 设置为自己或团队成员。
- creatorId/creatorName 由后端根据登录态写入。

响应返回完整 Todo。

## 5. 编辑待办

### PUT /api/todos/{id}

仅创建人/发布人可编辑。

请求：

```json
{
  "date": "2026-05-16",
  "time": "10:30",
  "title": "开发公司官方网站首页",
  "assigneeId": "employee-liu",
  "assigneeName": "刘畅",
  "source": "需求调整",
  "completionIdeas": "首页先完成首屏和导航，再补充案例模块。"
}
```

规则：

- 当前用户必须等于 creatorId。
- 编辑后不自动重置 status。
- 后端返回更新后的完整 Todo。

## 6. 更新完成状态

### PATCH /api/todos/{id}/status

仅负责人可更新完成状态。

请求：

```json
{
  "status": "done"
}
```

响应返回更新后的完整 Todo。

## 7. AI 解析待办

### POST /api/todos/ai-parse

根据自然语言描述解析待办草稿。

请求：

```json
{
  "text": "明天下午给刘畅布置一项开发任务，任务内容为“开发公司官方网站”"
}
```

响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "date": "2026-05-15",
    "time": "14:00",
    "title": "开发公司官方网站",
    "assigneeId": "employee-liu",
    "assigneeName": "刘畅",
    "source": "AI预填"
  }
}
```

说明：

- 无法解析的字段可返回 null 或省略，前端保留用户已填写内容。
- 后端应按登录用户角色限制可选 assignee。
