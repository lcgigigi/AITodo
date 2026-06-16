<script setup lang="ts">
import type { AiToolEntry } from './types'

defineProps<{
  tools: AiToolEntry[]
  selectedToolId: string
}>()

const emit = defineEmits<{
  select: [id: string]
}>()
</script>

<template>
  <section class="tool-dock">
    <header class="dock-head">
      <p>能力入口</p>
      <h2>AI 工具箱</h2>
    </header>

    <div class="tool-grid">
      <button
        v-for="tool in tools"
        :key="tool.id"
        class="tool-card"
        :class="[`tone-${tool.tone}`, { active: tool.id === selectedToolId }]"
        type="button"
        @click="emit('select', tool.id)"
      >
        <span class="tool-icon">{{ tool.icon }}</span>
        <span class="tool-copy">
          <strong>{{ tool.name }}</strong>
          <span>{{ tool.desc }}</span>
        </span>
        <span class="tool-meta">{{ tool.meta }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.tool-dock {
  padding: 18px;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 14px 34px -26px rgba(15, 23, 42, 0.32);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dock-head p {
  margin: 0 0 6px;
  color: #6b7280;
  font-size: 12px;
  font-weight: 800;
}

.dock-head h2 {
  margin: 0;
  color: #111827;
  font-size: 20px;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.tool-card {
  min-width: 0;
  min-height: 96px;
  border: 1px solid #eef2f7;
  border-radius: 14px;
  background: #f8fafc;
  padding: 12px;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  grid-template-rows: 1fr auto;
  gap: 8px 10px;
  text-align: left;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.tool-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-top: 4px solid currentColor;
  opacity: 0.8;
}

.tool-card:hover,
.tool-card.active {
  transform: translateY(-2px);
  border-color: currentColor;
  box-shadow: 0 18px 28px -24px currentColor;
}

.tool-icon {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  position: relative;
  z-index: 1;
}

.tool-copy {
  min-width: 0;
  position: relative;
  z-index: 1;
}

.tool-copy strong {
  display: block;
  color: #111827;
  font-size: 14px;
  line-height: 1.25;
}

.tool-copy span {
  display: block;
  margin-top: 4px;
  color: #6b7280;
  font-size: 11px;
  line-height: 1.35;
}

.tool-meta {
  grid-column: 1 / -1;
  width: fit-content;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
  color: currentColor;
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 800;
  position: relative;
  z-index: 1;
}

.tone-blue {
  color: #2563eb;
  background: #eff6ff;
}
.tone-green {
  color: #059669;
  background: #ecfdf5;
}
.tone-violet {
  color: #7c3aed;
  background: #f5f3ff;
}
.tone-amber {
  color: #d97706;
  background: #fffbeb;
}
.tone-rose {
  color: #e11d48;
  background: #fff1f2;
}

@media (max-width: 760px) {
  .tool-grid {
    grid-template-columns: 1fr;
  }
}
</style>
