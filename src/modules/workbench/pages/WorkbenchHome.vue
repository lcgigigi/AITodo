<template>
  <AppPage
    eyebrow="AI Workbench"
    title="工作台总览"
    description="这里承载智能代办、日程日历、AI 功能入口和后续业务总览。当前先完成平台骨架，业务页面可以按模块继续接入。"
  >
    <template #actions>
      <n-button type="primary">
        <template #icon>
          <i-carbon-add />
        </template>
        新建任务
      </n-button>
    </template>

    <section class="workbench-grid">
      <AppCard title="今日概览" description="待办、日程和 AI 任务的首屏摘要。">
        <div class="metric-list">
          <div v-for="metric in metrics" :key="metric.label" class="metric-item">
            <span>{{ metric.label }}</span>
            <strong>{{ metric.value }}</strong>
          </div>
        </div>
      </AppCard>

      <AppCard title="AI 功能入口" description="后续新增 AI 能力时优先沉淀到 modules。">
        <div class="entry-grid">
          <RouterLink
            v-for="entry in entries"
            :key="entry.path"
            class="entry-item"
            :to="entry.path"
          >
            <component :is="entry.icon" />
            <span>{{ entry.title }}</span>
          </RouterLink>
        </div>
      </AppCard>
    </section>

    <section class="workbench-grid workbench-grid--wide">
      <AppCard title="模块接入进度" description="当前项目地基已预留，后续可以直接替换占位页面。">
        <n-timeline>
          <n-timeline-item
            type="success"
            title="项目骨架"
            content="Vite、Vue3、TS、路由、Pinia、Naive UI"
          />
          <n-timeline-item
            type="info"
            title="日程模块"
            content="预留 /agenda/calendar 和模块目录"
          />
          <n-timeline-item
            type="info"
            title="智能体中心"
            content="预留 AI 输入框、类型、接口和 store"
          />
          <n-timeline-item title="业务页面接入" content="后续粘贴已有日历页面并逐步拆分组件" />
        </n-timeline>
      </AppCard>

      <AppCard title="园区 3D 工作台入口" description="先保留区域，后续接已有 3D 场景或独立路由。">
        <div class="scene-placeholder">
          <i-carbon-cube />
          <span>3D 场景预留区</span>
        </div>
      </AppCard>
    </section>
  </AppPage>
</template>

<script setup lang="ts">
import { markRaw } from 'vue'
import { RouterLink } from 'vue-router'
import AppCard from '@/shared/components/app-card/AppCard.vue'
import AppPage from '@/shared/components/app-page/AppPage.vue'
import ICarbonAdd from '~icons/carbon/add'
import ICarbonCalendar from '~icons/carbon/calendar'
import ICarbonChatBot from '~icons/carbon/chat-bot'
import ICarbonCube from '~icons/carbon/cube'
import ICarbonDocument from '~icons/carbon/document'
import ICarbonSearch from '~icons/carbon/search'

const metrics = [
  { label: '今日待办', value: '12' },
  { label: '本周日程', value: '28' },
  { label: 'AI 任务', value: '6' },
]

const entries = [
  { title: '日程日历', path: '/agenda/calendar', icon: markRaw(ICarbonCalendar) },
  { title: '智能体中心', path: '/ai-agent', icon: markRaw(ICarbonChatBot) },
  { title: '知识库', path: '/workbench', icon: markRaw(ICarbonSearch) },
  { title: '文档总结', path: '/workbench', icon: markRaw(ICarbonDocument) },
]
</script>

<style scoped>
.workbench-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 18px;
}

.workbench-grid--wide {
  grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr);
}

.metric-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.metric-item {
  min-height: 92px;
  padding: 16px;
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(79, 124, 255, 0.1), rgba(39, 192, 131, 0.08));
}

.metric-item span,
.metric-item strong {
  display: block;
}

.metric-item span {
  color: var(--app-text-secondary);
  font-size: 13px;
}

.metric-item strong {
  margin-top: 10px;
  color: var(--app-text-primary);
  font-size: 28px;
  line-height: 1;
}

.entry-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.entry-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 66px;
  padding: 14px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  color: var(--app-text-primary);
  background: rgba(255, 255, 255, 0.48);
  text-decoration: none;
}

.entry-item svg {
  color: var(--app-primary);
  font-size: 22px;
}

.scene-placeholder {
  display: grid;
  place-items: center;
  min-height: 220px;
  border: 1px dashed rgba(79, 124, 255, 0.3);
  border-radius: 8px;
  color: var(--app-text-secondary);
  background: linear-gradient(135deg, rgba(79, 124, 255, 0.08), rgba(39, 192, 131, 0.08)),
    rgba(255, 255, 255, 0.5);
}

.scene-placeholder svg {
  margin-bottom: 8px;
  color: var(--app-primary);
  font-size: 40px;
}

@media (max-width: 980px) {
  .workbench-grid,
  .workbench-grid--wide {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .metric-list,
  .entry-grid {
    grid-template-columns: 1fr;
  }
}
</style>
