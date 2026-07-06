# 后台接口开发需求文档

本文档基于当前前端代码中的 mock 与硬编码数据整理，目标是把首页工作台、日历待办、智能体中心需要后端承接的数据面一次性列清。

## 1. 前端 mock 数据统计

| 模块                   | 文件                                               |                                                    当前数据量 | 后端承接建议                           |
| ---------------------- | -------------------------------------------------- | ------------------------------------------------------------: | -------------------------------------- |
| 日历用户与待办         | `src/modules/home/dashboard/todoMock.ts`           |                                         用户 2 个，待办 42 条 | 必须接口化                             |
| 首页工具入口与个人积分 | `src/modules/home/dashboard/CalendarWorkspace.vue` |                                  工具入口 8 个，个人统计 3 项 | 建议接口化，工具入口可配置化           |
| 节假日/节气            | `src/modules/home/dashboard/CalendarWorkspace.vue` |                      日期 63 条，其中假期 33、调休 6、节气 24 | 建议接口化或由后端定期生成             |
| 智能体统计大屏         | `src/modules/agent-center/mock.ts`                 | 分类 7 个，智能体 6 个，概览指标 5 项，趋势 7 点，榜单各 6 条 | 必须接口化                             |
| 用户登录态             | `src/stores/user.store.ts`                         |                                     `mock-token`、`mock-user` | 必须接入真实登录态                     |

日历待办 mock 明细：

| 指标                          |            数量 |
| ----------------------------- | --------------: |
| 总待办                        |              42 |
| 类型：任务 / 会议 / 审批 / AI | 12 / 12 / 9 / 9 |
| 状态：待办 / 已完成           |          39 / 3 |
| 紧急任务                      |               4 |
| 跨日期任务                    |               7 |
| 有具体时间 / 无具体时间       |          34 / 8 |
| 指派给员工 / 指派给领导       |         16 / 26 |
| 员工创建 / 领导创建           |          5 / 37 |

智能体中心 mock 明细：

| 指标                  |                                                                                   数量 |
| --------------------- | -------------------------------------------------------------------------------------: |
| 新版统计页智能体      |                                                                                      6 |
| 新版统计页分类        |                                                                      7，含“全部智能体” |
| Token 分类占比        |                                                                                      6 |
| Token 排名 / 积分排名 |                                                                                   各 6 |
| Token 趋势点          |                                                                                      7 |
| 新版目录 Agent        |                                                                                      7 |
| 新版目录 Skill        |                                                                                      4 |
| 权限状态              |                                                       Agent：available 4、locked 3；Skill：available 3、locked 1 |

## 2. 通用约定

当前请求封装位于 `src/shared/request/http.ts`，前端期望统一响应结构：

```json
{
  "code": 0,
  "message": "ok",
  "success": true,
  "data": {}
}
```

建议：

- `Authorization: Bearer <token>` 承载登录态。
- 日期使用 `YYYY-MM-DD`。
- 时间使用 `HH:mm`，全天或截止日期任务可为空。
- 分页统一使用 `page`、`pageSize`，返回 `list`、`total`、`page`、`pageSize`。
- 后端负责权限过滤，前端不再用本地 mock 判断数据可见性。

## 3. 用户与权限

### 3.1 获取当前用户

`GET /api/users/me`

用于替换 `mockUsers`、`setGuestSession`。

响应：

```json
{
  "id": "leader-zhang",
  "name": "刘美华",
  "avatar": "https://example.com/avatar.png",
  "role": "leader",
  "department": "信息技术部",
  "leaderId": null,
  "teamMemberIds": ["employee-liu"],
  "permissions": ["agent:list:view", "agent:use", "skill:use"]
}
```

字段：

| 字段          | 类型                              | 说明                   |
| ------------- | --------------------------------- | ---------------------- |
| id            | string                            | 用户 ID                |
| name          | string                            | 用户名                 |
| avatar        | string                            | 头像 URL，可为空       |
| role          | `leader` \| `employee` \| `admin` | 当前角色               |
| department    | string                            | 部门                   |
| leaderId      | string \| null                    | 员工直属领导           |
| teamMemberIds | string[]                          | 领导可指派成员         |
| permissions   | string[]                          | 前端路由和能力按钮权限 |

### 3.2 获取可指派用户

`GET /api/users/assignable`

用于待办创建/编辑时选择负责人。

规则：

- 员工只返回自己。
- 领导返回自己和团队成员。
- 管理员按业务规则返回可管理范围。

## 4. 首页工作台

### 4.1 获取首页工具入口

`GET /api/workbench/tools`

用于替换 `campusTools`。

响应：

```json
[
  {
    "id": "policy-qa",
    "name": "力宝百问",
    "icon": "message-circle",
    "tone": "blue",
    "position": "qa",
    "routeName": "AgentList",
    "agentId": "agent-policy",
    "enabled": true,
    "sort": 10
  }
]
```

### 4.2 获取个人工作台统计

`GET /api/workbench/profile-stats`

用于替换 `pointStats` 以及个人弹窗中的积分、活跃、使用次数。

响应：

```json
[
  { "key": "points", "label": "积分", "value": "2,480", "unit": "分" },
  { "key": "weeklyUsage", "label": "本周使用", "value": "18", "unit": "次" },
  { "key": "activeDays", "label": "连续活跃", "value": "7", "unit": "天" }
]
```

## 5. 日历与待办

### 5.1 获取节假日/节气

`GET /api/calendar/special-days?startDate=2026-01-01&endDate=2026-12-31`

用于替换 `specialDays`。

响应：

```json
[
  { "date": "2026-05-01", "name": "劳动节", "type": "holiday" },
  { "date": "2026-05-09", "name": "调休上班", "type": "workday" },
  { "date": "2026-05-21", "name": "小满", "type": "solar-term" }
]
```

### 5.2 查询待办

`GET /api/todos?startDate=2026-05-01&endDate=2026-05-31&view=calendar`

用于替换 `listTodos(mockInitialTodos, currentUser)`。

响应：

```json
[
  {
    "id": "evt-0515-task-15",
    "date": "2026-05-15",
    "endDate": null,
    "time": "15:00",
    "title": "补齐验收用例",
    "type": "task",
    "owner": "刘畅",
    "status": "todo",
    "source": "产品验收",
    "creatorId": "leader-zhang",
    "creatorName": "刘美华",
    "assigneeId": "employee-liu",
    "assigneeName": "刘畅",
    "scope": "assigned_by_me",
    "editable": true,
    "completable": false
  }
]
```

字段：

| 字段                      | 类型                                           | 说明                                 |
| ------------------------- | ---------------------------------------------- | ------------------------------------ |
| id                        | string                                         | 待办 ID                              |
| date                      | string                                         | 开始日期                             |
| endDate                   | string \| null                                 | 结束日期，跨日期任务使用             |
| time                      | string \| null                                 | 具体时间，无时间时为空               |
| title                     | string                                         | 标题                                 |
| type                      | `task` \| `meeting` \| `approval` \| `ai`      | 待办类型                             |
| owner                     | string                                         | 展示负责人，建议等于 `assigneeName`  |
| status                    | `todo` \| `done`                               | 完成状态                             |
| source                    | string \| null                                 | 来源，如会议纪要、智能 PPT、自建待办 |
| creatorId / creatorName   | string                                         | 创建人                               |
| assigneeId / assigneeName | string                                         | 负责人                               |
| scope                     | `self` \| `assigned_by_me` \| `assigned_to_me` | 后端按当前用户计算                   |
| editable                  | boolean                                        | 当前用户是否可编辑                   |
| completable               | boolean                                        | 当前用户是否可更新完成状态           |

权限规则：

- 当前用户可见：自己创建的待办、指派给自己的待办。
- 领导可额外看自己派发给团队成员的待办。
- `editable = currentUser.id === creatorId`。
- `completable = currentUser.id === assigneeId`。

### 5.3 创建待办

`POST /api/todos`

请求：

```json
{
  "date": "2026-05-15",
  "endDate": null,
  "time": "15:00",
  "title": "补齐验收用例",
  "assigneeId": "employee-liu",
  "source": "自建待办"
}
```

规则：

- `creatorId`、`creatorName` 由登录态生成。
- `type` 默认 `task`。
- `status` 默认 `todo`。
- 员工只能指派给自己，领导可指派给自己或团队成员。
- 返回创建后的完整待办对象。

### 5.4 编辑待办

`PUT /api/todos/{id}`

仅创建人可编辑。

请求字段同创建接口，可变更日期、时间、标题、负责人、来源。

### 5.5 更新待办状态

`PATCH /api/todos/{id}/status`

仅负责人可更新。

请求：

```json
{ "status": "done" }
```

### 5.6 AI 解析待办

`POST /api/todos/ai-parse`

用于替换 `parseTodoText`。

请求：

```json
{
  "text": "明天下午给刘畅布置一项任务，任务内容为补齐验收用例",
  "fallback": {
    "date": "2026-05-15",
    "title": "新待办"
  }
}
```

响应：

```json
{
  "date": "2026-05-16",
  "endDate": null,
  "time": "14:00",
  "title": "补齐验收用例",
  "assigneeId": "employee-liu",
  "assigneeName": "刘畅",
  "owner": "刘畅",
  "source": "AI预填"
}
```

## 6. 智能体统计中心

当前启用路由 `/agents` 指向 `src/modules/agent-center/index.vue`，该页面使用 `src/modules/agent-center/mock.ts`。

### 6.1 获取智能体统计总览

`GET /api/agent-center/summary?period=month`

用于替换 `summaryStats`。

响应：

```json
[
  {
    "key": "agentTotal",
    "label": "智能体总数",
    "value": "6",
    "unit": "个",
    "rate": 9.1,
    "icon": "box",
    "sparkline": [10, 12, 11, 14, 13, 18, 17, 22, 20, 23]
  }
]
```

### 6.2 获取智能体列表及分类

`GET /api/agent-center/agents?category=all&sort=tokenDesc&period=month`

用于替换 `categories`、`agents`、前端本地排序。

响应：

```json
{
  "categories": [
    { "key": "all", "label": "全部智能体", "count": 6, "icon": "home" },
    { "key": "knowledge", "label": "知识问答", "count": 1, "icon": "database" }
  ],
  "list": [
    {
      "id": 1,
      "name": "力宝百问",
      "desc": "企业知识中枢，智能检索与问答",
      "categoryKey": "knowledge",
      "categoryName": "知识问答",
      "icon": "问",
      "theme": "blue",
      "monthlyToken": 128450,
      "calls": 432,
      "points": 12840,
      "progress": 64,
      "sparkline": [18, 24, 20, 28, 25, 34, 31, 38, 35, 44, 41, 52],
      "status": "运行中"
    }
  ]
}
```

排序枚举：

| sort       | 说明             |
| ---------- | ---------------- |
| default    | 默认排序         |
| tokenDesc  | Token 从高到低   |
| pointsDesc | 积分贡献从高到低 |
| callsDesc  | 调用次数从高到低 |

### 6.3 获取 Token 使用概览

`GET /api/agent-center/token-overview?period=month`

用于替换 `tokenOverview`。

响应：

```json
{
  "monthTotal": 467540,
  "today": 20320,
  "todayRate": 12.4,
  "average": 77923,
  "remaining": 1532460,
  "quotaUsed": 23,
  "categoryPercent": [{ "name": "知识问答", "percent": 27, "color": "#2f68ff" }]
}
```

### 6.4 获取智能体榜单

`GET /api/agent-center/rankings?metric=token&period=month&limit=6`

用于替换 `tokenRanking`、`pointsRanking`。

参数：

| 参数   | 类型                           | 说明     |
| ------ | ------------------------------ | -------- |
| metric | `token` \| `points` \| `calls` | 榜单指标 |
| period | `today` \| `week` \| `month`   | 统计周期 |
| limit  | number                         | 返回数量 |

响应：

```json
[{ "agentId": 1, "name": "力宝百问", "value": 128450 }]
```

### 6.5 获取 Token 趋势

`GET /api/agent-center/token-trend?period=7d&groupBy=day`

用于替换 `trendData`。

响应：

```json
[
  { "date": "05-16", "value": 32460 },
  { "date": "05-17", "value": 41280 }
]
```

## 7. 智能体目录与技能能力

当前 `/agents` 页面仍依赖 `src/modules/agent-center/mock.ts` 中的智能体、技能、分类和权限状态。建议按当前页面展示需要提供以下接口。

### 7.1 查询 Agent 目录

`GET /api/agent-center/agents?keyword=&category=&permissionState=&page=1&pageSize=20`

响应：

```json
{
  "list": [
    {
      "id": "agent-policy",
      "name": "力宝百问",
      "description": "面向制度、流程和企业知识库的问答智能体。",
      "level": "L1",
      "category": "知识服务",
      "status": "online",
      "owner": "知识库团队",
      "usageCount": 2480,
      "updatedAt": "2026-05-10",
      "permissionState": "available",
      "skillIds": ["skill-knowledge-search"],
      "scenarios": ["制度查询", "流程入口定位", "FAQ 快速答疑"],
      "inputExample": "报销发票抬头填错了应该怎么处理？",
      "outputExample": "返回处理步骤、适用制度条款和可联系负责人。",
      "recommended": true
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20
}
```

枚举：

| 字段            | 可选值                                   |
| --------------- | ---------------------------------------- |
| level           | `L1`、`L2`、`L3`、`L4`                   |
| status          | `online`、`beta`、`maintenance`、`draft` |
| permissionState | `available`、`locked`、`admin-only`      |

### 7.2 查询 Skill 目录

`GET /api/agent-center/skills?keyword=&category=&capabilityType=&status=&permissionState=&page=1&pageSize=20`

响应：

```json
{
  "list": [
    {
      "id": "skill-knowledge-search",
      "name": "知识库检索",
      "description": "跨制度、流程、FAQ 进行语义检索，并返回引用来源。",
      "capabilityType": "知识检索",
      "callableByAgentIds": ["agent-policy", "agent-ops-copilot"],
      "callType": "检索增强",
      "status": "ready",
      "owner": "知识库团队",
      "updatedAt": "2026-05-10",
      "permissionState": "available",
      "boundary": "只检索已入库内容，不生成未验证政策结论。",
      "recommended": true
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20
}
```

### 7.3 获取目录筛选聚合

`GET /api/agent-center/facets`

用于替换当前智能体中心中本地维护的分类、能力类型和权限统计。

响应：

```json
{
  "categories": [{ "name": "知识服务", "count": 1 }],
  "levels": [{ "level": "L1", "count": 2, "description": "问答/单点工具型，用户明确指令后执行。" }],
  "overview": [
    { "key": "availableAgents", "label": "可用 Agent", "value": 3 },
    { "key": "availableSkills", "label": "可用 Skills", "value": 3 },
    { "key": "lockedCount", "label": "锁定能力", "value": 5 },
    { "key": "highlightedCount", "label": "推荐更新", "value": 4 }
  ]
}
```

## 8. 建议开发优先级

| 优先级 | 接口                                                                                       | 原因                                       |
| ------ | ------------------------------------------------------------------------------------------ | ------------------------------------------ |
| P0     | `GET /api/users/me`、`GET /api/users/assignable`                                           | 所有权限、角色、待办派发依赖               |
| P0     | `GET /api/todos`、`POST /api/todos`、`PUT /api/todos/{id}`、`PATCH /api/todos/{id}/status` | 首页核心可交互能力                         |
| P0     | `POST /api/todos/ai-parse`                                                                 | 前端已有 AI 快捷创建入口                   |
| P1     | `GET /api/calendar/special-days`                                                           | 当前硬编码 2026 年数据，跨年后会失效       |
| P1     | `GET /api/workbench/tools`、`GET /api/workbench/profile-stats`                             | 首页个人区和工具区动态化                   |
| P1     | `/api/agent-center/*` 统计接口                                                             | 当前 `/agents` 页面完全依赖 mock 数据      |

## 9. 前端替换点

| 当前位置                        | 需要替换为                                       |
| ------------------------------- | ------------------------------------------------ |
| `mockUsers`                     | `GET /api/users/me`、`GET /api/users/assignable` |
| `mockInitialTodos`、`listTodos` | `GET /api/todos`                                 |
| `createTodo`                    | `POST /api/todos`                                |
| `updateTodo`                    | `PUT /api/todos/{id}`                            |
| `updateTodoStatus`              | `PATCH /api/todos/{id}/status`                   |
| `parseTodoText`                 | `POST /api/todos/ai-parse`                       |
| `specialDays`                   | `GET /api/calendar/special-days`                 |
| `campusTools`                   | `GET /api/workbench/tools`                       |
| `pointStats`                    | `GET /api/workbench/profile-stats`               |
| `summaryStats`                  | `GET /api/agent-center/summary`                  |
| `agents`、`categories`          | `GET /api/agent-center/agents`                   |
| `tokenOverview`                 | `GET /api/agent-center/token-overview`           |
| `tokenRanking`、`pointsRanking` | `GET /api/agent-center/rankings`                 |
| `trendData`                     | `GET /api/agent-center/token-trend`              |
| `src/modules/agent-center/mock.ts` 中的 `agents`、`skills` | `GET /api/agent-center/agents`、`GET /api/agent-center/skills` |
