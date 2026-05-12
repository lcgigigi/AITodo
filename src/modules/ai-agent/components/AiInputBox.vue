<template>
  <div class="ai-input-box">
    <n-input
      v-model:value="prompt"
      type="textarea"
      :autosize="{ minRows: 5, maxRows: 8 }"
      placeholder="例如：下周三之前完成 100 个摄像头现场调研，每天提醒我看进度。"
    />
    <div class="ai-input-box__footer">
      <n-space size="small">
        <n-tag :bordered="false">任务解析</n-tag>
        <n-tag :bordered="false">日程生成</n-tag>
        <n-tag :bordered="false">会议总结</n-tag>
      </n-space>
      <n-button type="primary" :disabled="!prompt.trim()">
        <template #icon>
          <i-carbon-send />
        </template>
        发送
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ICarbonSend from '~icons/carbon/send'

const prompt = ref('')
</script>

<style scoped>
.ai-input-box {
  display: grid;
  gap: 14px;
}

.ai-input-box__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

@media (max-width: 620px) {
  .ai-input-box__footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
