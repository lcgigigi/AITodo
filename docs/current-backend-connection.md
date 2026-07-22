# 当前项目后台连接说明

本文档根据当前代码整理，说明前端如何连接后台、开发代理如何转发、鉴权怎么注入，以及各业务模块实际调用了哪些接口。

## 结论概览

当前项目是 Vue 3 + Vite + axios 前端应用，后台连接主要分为四类：

1. 智能待办、登录、用户信息、Token 用量、站内消息接口：开发环境通过 Vite proxy 转发到 `http://192.168.0.210:8066`。
2. 站内消息 WebSocket：开发环境连接本机 Vite 地址 `/websocket/{userId}`，再由 Vite proxy 以 `ws: true` 转发到 `http://192.168.0.210:8066`。
3. 生产环境 HTTP 基础路径：`.env.production` 配置为 `VITE_APP_BASE_API=/backendApi`，需要部署侧反向代理把 `/backendApi/...` 转发到真实后台。
4. 旧的 `/api`、`/prod-api` 代理仍在 `vite.config.ts` 保留，但当前 `src` 代码里主要业务没有实际调用 `/api`。

## 关键文件

| 文件 | 作用 |
| --- | --- |
| `src/shared/request/http.ts` | 创建 axios 实例，读取 `VITE_APP_BASE_API` 作为 `baseURL`，统一 60 秒超时。 |
| `src/shared/request/interceptors.ts` | 请求拦截器注入 `Authorization: Bearer {token}`，响应拦截器处理业务错误和 HTTP 错误。 |
| `src/stores/user.store.ts` | 保存 token 和用户资料到 Pinia + `localStorage`。 |
| `vite.config.ts` | 本地开发代理配置。 |
| `.env`、`.env.development`、`.env.production` | 环境变量配置。 |
| `src/modules/home/dashboard/todo.service.ts` | 登录、当前用户、智能待办相关接口。 |
| `src/modules/token-usage/token-usage.service.ts` | Token 用量接口。 |
| `src/modules/home/dashboard/sys-message.service.ts` | 站内消息 HTTP 接口和 WebSocket URL 构造。 |
| `src/modules/home/dashboard/useDashboardNotifications.ts` | 通知中心加载消息、待接受待办，并维护 WebSocket 重连。 |

## 环境变量

| 变量 | 当前值 | 说明 |
| --- | --- | --- |
| `VITE_APP_BASE_API` | 开发为空，生产为 `/backendApi` | axios `baseURL`。开发为空时请求走相对路径，命中 Vite proxy。 |
| `VITE_APP_SYS_MESSAGE_WS_BASE_URL` | 空 | 站内消息 WebSocket 基础地址。为空时默认使用当前页面 host。 |
| `VITE_APP_MOCK` | `false` | 当前代码没有在请求封装里用它切换 mock。 |

## axios 请求流程

`http.ts` 创建 axios 实例：

```ts
const httpClient = axios.create({
  baseURL: import.meta.env.VITE_APP_BASE_API,
  timeout: 60_000,
})
```

请求拦截器会读取 `useUserStore().token`：

```ts
config.headers.Authorization = `Bearer ${userStore.token}`
```

响应拦截器的成功判断：

- 如果返回体存在 `success: false`，按业务失败处理。
- 如果返回体存在数字 `code` 且 `code !== 200`，按业务失败处理。
- HTTP 错误按状态码映射提示：`400`、`401`、`403`、`404`、`500` 有内置中文文案。
- 请求配置 `showError: false` 时，不弹全局错误提示。

注意：`http.get/post/put/delete` 这层封装默认返回 `response.data.data`；但智能待办、站内消息、Token 用量服务大多直接使用 `httpClient.request()`，因为后台返回结构存在 `msg`、`token` 等非标准字段。

## 本地开发代理

`vite.config.ts` 中定义：

```ts
const smartTodoApiTarget = 'http://192.168.0.210:8066'
```

主要代理规则：

| 前端请求路径 | 转发目标 | 说明 |
| --- | --- | --- |
| `/login` | `http://192.168.0.210:8066` | `POST /login` 转后台；`GET/HEAD /login` 返回 SPA，避免刷新登录页被代理走。 |
| `/getInfo` | `http://192.168.0.210:8066` | 获取当前用户。 |
| `/logout` | `http://192.168.0.210:8066` | 退出登录。 |
| `/smart-todo` | `http://192.168.0.210:8066` | 智能待办接口。 |
| `/token-usage` | `http://192.168.0.210:8066` | Token 用量接口。 |
| `/sys-message` | `http://192.168.0.210:8066` | 站内消息 HTTP 接口。 |
| `/websocket` | `http://192.168.0.210:8066` | 站内消息 WebSocket，启用 `ws: true`。 |
| `/api` | `http://127.0.0.1:8080` | 保留代理，当前主要业务代码未使用。 |
| `/prod-api` | `http://10.8.7.57:5000` | 保留代理，当前主要业务代码未使用。 |

开发环境请求示例：

```text
浏览器 -> http://127.0.0.1:5173/smart-todo/month-list
Vite proxy -> http://192.168.0.210:8066/smart-todo/month-list
```

## 生产部署要求

生产 `.env.production` 设置：

```text
VITE_APP_BASE_API=/backendApi
```

因此生产构建后的 HTTP 请求会变成：

```text
/backendApi/login
/backendApi/getInfo
/backendApi/smart-todo/month-list
/backendApi/token-usage/current-user
/backendApi/sys-message/page
```

部署时必须配置 Nginx、网关或其他反向代理，把 `/backendApi` 转发到真实后台。如果后台实际接口没有 `/backendApi` 前缀，代理需要 rewrite 掉这个前缀。

WebSocket 不走 axios 的 `baseURL`。`VITE_APP_SYS_MESSAGE_WS_BASE_URL` 为空时，前端会根据当前页面协议和 host 生成：

```text
ws://当前域名/websocket/{userId}
wss://当前域名/websocket/{userId}
```

所以生产也需要代理 `/websocket`，并支持 WebSocket upgrade。

## 登录和鉴权

登录流程：

1. 登录页调用 `loginSmartTodo()`。
2. `POST /login`，请求体是 `{ username, password }`。
3. 后台返回 `token` 字段，前端要求它在返回体顶层，例如 `{ code: 200, token: "..." }`。
4. token 写入 `user.store.ts`，本地存储 key 为 `ai-workbench:user-token`。
5. 后续 HTTP 请求由 axios 拦截器自动加 `Authorization: Bearer {token}`。
6. 前端再调用 `GET /getInfo`，把用户信息保存到 `ai-workbench:user-profile`。

路由守卫只根据本地 token 判断是否已登录；如果业务接口返回登录过期或 `401`，待办 store 会清空本地登录态并跳回登录页。

## 智能待办接口

服务文件：`src/modules/home/dashboard/todo.service.ts`

统一约定：

- 大部分请求超时时间为 60 秒。
- 成功判断是 `code === 200` 且 `success !== false`。
- 数据通常从 `data` 字段读取。
- 员工和负责人字段使用工号类 ID，前端会转成字符串比较。

| 功能 | 方法 | 接口 |
| --- | --- | --- |
| 登录 | `loginSmartTodo()` | `POST /login` |
| 退出 | `logoutSmartTodo()` | `POST /logout` |
| 当前用户 | `loadCurrentUser()` | `GET /getInfo` |
| 选择邮箱类型 | `selectEmailProvider()` | `POST /smart-todo/select-email?choice=1/2` |
| AI 解析待办 | `analyzeTodoText()` | `POST /smart-todo/analyze` |
| AI 解析待办兼容 GET | `analyzeTodoTextByGet()` | `GET /smart-todo/analyze?text=...` |
| 可分派用户 | `loadAssignableUsers()` | `GET /smart-todo/user-list` |
| 月/周范围待办 | `loadTodos()` | `GET /smart-todo/month-list?startDate=&endDate=` |
| 待接受待办 | `loadPendingTodos()` | `GET /smart-todo/pending-list` |
| 今日待办 | `loadTodayTodos()` | `GET /smart-todo/today-list?status=&type=` |
| 待办详情 | `loadTodoDetail()` | `GET /smart-todo/{id}` |
| 创建待办 | `createTodo()` | `POST /smart-todo/create` |
| 更新待办 | `updateTodo()` | `PUT /smart-todo` |
| 删除待办 | `deleteTodo()` | `DELETE /smart-todo/{id}` |
| 完成待办 | `completeTodo()` | `POST /smart-todo/complete/{id}`，会额外传 `userId` 请求头。 |
| 撤销完成 | `cancelTodoComplete()` | `POST /smart-todo/cancel` |
| 拒绝待办 | `rejectTodo()` | `POST /smart-todo/reject` |
| 接受待办 | `acceptTodos()` | `POST /smart-todo/accept` |
| 转发待办 | `transferTodos()` | `POST /smart-todo/transfer` |
| 同步邮箱日程 | `syncCalendar()` | `POST /smart-todo/sync-calendar` |

首页待办加载链路：

1. `useDashboardTodos()` 调用 dashboard todos store。
2. store 检查本地 token。
3. 没有用户资料时调用 `GET /getInfo`。
4. 没有负责人列表时调用 `GET /smart-todo/user-list`。
5. 根据当前日历可见范围调用 `GET /smart-todo/month-list`。
6. 页面完成、撤销完成等操作调用对应接口，并在失败时回滚乐观更新。

## Token 用量接口

服务文件：`src/modules/token-usage/token-usage.service.ts`

| 功能 | 方法 | 接口 |
| --- | --- | --- |
| 当前用户 Token 用量 | `loadCurrentUserTokenUsage()` | `GET /token-usage/current-user?startDate=&endDate=` |
| 管理员 Token 看板 | `loadAdminTokenDashboard()` | `GET /token-usage/admin-dashboard?startDate=&endDate=` |
| 二级部门列表 | `loadTokenUsageDeptList()` | `GET /token-usage/dept-list` |

使用位置：

- `src/modules/agent-center/index.vue` 调用当前用户 Token 用量。
- `src/modules/leader-board/index.vue` 调用管理员 Token 看板。

## 站内消息 HTTP 接口

服务文件：`src/modules/home/dashboard/sys-message.service.ts`

| 功能 | 方法 | 接口 |
| --- | --- | --- |
| 分页查询消息 | `loadSysMessages()` | `GET /sys-message/page?pageNum=&pageSize=&msgStatus=&msgType=&bizType=` |
| 标记消息已读 | `markSysMessagesRead()` | `PUT /sys-message/read` |
| 全部标记已读 | `markAllSysMessagesRead()` | `PUT /sys-message/read-all` |
| 删除消息 | `deleteSysMessages()` | `DELETE /sys-message` |

通知中心会同时加载：

- `GET /smart-todo/pending-list`：待接受待办。
- `GET /sys-message/page`：站内消息。

如果用户接受或拒绝待办，会调用 `/smart-todo/accept` 或 `/smart-todo/reject`，并把关联站内消息标记已读。

## 站内消息 WebSocket

WebSocket URL 构造函数：`buildSysMessageWebSocketUrl(userId)`

默认规则：

```text
/websocket/{encodeURIComponent(userId)}
```

本地开发示例：

```text
ws://127.0.0.1:5173/websocket/10002
```

Vite 会把它代理到：

```text
ws://192.168.0.210:8066/websocket/10002
```

服务端推送格式要求是 JSON 字符串，当前前端只处理：

```json
{
  "type": "sys_message",
  "id": 9,
  "msgSubject": "会议提醒",
  "msgContent": "标题：周会",
  "msgStatus": 0,
  "msgType": 1,
  "bizType": 2,
  "bizId": 88,
  "createTime": "2026-06-17T10:00:00"
}
```

当前 WebSocket 没有额外传 token，也没有设置 `Authorization` header。浏览器原生 WebSocket 不能像 axios 一样直接加请求头；目前只通过 URL 中的 `userId` 建连。

重连策略在 `useDashboardNotifications.ts`：

```text
delay = min(30000, 3000 + reconnectAttempts * 2000)
```

也就是断开后递增重连，最长 30 秒。

## 当前 mock 和保留接口状态

- 首页待办、通知、Token 用量已经走真实 HTTP 接口。
- `src/modules/agent-center/index.vue` 仍从 `src/modules/agent-center/mock.ts` 使用智能体列表、权限标签等本地数据；但其中的个人 Token 使用记录走真实 `/token-usage/current-user`。
- `docs/backend-api-requirements.md` 中提到的 `/api/users/me`、`/api/todos`、`/api/agent-center/*` 更像早期规划或需求文档；当前 `src` 主要业务代码没有调用这些 `/api` 接口。
- `vite.config.ts` 的 `/api`、`/prod-api` 代理仍保留，可能是兼容旧接口或备用环境。

## 排查后台连接问题时优先看

1. 开发环境接口不通：检查 `vite.config.ts` 里的 `smartTodoApiTarget` 是否能从本机访问。
2. 生产环境接口 404：检查 `/backendApi` 是否正确反向代理，并确认是否需要 rewrite 前缀。
3. 登录后接口 401：检查登录返回是否有顶层 `token`，以及后续请求是否带了 `Authorization: Bearer ...`。
4. 页面刷新登录页异常：确认 `/login` 的 `GET/HEAD` 没有被反向代理到后台；开发环境 Vite 已做 bypass，生产环境也要处理 SPA fallback。
5. WebSocket 不通：检查 `/websocket` 是否配置了 upgrade，HTTPS 页面必须使用 `wss://`。
6. 通知中心无数据：同时检查 `/sys-message/page`、`/smart-todo/pending-list` 和 WebSocket 推送格式。
