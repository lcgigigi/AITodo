<template>
  <div class="app-empty">
    <div class="app-empty__icon">
      <i-carbon-document-blank />
    </div>
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
import ICarbonDocumentBlank from '~icons/carbon/document-blank'

withDefaults(
  defineProps<{
    title?: string
    description?: string
  }>(),
  {
    title: '暂无内容',
    description: '当前模块已预留，后续可以继续接入业务页面或接口数据。',
  },
)
</script>

<style scoped>
.app-empty {
  display: grid;
  place-items: center;
  min-height: 360px;
  padding: 32px;
  text-align: center;
  color: var(--app-text-secondary);
}

.app-empty__icon {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  margin-bottom: 16px;
  border-radius: 8px;
  color: var(--app-primary);
  background: rgba(79, 124, 255, 0.1);
  font-size: 30px;
}

.app-empty h2 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: 18px;
}

.app-empty p {
  max-width: 420px;
  margin: 8px 0 0;
  line-height: 1.7;
}
</style>
