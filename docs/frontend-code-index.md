# 前端代码文件索引

更新时间：2026-06-25

## 索引范围

本索引覆盖当前前端源码、测试、配置、样式、资产和项目文档。排除范围：`agent-center-old`、`dist`、`output`、`.playwright-cli`、`.git`、系统隐藏文件、临时截图和依赖目录。

## 应用入口与路由

| 文件                                   | 内容和作用                                    |
| -------------------------------------- | --------------------------------------------- |
| `src/app/main.ts`                      | Vue 应用入口，挂载根组件并注册全局 provider。 |
| `src/app/App.vue`                      | 应用根组件，承载路由出口和全局反馈组件。      |
| `src/app/providers/router-provider.ts` | 创建并导出路由实例。                          |
| `src/app/providers/pinia-provider.ts`  | 创建并导出 Pinia 实例。                       |
| `src/router/index.ts`                  | 路由模块入口。                                |
| `src/router/routes.ts`                 | 汇总静态路由。                                |
| `src/router/module-routes.ts`          | 汇总各业务模块路由。                          |
| `src/router/guards.ts`                 | 路由守卫，处理登录态和页面访问控制。          |
| `src/config/route.config.ts`           | 路由常量配置，如登录页路径。                  |
| `src/vite-env.d.ts`                    | Vite 环境变量类型声明。                       |
| `env.d.ts`                             | 项目环境类型声明。                            |

## 业务模块

### 登录模块

| 文件                             | 内容和作用                                   |
| -------------------------------- | -------------------------------------------- |
| `src/modules/auth/LoginPage.vue` | 登录页，处理账号密码登录、动效和登录态写入。 |
| `src/modules/auth/routes.ts`     | 登录模块路由定义。                           |

### 首页与待办日历

| 文件                                                        | 内容和作用                                                             |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/modules/home/routes.ts`                                | 首页模块路由定义。                                                     |
| `src/modules/home/DashboardPage.vue`                        | 首页容器，切换总览/详细模式，处理邮箱类型确认弹层。                    |
| `src/modules/home/dashboard/CalendarWorkspace.vue`          | 首页总览模式，展示今日待办、周/月日历、侧边待办详情和趋势图。          |
| `src/modules/home/dashboard/DetailedDashboardWorkspace.vue` | 首页详细模式，展示工作台式待办列表、月历、趋势和快捷创建。             |
| `src/modules/home/dashboard/DashboardTopBar.vue`            | 工作台顶部栏，包含品牌信息、消息中心、待接受待办和用户菜单。           |
| `src/modules/home/dashboard/DayPreviewPanel.vue`            | 单日待办面板，负责筛选、查看、创建、编辑、删除和 AI 解析表单。         |
| `src/modules/home/dashboard/dashboardTools.ts`              | 首页工具入口统一配置和跳转 helper。                                    |
| `src/modules/home/dashboard/useDashboardTodos.ts`           | 首页总览/详细模式共享的用户、人员、待办加载和事件映射 composable。     |
| `src/modules/home/dashboard/dayPreviewPanel.helpers.ts`     | 单日面板筛选、类型、状态展示和快捷配置 helper。                        |
| `src/modules/home/dashboard/todo.service.ts`                | 智能待办接口层，处理登录、用户、待办 CRUD、状态流转和 AI 解析。        |
| `src/modules/home/dashboard/todoDisplay.ts`                 | 待办日期、范围、时间展示、状态文案和排序工具。                         |
| `src/modules/home/dashboard/types.ts`                       | 待办、日历、用户、表单和智能待办领域类型。                             |
| `src/modules/home/dashboard/sys-message.service.ts`         | 站内消息接口层，包含消息加载、已读、删除、WebSocket 地址和推送归一化。 |
| `src/modules/home/dashboard/sys-message.state.ts`           | 站内消息本地列表合并、去重、已读和删除状态工具。                       |

### 首页待办组件

| 文件                                                                  | 内容和作用                                         |
| --------------------------------------------------------------------- | -------------------------------------------------- |
| `src/modules/home/dashboard/components/TopbarToolDock.vue`            | 顶部 AI 工具入口展示组件，消费统一工具配置。       |
| `src/modules/home/dashboard/components/AiParseStatus.vue`             | AI 解析待办时的状态提示和 Rive/fallback 动效。     |
| `src/modules/home/dashboard/components/EventScheduleTime.vue`         | 待办时间/全天/范围时间的统一展示组件。             |
| `src/modules/home/dashboard/components/TodoDatePicker.vue`            | 单日期选择器。                                     |
| `src/modules/home/dashboard/components/TodoTimePicker.vue`            | 单时间选择器。                                     |
| `src/modules/home/dashboard/components/TodoDeadlineDateTimeRange.vue` | 截止/范围模式的开始和截止日期时间选择器。          |
| `src/modules/home/dashboard/components/TodoAssigneeSelect.vue`        | 负责人多选/单选组件。                              |
| `src/modules/home/dashboard/components/picker.helpers.ts`             | 日期安全解析、时间解析、小时/分钟选项共享 helper。 |

### 智能体中心

| 文件                                 | 内容和作用                                                          |
| ------------------------------------ | ------------------------------------------------------------------- |
| `src/modules/agent-center/routes.ts` | 智能体中心路由定义。                                                |
| `src/modules/agent-center/index.vue` | 智能体中心页面，展示智能体目录、能力入口、详情面板和 Token 可视化。 |
| `src/modules/agent-center/mock.ts`   | 智能体、技能、分类、权限状态等静态数据。                            |
| `src/modules/agent-center/types.ts`  | 智能体目录和分类类型。                                              |

### Token 看板

| 文件                                 | 内容和作用                                                     |
| ------------------------------------ | -------------------------------------------------------------- |
| `src/modules/leader-board/routes.ts` | Token 看板路由定义。                                           |
| `src/modules/leader-board/index.vue` | Token 使用领导者看板，展示趋势、部门排行、应用排行和图表交互。 |

## 共享 UI 组件

| 文件                                                  | 内容和作用                 |
| ----------------------------------------------------- | -------------------------- |
| `src/components/ui/button/Button.vue`                 | 基础按钮组件。             |
| `src/components/ui/button/index.ts`                   | 按钮组件导出。             |
| `src/components/ui/input/Input.vue`                   | 基础输入框组件。           |
| `src/components/ui/input/index.ts`                    | 输入框组件导出。           |
| `src/components/ui/popover/Popover.vue`               | Popover 根组件封装。       |
| `src/components/ui/popover/PopoverTrigger.vue`        | Popover 触发器。           |
| `src/components/ui/popover/PopoverContent.vue`        | Popover 内容容器。         |
| `src/components/ui/popover/PopoverAnchor.vue`         | Popover 锚点。             |
| `src/components/ui/popover/PopoverHeader.vue`         | Popover 头部结构。         |
| `src/components/ui/popover/PopoverTitle.vue`          | Popover 标题。             |
| `src/components/ui/popover/PopoverDescription.vue`    | Popover 描述。             |
| `src/components/ui/popover/index.ts`                  | Popover 组件导出。         |
| `src/components/ui/select/Select.vue`                 | Select 根组件封装。        |
| `src/components/ui/select/SelectTrigger.vue`          | Select 触发器。            |
| `src/components/ui/select/SelectContent.vue`          | Select 下拉内容。          |
| `src/components/ui/select/SelectItem.vue`             | Select 选项。              |
| `src/components/ui/select/SelectItemText.vue`         | Select 选项文本。          |
| `src/components/ui/select/SelectValue.vue`            | Select 当前值。            |
| `src/components/ui/select/SelectLabel.vue`            | Select 分组标签。          |
| `src/components/ui/select/SelectGroup.vue`            | Select 分组。              |
| `src/components/ui/select/SelectSeparator.vue`        | Select 分隔线。            |
| `src/components/ui/select/SelectScrollUpButton.vue`   | Select 上滚按钮。          |
| `src/components/ui/select/SelectScrollDownButton.vue` | Select 下滚按钮。          |
| `src/components/ui/select/index.ts`                   | Select 组件导出。          |
| `src/components/ui/calendar/Calendar.vue`             | 日历根组件，支持年月选择。 |
| `src/components/ui/calendar/CalendarHeader.vue`       | 日历头部。                 |
| `src/components/ui/calendar/CalendarHeading.vue`      | 日历当前年月标题。         |
| `src/components/ui/calendar/CalendarGrid.vue`         | 日历网格容器。             |
| `src/components/ui/calendar/CalendarGridHead.vue`     | 日历星期头部。             |
| `src/components/ui/calendar/CalendarGridBody.vue`     | 日历日期主体。             |
| `src/components/ui/calendar/CalendarGridRow.vue`      | 日历行。                   |
| `src/components/ui/calendar/CalendarHeadCell.vue`     | 日历星期单元格。           |
| `src/components/ui/calendar/CalendarCell.vue`         | 日历日期单元格。           |
| `src/components/ui/calendar/CalendarCellTrigger.vue`  | 日历日期按钮。             |
| `src/components/ui/calendar/CalendarPrevButton.vue`   | 日历上一周期按钮。         |
| `src/components/ui/calendar/CalendarNextButton.vue`   | 日历下一周期按钮。         |
| `src/components/ui/calendar/index.ts`                 | 日历组件导出。             |
| `src/components/ui/scroll-area/ScrollArea.vue`        | 滚动区域组件。             |
| `src/components/ui/scroll-area/ScrollBar.vue`         | 滚动条组件。               |
| `src/components/ui/scroll-area/index.ts`              | 滚动区域组件导出。         |

## 共享能力

| 文件                                                | 内容和作用                                            |
| --------------------------------------------------- | ----------------------------------------------------- |
| `src/shared/components/feedback/GlobalFeedback.vue` | 全局 loading 和 toast 展示组件。                      |
| `src/shared/components/animation/AppRive.vue`       | Rive 动画加载组件，支持 fallback 插槽。               |
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
| `src/stores/user.store.ts`                          | 用户 token、profile 和邮箱确认状态持久化。            |
| `src/stores/feedback.store.ts`                      | 全局 loading/toast 状态。                             |

## 样式与资产

| 文件                                   | 内容和作用                   |
| -------------------------------------- | ---------------------------- |
| `src/styles/index.css`                 | 全局样式入口。               |
| `src/styles/reset.css`                 | 浏览器默认样式重置。         |
| `src/styles/theme.css`                 | 主题基础样式。               |
| `src/styles/variables.css`             | CSS 变量。                   |
| `src/styles/transitions.css`           | 全局过渡动画。               |
| `src/assets/logoDark1.png`             | 顶部品牌 Logo。              |
| `src/assets/libao.png`                 | 默认用户头像。               |
| `src/assets/morning.png`               | 首页早晨背景。               |
| `src/assets/noon.png`                  | 首页中午背景。               |
| `src/assets/afternoon.png`             | 首页下午背景。               |
| `src/assets/night.png`                 | 首页夜间背景。               |
| `src/assets/agent-center/make.png`     | 智能体中心视觉素材。         |
| `src/assets/agent-center/newagnet.png` | 智能体中心更多能力视觉素材。 |

## 测试

| 文件                                                     | 内容和作用                                           |
| -------------------------------------------------------- | ---------------------------------------------------- |
| `src/modules/home/dashboard/todo.service.test.ts`        | 智能待办接口层、数据归一化、状态流转和 AI 解析测试。 |
| `src/modules/home/dashboard/sys-message.service.test.ts` | 站内消息接口层和推送归一化测试。                     |
| `src/modules/home/dashboard/sys-message.state.test.ts`   | 站内消息本地列表状态工具测试。                       |

## 配置、文档和辅助文件

| 文件                                 | 内容和作用                                 |
| ------------------------------------ | ------------------------------------------ |
| `vite.config.ts`                     | Vite、插件、路径别名和开发代理配置。       |
| `package.json`                       | npm 脚本和依赖声明。                       |
| `package-lock.json`                  | npm 锁文件。                               |
| `pnpm-lock.yaml`                     | pnpm 锁文件。                              |
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
| `docs/首页待办日历功能审查总结.txt`  | 首页待办日历审查文本记录。                 |
| `docs/首页待办日历功能审查总结.docx` | 首页待办日历审查文档。                     |
| `docs/版本更替.docx`                 | 版本变更文档。                             |
| `docs/前后端问题沟通表.xlsx`         | 前后端问题沟通表。                         |
| `docs/frontend-code-index.md`        | 当前文件索引和模拟数据清单。               |
| `replace_bubble.py`                  | 根目录辅助脚本，非生产前端运行路径。       |
| `rewrite_dashboard.py`               | 根目录辅助脚本，非生产前端运行路径。       |
| `fix_padding.py`                     | 根目录辅助脚本，非生产前端运行路径。       |
| `1.html`                             | 根目录临时 HTML 文件，非生产前端运行路径。 |
| `dist.zip`                           | 构建产物压缩包，非源码。                   |

## 前端模拟/静态数据清单

以下内容仍是模拟数据、静态数据或占位交互。本轮只记录，不改造为真实接口。

| 位置                                               | 当前状态                                                                                                 | 建议后续接口方向                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `src/modules/agent-center/mock.ts`                 | 智能体、技能、分类、权限状态全部来自静态 mock。                                                          | 建议提供智能体目录、技能目录、权限状态、收藏状态接口。     |
| `src/modules/agent-center/index.vue`               | Token 排名、趋势、分布、日期筛选、类别筛选、更多排行为静态展示或 toast 占位。                            | 建议接入智能体 Token 用量、趋势、分布、筛选条件接口。      |
| `src/modules/leader-board/index.vue`               | 部门/应用 Token 数据、统计卡、趋势图、实时数字增长均为前端写死；筛选、对比、导出、详情按钮未接真实行为。 | 建议提供看板总览、部门排行、应用排行、趋势、导出任务接口。 |
| `src/modules/home/dashboard/CalendarWorkspace.vue` | 2026 年节假日和节气硬编码在前端。                                                                        | 建议后端按年份返回节假日、调休、节气日历数据。             |

已完成真实接口接入：`src/modules/home/DashboardPage.vue` 的邮箱类型确认现在调用 `POST /smart-todo/select-email`，成功后才更新本地用户状态。
