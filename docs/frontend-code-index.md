# 前端代码文件索引

更新时间：2026-07-06

## 索引范围

本索引覆盖当前前端源码、测试、配置、样式、资产和项目文档。排除范围：`dist`、`output`、`.playwright-cli`、`.git`、系统隐藏文件、临时截图和依赖目录。

## 技术栈速览

Vue 3.5 + TypeScript 5.4 + Vite 4.5 + Pinia 2.1 + Tailwind 3.4 + reka-ui + ECharts 6 + axios + vitest。图标使用 `unplugin-icons`（lucide）。

## 应用入口与路由

| 文件                                   | 内容和作用                                    |
| -------------------------------------- | --------------------------------------------- |
| `src/app/main.ts`                      | Vue 应用入口，挂载根组件并注册全局 provider。 |
| `src/app/App.vue`                      | 应用根组件，承载路由出口和全局反馈组件。      |
| `src/app/providers/router-provider.ts` | 创建并导出路由实例。                          |
| `src/app/providers/pinia-provider.ts`  | 创建并导出 Pinia 实例。                       |
| `src/router/index.ts`                  | 路由模块入口。                                |
| `src/router/routes.ts`                 | 汇总静态路由（含 404 兜底）。                 |
| `src/router/module-routes.ts`          | 汇总各业务模块路由。                          |
| `src/router/guards.ts`                 | 路由守卫，处理登录态和页面访问控制。          |
| `src/config/route.config.ts`           | 路由常量配置，如登录页路径。                  |
| `src/vite-env.d.ts`                    | Vite 环境变量类型声明。                       |
| `env.d.ts`                             | 项目环境类型声明。                            |

路由一览：`/login`（Login）、`/`（Home）、`/agents`（AgentCenter）、`/leader-board`（LeaderBoard）。

## 业务模块

### 登录模块（`src/modules/auth/`）

| 文件                             | 内容和作用                                   |
| -------------------------------- | -------------------------------------------- |
| `src/modules/auth/LoginPage.vue` | 登录页，处理账号密码登录、动效和登录态写入。 |
| `src/modules/auth/routes.ts`     | 登录模块路由定义。                           |

### 首页与待办日历（`src/modules/home/`，核心模块）

#### 页面骨架

| 文件                                                        | 内容和作用                                                                                              |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/modules/home/routes.ts`                                | 首页模块路由定义。                                                                                       |
| `src/modules/home/DashboardPage.vue`                        | 首页容器：总览/详细模式切换、共享选中日期、邮箱类型确认弹层、新手引导启动。                              |
| `src/modules/home/dashboard/CalendarWorkspace.vue`          | 首页「总览模式」：问候语、今日待办、周/月日历、AI 快捷创建、工具入口；内含 2026 节假日/节气硬编码数据。 |
| `src/modules/home/dashboard/DetailedDashboardWorkspace.vue` | 首页「详细模式」：工作台式待办列表、月历（用 `CalendarMonth`）、趋势和快捷创建。                          |
| `src/modules/home/dashboard/DashboardTopBar.vue`            | 顶部栏：品牌信息、通知中心（`DashboardNotificationCenter`）、工具入口（`TopbarToolDock`）、用户菜单。     |
| `src/modules/home/dashboard/CalendarMonth.vue`              | 大日历组件：月视图（跨天条/逐日两种范围展示）+ 周时间轴视图，供详细模式使用。                            |
| `src/modules/home/dashboard/DayPreviewPanel.vue`            | 单日待办面板：筛选、查看、创建、编辑、删除和 AI 解析表单，总览/详细两种模式共用。                        |

#### 首页子组件（`src/modules/home/dashboard/components/`）

| 文件                                    | 内容和作用                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| `DashboardNotificationCenter.vue`       | 通知中心（popover/嵌入两种布局）：待接受待办 + 系统消息聚合、已读、删除、跳转。 |
| `OnboardingTour.vue`                    | 新手引导蒙层，分步聚光灯讲解首页功能。                                          |
| `TodoQuickCreateBar.vue`                | AI 快捷创建输入条（simple/detail 两种样式），总览和详细模式共用。               |
| `TopbarToolDock.vue`                    | 顶栏 AI 工具入口，消费 `dashboardTools.ts` 统一配置。                           |
| `HomePanelToolDock.vue`                 | 总览模式面板内 AI 工具入口，消费 `homePanelTools` 配置。                        |
| `AiParseStatus.vue`                     | AI 解析待办时的状态提示和 Rive/fallback 动效。                                  |
| `EventScheduleTime.vue`                 | 待办时间/全天/范围时间的统一展示组件。                                          |
| `TodoDatePicker.vue`                    | 单日期选择器。                                                                  |
| `TodoTimePicker.vue`                    | 单时间选择器。                                                                  |
| `TodoDeadlineDateTimeRange.vue`         | 截止/范围模式的开始和截止日期时间选择器。                                       |
| `TodoAssigneeSelect.vue`                | 负责人多选/单选组件。                                                           |
| `picker.helpers.ts`                     | 日期安全解析、时间解析、小时/分钟选项共享 helper。                              |
| `CalendarWeekTimeline.vue`              | 周时间轴组件；**当前无任何引用**（逻辑已并入 `CalendarMonth.vue`），属遗留文件。 |

#### 首页数据层与逻辑

| 文件（均在 `src/modules/home/dashboard/`） | 内容和作用                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------- |
| `todo.service.ts`                          | 智能待办接口层：登录、用户、待办 CRUD、状态流转（接受/拒绝/完成）和 AI 解析。    |
| `sys-message.service.ts`                   | 站内消息接口层：消息加载、已读、删除、WebSocket 地址和推送归一化。               |
| `sys-message.state.ts`                     | 站内消息本地列表合并、去重、已读和删除状态工具。                                 |
| `notification.inbox.ts`                    | 通知收件箱聚合：把待接受待办和系统消息统一成 InboxItem，排序/筛选/计数。         |
| `useDashboardTodos.ts`                     | 总览/详细模式共享的用户、人员、待办加载和事件映射 composable（挂在全局 store 上）。 |
| `useDashboardNotifications.ts`             | 通知中心 composable：消息分页加载、WebSocket 推送、待办接受/拒绝、已读/删除。    |
| `useDashboardGlassSettings.ts`             | 玻璃拟态视觉参数（模糊/饱和/透明度），localStorage 持久化。                      |
| `useHomeClock.ts`                          | 共享时钟 composable，按时段变化点精准调度刷新。                                  |
| `homeTimeOfDay.ts`                         | 时段划分（早/中/下午/晚）、问候语和下一次氛围变化时间计算。                      |
| `dashboardTools.ts`                        | 首页 AI 工具入口统一配置（顶栏 + 面板两组）和跳转 helper。                       |
| `onboardingTour.ts`                        | 新手引导自定义事件常量和派发函数。                                               |
| `todoDisplay.ts`                           | 待办日期、范围、时间展示、状态文案和排序工具。                                   |
| `dayPreviewPanel.helpers.ts`               | 单日面板筛选、类型、状态展示和快捷配置 helper。                                  |
| `types.ts`                                 | 待办、日历、用户、表单和智能待办领域类型。                                       |

### 智能体中心（`src/modules/agent-center/`）

| 文件                                 | 内容和作用                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| `src/modules/agent-center/routes.ts` | 智能体中心路由定义。                                                                 |
| `src/modules/agent-center/index.vue` | 智能体中心页面：智能体目录、能力入口、详情面板；个人 Token 图表已接 `token-usage` 真实接口。 |
| `src/modules/agent-center/mock.ts`   | 智能体、技能、分类、权限状态等静态数据（仍是 mock）。                                |
| `src/modules/agent-center/links.ts`  | 外部智能体系统跳转 URL 表和新窗口打开 helper。                                       |
| `src/modules/agent-center/types.ts`  | 智能体目录和分类类型。                                                               |

### Token 用量（`src/modules/token-usage/`，纯数据层，无页面）

| 文件                                             | 内容和作用                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| `src/modules/token-usage/token-usage.service.ts` | Token 用量接口层：个人用量/趋势、管理员看板（部门/模块）数据加载和归一化。 |
| `src/modules/token-usage/token-usage.helpers.ts` | 周期、日期范围、趋势日期和求和等纯函数 helper。                          |

被 `leader-board/index.vue`（管理员看板）和 `agent-center/index.vue`（个人用量）消费。

### Token 看板（`src/modules/leader-board/`）

| 文件                                 | 内容和作用                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| `src/modules/leader-board/routes.ts` | Token 看板路由定义。                                                           |
| `src/modules/leader-board/index.vue` | 管理员 Token 看板：趋势、部门排行、模块排行、翻页数字动效；数据来自 `loadAdminTokenDashboard` 真实接口。 |

## 全局 Store（`src/stores/`）

| 文件                                | 内容和作用                                                                      |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| `src/stores/user.store.ts`          | 用户 token、profile 和邮箱确认状态持久化。                                       |
| `src/stores/feedback.store.ts`      | 全局 loading/toast 状态。                                                        |
| `src/stores/dashboard-todos.store.ts` | 首页待办全局 store：按日期范围增量加载/缓存待办、可分配人员，供总览/详细模式共享。 |

## 共享 UI 组件（`src/components/ui/`）

shadcn/reka 风格基础组件，按目录划分：

| 目录                              | 内容                                                         |
| --------------------------------- | ------------------------------------------------------------ |
| `src/components/ui/button/`       | 基础按钮（`Button.vue` + `index.ts`）。                      |
| `src/components/ui/input/`        | 基础输入框（`Input.vue` + `index.ts`）。                     |
| `src/components/ui/popover/`      | Popover 全套（Root/Trigger/Content/Anchor/Header/Title/Description）。 |
| `src/components/ui/select/`       | Select 全套（Root/Trigger/Content/Item/Value/Label/Group/Separator/滚动按钮）。 |
| `src/components/ui/calendar/`     | 日历全套（Root/Header/Heading/Grid/Cell/前后翻页按钮），支持年月选择。 |
| `src/components/ui/scroll-area/`  | 滚动区域（`ScrollArea.vue`、`ScrollBar.vue`）。              |

## 共享能力（`src/shared/`、`src/lib/`）

| 文件                                                | 内容和作用                                            |
| --------------------------------------------------- | ----------------------------------------------------- |
| `src/shared/components/feedback/GlobalFeedback.vue` | 全局 loading 和 toast 展示组件。                      |
| `src/shared/components/animation/AppRive.vue`       | Rive 动画加载组件，支持 fallback 插槽。               |
| `src/shared/components/state/AppStateBlock.vue`     | 通用状态块：loading/empty/error/info 三种尺寸多处复用。 |
| `src/shared/request/http.ts`                        | Axios 实例和基础 HTTP 方法。                          |
| `src/shared/request/interceptors.ts`                | 请求/响应拦截器，注入 token、处理业务错误和 loading。 |
| `src/shared/request/feedback.ts`                    | 请求 loading 和错误 toast 管理。                      |
| `src/shared/request/error-code.ts`                  | HTTP/业务错误码文案映射。                             |
| `src/shared/request/types.ts`                       | 请求配置和响应类型。                                  |
| `src/shared/request/axios.d.ts`                     | Axios 类型扩展。                                      |
| `src/shared/utils/storage.ts`                       | localStorage JSON 读写封装。                          |
| `src/shared/types/api.ts`                           | 通用 API 响应类型。                                   |
| `src/shared/constants/app.ts`                       | 应用标题常量。                                        |
| `src/shared/constants/permission.ts`                | 权限常量。                                            |
| `src/lib/utils.ts`                                  | 通用工具，目前主要是 className 合并。                 |

## 样式与资产

| 文件                                   | 内容和作用                   |
| -------------------------------------- | ---------------------------- |
| `src/styles/index.css`                 | 全局样式入口。               |
| `src/styles/reset.css`                 | 浏览器默认样式重置。         |
| `src/styles/theme.css`                 | 主题基础样式。               |
| `src/styles/variables.css`             | CSS 变量。                   |
| `src/styles/transitions.css`           | 全局过渡动画。               |
| `src/assets/logoDark1.png`             | 顶部品牌 Logo。              |
| `src/assets/touxiang.png`              | 默认用户头像。               |
| `src/assets/morning.png`               | 首页早晨背景。               |
| `src/assets/noon.png`                  | 首页中午背景。               |
| `src/assets/afternoon.png`             | 首页下午背景。               |
| `src/assets/night.png`                 | 首页夜间背景。               |
| `src/assets/agent-center/make.png`     | 智能体中心视觉素材。         |
| `src/assets/agent-center/newagnet.png` | 智能体中心更多能力视觉素材。 |

## 测试

| 文件（均在 `src/modules/` 下）                            | 内容和作用                                           |
| --------------------------------------------------------- | ---------------------------------------------------- |
| `home/dashboard/todo.service.test.ts`                      | 智能待办接口层、数据归一化、状态流转和 AI 解析测试。 |
| `home/dashboard/sys-message.service.test.ts`               | 站内消息接口层和推送归一化测试。                     |
| `home/dashboard/sys-message.state.test.ts`                 | 站内消息本地列表状态工具测试。                       |
| `home/dashboard/notification.inbox.test.ts`                | 通知收件箱聚合、排序和筛选测试。                     |
| `home/dashboard/dashboardTools.test.ts`                    | 首页工具配置和跳转 helper 测试。                     |
| `home/dashboard/homeTimeOfDay.test.ts`                     | 时段划分和问候语测试。                               |
| `home/dashboard/todoDisplay.ai-focus.test.ts`              | 待办展示 AI 聚焦相关测试。                           |
| `home/dashboard/todoDisplay.status-filter.test.ts`         | 待办状态筛选展示测试。                               |
| `token-usage/token-usage.helpers.test.ts`                  | Token 用量周期/日期 helper 测试。                    |

## 配置、文档和辅助文件

| 文件                                 | 内容和作用                                 |
| ------------------------------------ | ------------------------------------------ |
| `vite.config.ts`                     | Vite、插件、路径别名和开发代理配置。       |
| `package.json`                       | npm 脚本和依赖声明。                       |
| `tsconfig.json`                      | TypeScript 编译配置。                      |
| `tailwind.config.cjs`                | Tailwind 配置。                            |
| `postcss.config.cjs`                 | PostCSS 配置。                             |
| `components.json`                    | shadcn/reka 风格组件配置。                 |
| `index.html`                         | Vite HTML 入口。                           |
| `README.md`                          | 项目说明。                                 |
| `UI_Design_Guideline.md`             | UI 设计规范。                              |
| `docs/smart-todo-api-integration.md` | 智能待办接口集成说明。                     |
| `docs/backend-api-requirements.md`   | 后端接口需求说明。                         |
| `docs/版本更替.md`                   | 版本变更说明。                             |
| `docs/frontend-code-index.md`        | 当前文件索引和模拟数据清单（本文件）。     |
| `replace_bubble.py` / `rewrite_dashboard.py` / `fix_padding.py` | 根目录一次性辅助脚本，非生产前端运行路径。 |
| `dist.zip` / `output/`               | 构建产物，非源码。                         |

## 前端模拟/静态数据清单

以下内容仍是模拟数据、静态数据或占位交互，改相关功能前先确认。

| 位置                                               | 当前状态                                                     | 建议后续接口方向                                       |
| -------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| `src/modules/agent-center/mock.ts`                 | 智能体、技能、分类、权限状态全部来自静态 mock。              | 建议提供智能体目录、技能目录、权限状态、收藏状态接口。 |
| `src/modules/agent-center/links.ts`                | 外部智能体跳转地址硬编码（内网 IP + 域名）。                 | 建议后端下发或走环境配置。                             |
| `src/modules/home/dashboard/CalendarWorkspace.vue` | 2026 年节假日、调休和节气硬编码在前端。                      | 建议后端按年份返回节假日、调休、节气日历数据。         |

已接真实接口（历史 mock 已移除）：

- 首页邮箱类型确认：`POST /smart-todo/select-email`（`DashboardPage.vue`）。
- Token 看板（`leader-board/index.vue`）：管理员部门/模块用量走 `token-usage.service.ts` 的 `loadAdminTokenDashboard`。
- 智能体中心个人 Token 图表（`agent-center/index.vue`）：走 `loadCurrentUserTokenUsage`。

## 遗留/清理候选

- `src/modules/home/dashboard/components/CalendarWeekTimeline.vue`：无任何引用，周视图逻辑已并入 `CalendarMonth.vue`。
- 根目录 `tode.txt`、`verification-dashboard.png`、`*.py` 脚本：一次性产物。
