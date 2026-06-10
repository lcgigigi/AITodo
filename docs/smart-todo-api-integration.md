# 智能待办后台接口对接整理

来源：后台同事提供的 `smart-todo-api.md`。

当前实现状态：15 个 HTTP 调用形式已添加到 `src/modules/home/dashboard/todo.service.ts`，首页日历待办已移除前端待办 mock 数据，运行时只走真实后台接口。

## 基础约定

| 项 | 后台约定 | 当前前端实现 |
| --- | --- | --- |
| 服务端口 | `8066` | `vite.config.ts` 将 `/login`、`/getInfo`、`/smart-todo` 代理到 `http://192.168.0.210:8066` |
| 登录路径 | `POST /login` | `loginSmartTodo()` |
| 当前用户路径 | `GET /getInfo` | `loadCurrentUser()` |
| 统一返回 | `{ code, msg, traceId, data }` | `code === 200` 视为成功 |
| 鉴权头 | `Authorization: Bearer {token}` | 全局请求拦截器自动注入 |

注意：

- 登录返回结构是 `{ code, msg, token }`，不是 `data.token`。
- `.env*` 里当前使用 `VITE_APP_TODO_USERNAME=admin`、`VITE_APP_TODO_PASSWORD=admin123` 做页面启动登录。
- 后台的 `assigneeId` 是员工工号，例如 `1102080`，不是姓名。

## 接口落点

| # | HTTP 接口 | 服务层方法 | 页面使用状态 |
| ---: | --- | --- | --- |
| 1 | `POST /login` | `loginSmartTodo()` | 页面启动登录 |
| 2 | `GET /getInfo` | `loadCurrentUser()` | 页面启动写入用户 store |
| 3 | `POST /smart-todo/analyze` | `analyzeTodoText()` / `parseTodoText()` | AI 解析按钮使用 |
| 4 | `GET /smart-todo/analyze?text=...` | `analyzeTodoTextByGet()` | 已添加兼容方法 |
| 5 | `POST /smart-todo/create` | `createTodo()` | 新增待办使用 |
| 6 | `PUT /smart-todo` | `updateTodo()` | 编辑待办使用 |
| 7 | `DELETE /smart-todo/{id}` | `deleteTodo()` | 删除待办使用 |
| 8 | `GET /smart-todo/{id}` | `loadTodoDetail()` | 已添加服务方法 |
| 9 | `POST /smart-todo/complete/{id}` | `completeTodo()` / `updateTodoStatus()` | 完成待办使用 |
| 10 | `POST /smart-todo/reject` | `rejectTodo()` | 已添加服务方法 |
| 11 | `GET /smart-todo/user-list` | `loadAssignableUsers()` | 负责人列表使用 |
| 12 | `GET /smart-todo/pending-list` | `loadPendingTodos()` | 已添加服务方法 |
| 13 | `GET /smart-todo/month-list` | `loadTodos()` | 日历月待办使用 |
| 14 | `POST /smart-todo/accept` | `acceptTodos()` | 已添加服务方法 |
| 15 | `POST /smart-todo/transfer` | `transferTodos()` | 已添加服务方法 |

## 字段映射

| 后台字段 | 前端字段 |
| --- | --- |
| `id` | `CalendarEvent.id` |
| `title` | `CalendarEvent.title` |
| `content` | `CalendarEvent.content`，同时作为无备注时的来源展示 |
| `timeType = 1` | `date = specificDate`，`time = specificTime(HH:mm)` |
| `timeType = 2` | `date = startDate`，`endDate = endDate`，`time` 为空 |
| `assigneeId` | `assigneeId`，并通过 `user-list` 补 `assigneeName` |
| `creatorId` | `creatorId`，用于 `editable` 和 `scope` |
| `currentHandlerId` | `currentHandlerId`，用于 `completable` |
| `remark` | `remark` / `source` |

## 状态映射

| 后台 `status` | 含义 | 当前前端展示 |
| ---: | --- | --- |
| `0` | 待处理 / 待接受 | `todo` |
| `3` | 已接受 | `todo` |
| `6` | 已完成 | `done` |
| `9` | 已拒绝 | `todo`，原始值保存在 `backendStatus` |
| `99` | 已删除 | 列表中过滤 |

当前前端仍只有 `todo | done` 两个视觉状态；如果要明显展示“待接受 / 已拒绝”，需要扩展 UI 状态标签。

## 已移除的前端模拟数据

- 删除 `src/modules/home/dashboard/todoMock.ts`。
- 删除 `src/modules/home/dashboard/desktopDraft.service.ts` 的本地草稿模拟来源。
- 移除路由守卫中的 `setGuestSession()` / `mock-token`。
- 首页日历不再从 localStorage 或种子数据初始化，改为启动后调用 `month-list`。

## 仍需后台确认

1. `GET /smart-todo/month-list` 是否可以增加 `year/month` 或 `startDate/endDate` 参数；当前日历 UI 支持切换月份，但接口文档只返回当前月。
2. `GET /getInfo` 是否确保 `user.userName` 就是员工工号；前端权限判断需要和 `assigneeId/currentHandlerId` 对齐。
3. `POST /smart-todo/complete/{id}` 的 `userId` 请求头是否仍必需；当前前端已按文档传入当前用户 ID。
4. `month-list/pending-list` 是否会返回 `creatorId/currentHandlerId/remark/content/receiveStatus`；如果缺字段，页面会保守处理权限和展示。
