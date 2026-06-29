<script setup lang="ts">
import {
  dashboardTools,
  type DashboardTool,
  type DashboardToolTarget,
} from '@/modules/home/dashboard/dashboardTools'

defineOptions({
  name: 'TopbarToolDock',
})

const emit = defineEmits<{
  select: [payload: DashboardToolTarget]
}>()

function selectTool(tool: DashboardTool) {
  emit('select', {
    routeName: tool.routeName,
    agentKey: tool.agentKey,
    externalUrl: tool.externalUrl,
    isMore: tool.isMore,
  })
}
</script>

<template>
  <nav class="tool-dock" aria-label="AI工具">
    <button
      v-for="tool in dashboardTools"
      :key="tool.name"
      class="tool-dock-item"
      :class="`tone-${tool.tone}`"
      type="button"
      @click="selectTool(tool)"
    >
      <span class="tool-dock-icon" aria-hidden="true">
        <component :is="tool.icon" />
      </span>
      <span>{{ tool.name }}</span>
    </button>
  </nav>
</template>

<style scoped>
.tool-dock {
  justify-self: center;
  min-width: 0;
  max-width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  overflow: hidden;
}

.tool-dock-item {
  min-width: 0;
  height: 34px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #293756;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font: inherit;
  font-size: 13px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.tool-dock-item:hover,
.tool-dock-item:focus-visible {
  background: rgba(255, 255, 255, 0.58);
  color: #0f172a;
  transform: translateY(-1px);
  outline: none;
}

.tool-dock-icon {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.34);
}

.tool-dock-icon svg {
  width: 14px;
  height: 14px;
}

.tone-orange .tool-dock-icon {
  background: #ffe5d7;
  color: #ff7a3d;
}

.tone-blue .tool-dock-icon {
  background: #dbeafe;
  color: #2f7cff;
}

.tone-green .tool-dock-icon {
  background: #d9f8e7;
  color: #20bb77;
}

.tone-violet .tool-dock-icon,
.tone-purple .tool-dock-icon {
  background: #eadfff;
  color: #8b5cf6;
}

.tone-cyan .tool-dock-icon {
  background: #d7f7ff;
  color: #09b6d7;
}

.tone-sky .tool-dock-icon {
  background: #dff3ff;
  color: #26a4e8;
}

.tone-slate .tool-dock-icon {
  background: #e7edf5;
  color: #70819a;
}

@media (max-width: 1280px) {
  .tool-dock {
    justify-content: flex-start;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .tool-dock::-webkit-scrollbar {
    display: none;
  }
}

@media (max-width: 900px) {
  .tool-dock {
    display: none;
  }
}
</style>
