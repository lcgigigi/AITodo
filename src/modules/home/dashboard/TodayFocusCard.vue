<script setup lang="ts">
defineProps<{
  selectedToolName: string
  eventCount: number
  doneCount: number
}>()
</script>

<template>
  <section class="focus-card">
    <div>
      <p>今日专注</p>
      <h2>{{ eventCount > doneCount ? '保持推进节奏' : '节奏稳定' }}</h2>
    </div>
    <div class="focus-metrics">
      <span><strong>{{ eventCount }}</strong>项安排</span>
      <span><strong>{{ doneCount }}</strong>项完成</span>
    </div>
    <div class="suggestion">
      <span>推荐入口</span>
      <strong>{{ selectedToolName }}</strong>
    </div>
  </section>
</template>

<style scoped>
.focus-card {
  padding: 16px;
  border-radius: 16px;
  background: #111827;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 18px 32px -26px rgba(17, 24, 39, 0.5);
}

p {
  margin: 0 0 6px;
  color: rgba(255, 255, 255, 0.62);
  font-size: 12px;
  font-weight: 800;
}

h2 {
  margin: 0;
  font-size: 18px;
  line-height: 1.25;
}

.focus-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.focus-metrics span,
.suggestion {
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  padding: 10px;
}

.focus-metrics span {
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
}

.focus-metrics strong {
  display: block;
  color: #ffffff;
  font-size: 22px;
  line-height: 1;
  margin-bottom: 4px;
}

.suggestion {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
}

.suggestion strong {
  color: #ffffff;
  font-size: 13px;
}
</style>
