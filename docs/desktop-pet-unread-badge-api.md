# 桌面端宠物角标（未读消息数）对接说明

> 本文档供 **huali-ai-mascot** 桌面端项目使用，说明如何获取与 Web 端消息中心铃铛一致的「待处理」角标数量。
>
> 对应 Web 项目：`AITodo-main`  
> 桌面端客户端标识：`huali-ai-mascot`  
> 鉴权回调协议：`huali-ai-mascot://auth-callback`

---

## 1. 结论（先看这个）

**后端目前没有单独的「未读数 / 角标数」接口。**

桌面端需要调用 **2 个 HTTP 接口**，再按 Web 端相同规则合并去重，得到角标数字：

| 步骤 | 接口 | 用途 |
| --- | --- | --- |
| ① | `GET /smart-todo/pending-list` | 获取「待接受」待办数量 |
| ② | `GET /sys-message/page?msgStatus=0&...` | 获取「未读站内消息」并去重 |

**角标数 = 待接受待办数 + 去重后的未读站内消息数**

这与 Web 端消息中心「待处理」Tab 左上角铃铛角标逻辑一致（见 `useDashboardNotifications.ts` → `unreadNotificationCount`）。

---

## 2. 环境与鉴权

### 2.1 Base URL

| 环境 | Base URL | 说明 |
| --- | --- | --- |
| 开发 | `http://192.168.0.210:8066` | 与 Web 开发代理目标一致 |
| 生产 | 部署方配置的网关地址 | Web 生产构建使用 `/backendApi` 前缀，桌面端需对接同一网关 |

### 2.2 登录与 Token

桌面端通过 Web 登录页授权回调获取 token（已实现于 Web 端 `desktop-auth.ts`）：

1. 桌面端打开 Web 登录页，携带 `from=desktop`、`desktopClient=huali-ai-mascot` 等参数
2. 用户登录成功后，Web 跳转回 `huali-ai-mascot://auth-callback?token=...&userId=...&state=...`
3. 桌面端保存 `token`，后续所有 HTTP 请求携带：

```http
Authorization: Bearer {token}
```

### 2.3 通用响应格式

两个接口均返回 Smart-Todo 统一信封：

```json
{
  "code": 200,
  "msg": "操作成功",
  "data": { ... }
}
```

- `code !== 200` 或 `success === false` 视为失败
- 业务数据在 `data` 字段中
- `401` 表示 token 失效，需重新登录

---

## 3. 接口一：待接受待办

### 请求

```http
GET /smart-todo/pending-list
Authorization: Bearer {token}
```

### 响应

`data` 为待办数组，关键字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string / number | 待办 ID，去重时要用 |
| `status` | number | 后端状态；**过滤掉 `status === 9`（已拒绝）** |
| `title` / `content` | string | 待办标题/内容 |
| `creatorId` | string / number | 创建人工号 |

### 计数规则

```ts
const pendingTodos = data.filter(item => item.status !== 9)
const pendingCount = pendingTodos.length
const pendingIds = new Set(pendingTodos.map(item => String(item.id)))
```

> Web 端对应代码：`todo.service.ts` → `loadPendingTodos()`

---

## 4. 接口二：未读站内消息

### 请求

```http
GET /sys-message/page?pageNum=1&pageSize=50&msgStatus=0
Authorization: Bearer {token}
```

### 查询参数

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `pageNum` | 否 | 页码，默认 1 |
| `pageSize` | 否 | 每页条数，建议 50；需分页拉全量 |
| `msgStatus` | **是（角标场景）** | `0` = 未读，`1` = 已读 |
| `msgType` | 否 | 消息类型，一般可不传 |
| `bizType` | 否 | 业务类型：`1` 智能待办，`2` 会议，其他为系统消息 |

### 响应

```json
{
  "code": 200,
  "data": {
    "total": 8,
    "rows": [
      {
        "id": 9,
        "msgSubject": "您有一条新的待办",
        "msgContent": "...",
        "msgStatus": 0,
        "msgType": 1,
        "bizType": 1,
        "bizId": 458,
        "createTime": "2026-07-03 10:15:00"
      }
    ]
  }
}
```

| 字段 | 说明 |
| --- | --- |
| `total` | 未读消息总数（**不能直接用**，见下方去重规则） |
| `rows` / `list` | 当前页消息列表（两个字段名后端可能任选其一） |

> Web 端对应代码：`sys-message.service.ts` → `loadSysMessages()`

---

## 5. 角标计数算法（必须与 Web 保持一致）

Web 端在 `notification.inbox.ts` → `buildInboxItems()` 中做了**去重**：

> 若一条未读消息的 `bizType` 为 `1`（智能待办）或 `2`（会议），且其 `bizId` 已在「待接受待办」列表中，则**不再单独计数**（避免同一条待办算两次）。

### 完整算法

```ts
interface PendingTodo {
  id: string | number
  status?: number
}

interface SysMessage {
  id: string | number
  msgStatus: number   // 0=未读, 1=已读
  bizType?: number    // 1=智能待办, 2=会议
  bizId?: string | number
}

/** 拉取全部未读消息（分页） */
async function fetchAllUnreadMessages(token: string, baseUrl: string): Promise<SysMessage[]> {
  const all: SysMessage[] = []
  let pageNum = 1
  const pageSize = 50

  while (true) {
    const res = await fetch(
      `${baseUrl}/sys-message/page?pageNum=${pageNum}&pageSize=${pageSize}&msgStatus=0`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    const json = await res.json()
    if (json.code !== 200) throw new Error(json.msg || '加载消息失败')

    const rows: SysMessage[] = json.data?.rows ?? json.data?.list ?? []
    all.push(...rows)

    const total = Number(json.data?.total ?? rows.length)
    if (pageNum * pageSize >= total) break
    pageNum += 1
  }

  return all
}

/** 计算角标数（与 Web 铃铛角标一致） */
function calcUnreadBadgeCount(
  pendingTodos: PendingTodo[],
  unreadMessages: SysMessage[],
): number {
  const validPending = pendingTodos.filter(t => t.status !== 9)
  const pendingIds = new Set(validPending.map(t => String(t.id)))

  const dedupedUnread = unreadMessages.filter(msg => {
    if (msg.msgStatus !== 0) return false
    if (!msg.bizId) return true
    if (msg.bizType !== 1 && msg.bizType !== 2) return true
    return !pendingIds.has(String(msg.bizId))
  })

  return validPending.length + dedupedUnread.length
}
```

### 示例

| 数据 | 数量 |
| --- | --- |
| 待接受待办 | 1 条（id=458） |
| 未读消息：关联待办 458 的通知 | 1 条（**去重，不计入**） |
| 未读消息：系统通知 | 1 条 |
| **角标** | **2** |

---

## 6. 推荐调用流程

```
┌─────────────┐
│  桌面端启动   │
└──────┬──────┘
       │ 读取本地 token
       ▼
┌──────────────────────────────┐
│ 并行请求：                     │
│  GET /smart-todo/pending-list │
│  GET /sys-message/page        │
│       ?msgStatus=0 (分页拉全)   │
└──────┬───────────────────────┘
       │ calcUnreadBadgeCount()
       ▼
┌─────────────┐
│ 更新角标 UI  │
└─────────────┘
       │
       │ 定时轮询（建议 30~60s）
       │ + WebSocket 推送触发即时刷新
       ▼
```

### 6.1 轮询（必做）

建议每隔 **30~60 秒**重新执行一次上述两个接口，更新角标。

### 6.2 WebSocket 实时推送（建议做）

收到新消息后立刻刷新角标，避免等轮询。

| 项目 | 值 |
| --- | --- |
| 连接地址 | `ws(s)://{host}/websocket/{userId}` |
| userId | 登录用户的工号，需 `encodeURIComponent` |
| 推送格式 | JSON，`type` 必须为 `"sys_message"` |

推送示例：

```json
{
  "type": "sys_message",
  "id": 9,
  "msgSubject": "待办已完成",
  "msgContent": "...",
  "msgStatus": 0,
  "msgType": 1,
  "bizType": 1,
  "bizId": 123,
  "createTime": "2026-07-10T10:15:00"
}
```

收到推送后的处理（与 Web 一致）：

1. 重新请求 `GET /sys-message/page?msgStatus=0`
2. 若 `bizType === 1` 且存在 `bizId`，同时重新请求 `GET /smart-todo/pending-list`
3. 重新计算角标

重连策略（Web 已实现）：

```
delay = min(30000, 3000 + reconnectAttempts * 2000)
```

> 详细 WebSocket 说明见同目录：`sys-message-websocket接口说明.txt`

---

## 7. 角标为 0 时的处理

- 角标数 `<= 0` 时隐藏角标，或显示空
- token 失效（401）时清除角标并引导重新登录
- 网络错误时保留上次成功值，或显示「—」

---

## 8. 相关 Web 端源码索引

桌面端实现时可对照以下文件，确保逻辑一致：

| 文件 | 作用 |
| --- | --- |
| `src/modules/home/dashboard/composables/useDashboardNotifications.ts` | 通知加载、角标计数、WebSocket |
| `src/modules/home/dashboard/services/notification.inbox.ts` | 合并去重、`buildInboxItems()` |
| `src/modules/home/dashboard/services/sys-message.service.ts` | 站内消息 HTTP 接口 |
| `src/modules/home/dashboard/services/todo.service.ts` | `loadPendingTodos()` |
| `src/modules/auth/desktop-auth.ts` | 桌面端登录回调协议 |

---

## 9. 常见问题

### Q1：能不能只调 `/sys-message/page?msgStatus=0` 用 `total` 做角标？

**不行。** `total` 包含与「待接受待办」重复的关联消息，会多算。必须加上 `/smart-todo/pending-list` 并做去重。

### Q2：能不能只调 `/smart-todo/pending-list`？

**不行。** 系统通知、会议提醒、已读待办相关通知等不在 pending-list 里，角标会少算。

### Q3：后端以后会不会提供单独的 count 接口？

目前 Web 端也是双接口合并，暂无 `/sys-message/unread-count` 之类接口。若后端后续新增，桌面端可改为单接口；在此之前请按本文档实现。

### Q4：角标数和 Web「全部」Tab 的数字一样吗？

**不一样。**

| 场景 | 计数范围 |
| --- | --- |
| **角标 / 待处理 Tab** | 待接受待办 + 未读消息（去重后） |
| **全部 Tab** | 待接受待办 + 已加载的全部消息（含已读） |

桌面端角标应对齐 **待处理 / 铃铛角标**。

---

## 10. 最小可用示例（伪代码）

```ts
async function refreshDesktopBadge(token: string, baseUrl: string) {
  const headers = { Authorization: `Bearer ${token}` }

  const [pendingRes, unreadMessages] = await Promise.all([
    fetch(`${baseUrl}/smart-todo/pending-list`, { headers }).then(r => r.json()),
    fetchAllUnreadMessages(token, baseUrl),
  ])

  if (pendingRes.code !== 200) throw new Error(pendingRes.msg)

  const pendingTodos: PendingTodo[] = pendingRes.data ?? []
  const badge = calcUnreadBadgeCount(pendingTodos, unreadMessages)

  return badge  // 传给 UI 层显示角标
}
```

---

*文档版本：2026-07-10 · 基于 AITodo-main 当前实现整理*
