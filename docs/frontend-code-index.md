# 前端代码索引

更新时间：2026-07-09

## 应用入口与基础设施

| 路径                      | 职责                                                   |
| ------------------------- | ------------------------------------------------------ |
| `src/app/`                | Vue 应用入口、Pinia 与 Router 初始化                   |
| `src/router/`             | 模块路由聚合、鉴权与标题守卫                           |
| `src/shared/request/`     | Axios 实例、结构化请求错误、反馈与 Smart-Todo 通用协议 |
| `src/shared/components/`  | 全局反馈、状态块和动画组件                             |
| `src/shared/composables/` | ECharts 生命周期等共享组合式逻辑                       |
| `src/stores/`             | 用户、反馈和工作台待办状态                             |

## 业务模块

| 模块                                                       | 职责                                 |
| ---------------------------------------------------------- | ------------------------------------ |
| `src/modules/auth/`                                        | 登录、当前用户、邮箱选择和桌面端授权 |
| `src/modules/home/`                                        | 首页容器以及简约/详细工作台          |
| `src/modules/home/dashboard/`                              | 待办服务、日历、通知和工作台组件     |
| `src/modules/home/dashboard/services/`                     | 待办、站内消息、通知收件箱等服务层   |
| `src/modules/home/dashboard/composables/`                  | 待办加载、通知 WebSocket、时钟等     |
| `src/modules/home/dashboard/helpers/`                        | 展示格式化、面板辅助、桌面端 query   |
| `src/modules/home/dashboard/config/`                       | 类型、工具入口、节假日静态数据       |
| `src/modules/home/__tests__/`                              | 首页模块单元测试                     |
| `src/modules/home/dashboard/config/calendar-special-days/2026.ts` | 2026 年节假日、调休和节气数据 |
| `src/modules/agent-center/`                                | 智能体目录及个人 Token 趋势          |
| `src/modules/leader-board/`                                | 管理员 Token 用量看板                |
| `src/modules/token-usage/`                                 | Token 接口适配、日期与格式化工具     |
| `src/modules/suggestion-inbox/`                            | 建议记录页面                         |

## 共享 UI 和样式

- `src/components/ui/`：Button、Input、Calendar、Popover、Select、ScrollArea。
- `src/styles/`：变量、主题、重置、过渡和玻璃效果。
- `src/assets/`：页面实际引用的图片资源。

## 测试

当前包含 21 个测试文件、110 条测试，覆盖认证参数、待办接口适配、乱序加载、通知、系统消息、
Token 用量、日期展示、请求错误和存储异常。首页模块测试集中在 `src/modules/home/__tests__/`。

## 已知边界

- 2026 年特殊日期仍为静态数据，跨年需要补充下一年度数据或接入后台接口。
- 登录账号密码暂时仍可从 `VITE_APP_TODO_*` 注入；这些值会进入浏览器产物，不能视为密钥。
- 核心工作台组件仍较大，后续重构应继续优先抽取纯逻辑，避免改变现有 DOM 和 scoped CSS。
