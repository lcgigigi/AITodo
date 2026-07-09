<script setup lang="ts">
import {
  homePanelTools,
  type DashboardTool,
  type DashboardToolTarget,
  toDashboardToolTarget,
} from '@/modules/home/dashboard/config/dashboardTools'

defineOptions({
  name: 'HomePanelToolDock',
})

const emit = defineEmits<{
  select: [payload: DashboardToolTarget]
}>()

function selectTool(tool: DashboardTool) {
  emit('select', toDashboardToolTarget(tool))
}
</script>

<template>
  <nav class="home-panel-tool-dock" aria-label="AI 工具">
    <button
      v-for="tool in homePanelTools"
      :key="tool.id"
      class="home-panel-tool-item"
      :class="`tone-${tool.tone}`"
      type="button"
      @click="selectTool(tool)"
    >
      <span class="home-panel-tool-icon" :class="{ 'has-image': tool.iconSrc }" aria-hidden="true">
        <img v-if="tool.iconSrc" :src="tool.iconSrc" alt="" class="home-panel-tool-icon-image" />
        <component v-else-if="tool.icon" :is="tool.icon" />
      </span>
      <span class="home-panel-tool-label">{{ tool.name }}</span>
    </button>
  </nav>
</template>

<style scoped>
.home-panel-tool-dock {
  flex: 0 0 auto;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.62);
  min-height: 52px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.82);
}

.home-panel-tool-item {
  min-width: 0;
  flex: 1 1 0;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #293756;
  padding: 4px 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font: inherit;
  font-size: 12px;
  font-weight: 850;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.18s ease,
    transform 0.18s ease;
}

.home-panel-tool-item:hover,
.home-panel-tool-item:focus-visible {
  background: rgba(255, 255, 255, 0.72);
  transform: translateY(-1px);
  outline: none;
}

.home-panel-tool-icon {
  width: 28px;
  height: 28px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.34);
}

.home-panel-tool-icon.has-image {
  background: transparent;
  box-shadow: none;
}

.home-panel-tool-icon-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: inherit;
}

.home-panel-tool-icon svg {
  width: 14px;
  height: 14px;
}

.home-panel-tool-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.tone-orange .home-panel-tool-icon {
  background: #ffe5d7;
  color: #ff7a3d;
}

.tone-blue .home-panel-tool-icon {
  background: #dbeafe;
  color: #2f7cff;
}

.tone-green .home-panel-tool-icon {
  background: #d9f8e7;
  color: #20bb77;
}

.tone-violet .home-panel-tool-icon,
.tone-purple .home-panel-tool-icon {
  background: #eadfff;
  color: #8b5cf6;
}

.tone-cyan .home-panel-tool-icon {
  background: #d7f7ff;
  color: #09b6d7;
}

.tone-sky .home-panel-tool-icon {
  background: #dff3ff;
  color: #26a4e8;
}

.tone-slate .home-panel-tool-icon {
  background: #e7edf5;
  color: #70819a;
}

@media (max-width: 760px) {
  .home-panel-tool-dock {
    overflow-x: auto;
    justify-content: flex-start;
    scrollbar-width: none;
  }

  .home-panel-tool-dock::-webkit-scrollbar {
    display: none;
  }

  .home-panel-tool-item {
    flex: 0 0 auto;
    padding: 4px 8px;
  }
}
</style>
