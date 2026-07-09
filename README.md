# AITodo

基于 Vue 3、TypeScript、Vite、Pinia、Vue Router、Tailwind CSS、Reka UI 和 ECharts
构建的智能待办前端。

## 功能模块

- 登录与桌面端授权确认
- 首页待办日历（简约模式、详细模式）
- 待办创建、编辑、状态流转与通知
- 建议收件箱
- 智能体中心
- Token 用量排行榜

## 本地开发

项目统一使用 pnpm 8：

```bash
corepack enable
pnpm install
pnpm dev
```

## 质量检查

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

开发代理目标和环境变量说明见 `docs/current-backend-connection.md`。`VITE_*` 变量会被编译到
浏览器端，不能用于保存真正的生产密钥。
