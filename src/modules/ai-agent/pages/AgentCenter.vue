<template>
  <AppPage
    eyebrow="AI Agents"
    title="智能体中心"
    description="预留一句话建任务、查日程、生成汇报、总结会议和知识库问答等能力。"
  >
    <section class="agent-layout">
      <AppCard title="快捷智能体" description="配置型智能体会在这里统一管理。">
        <div class="agent-list">
          <button v-for="agent in agents" :key="agent.code" class="agent-card" type="button">
            <span>{{ agent.name }}</span>
            <small>{{ agent.description }}</small>
          </button>
        </div>
      </AppCard>

      <AppCard title="AI 输入框" description="首期占位，后续接入流式接口和任务预览。">
        <AiInputBox />
      </AppCard>
    </section>
  </AppPage>
</template>

<script setup lang="ts">
import AppCard from '@/shared/components/app-card/AppCard.vue'
import AppPage from '@/shared/components/app-page/AppPage.vue'
import AiInputBox from '../components/AiInputBox.vue'
import type { AiAgent } from '../types/agent.types'

const agents: AiAgent[] = [
  {
    id: 'task-agent',
    name: '任务助手',
    code: 'task-agent',
    description: '一句话创建待办并拆解步骤',
    enabled: true,
  },
  {
    id: 'schedule-agent',
    name: '日程助手',
    code: 'schedule-agent',
    description: '查询日程、生成提醒和会议安排',
    enabled: true,
  },
  {
    id: 'doc-agent',
    name: '文档助手',
    code: 'doc-agent',
    description: '总结文档、生成汇报和沉淀知识',
    enabled: false,
  },
]
</script>

<style scoped>
.agent-layout {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 18px;
}

.agent-list {
  display: grid;
  gap: 12px;
}

.agent-card {
  display: grid;
  gap: 6px;
  width: 100%;
  padding: 14px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  color: var(--app-text-primary);
  background: rgba(255, 255, 255, 0.56);
  text-align: left;
  cursor: pointer;
}

.agent-card span {
  font-weight: 700;
}

.agent-card small {
  color: var(--app-text-secondary);
  line-height: 1.6;
}

@media (max-width: 980px) {
  .agent-layout {
    grid-template-columns: 1fr;
  }
}
</style>
