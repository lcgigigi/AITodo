<template>
  <div class="app-loading" role="status" aria-live="polite">
    <n-spin size="small" />
    <span>{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    text?: string
  }>(),
  {
    text: '加载中',
  },
)
</script>

<style scoped>
.app-loading {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--app-text-secondary);
  font-size: 14px;
}
</style>
