<script setup lang="ts">
import AppRive from '@/shared/components/animation/AppRive.vue'

defineOptions({
  name: 'AiParseStatus',
})

const aiParsingRiveSrc = '/animations/ai-parsing.riv'
const aiParsingSteps = ['识别日期', '整理时间', '提取事项']
</script>

<template>
  <div
    class="ai-parse-status"
    role="status"
    aria-live="polite"
    aria-labelledby="ai-parse-status-title"
  >
    <div class="ai-rive-stage" aria-hidden="true">
      <AppRive class="ai-rive-player" :src="aiParsingRiveSrc">
        <template #fallback>
          <div class="ai-rive-fallback">
            <span class="ai-orbit-ring"></span>
            <span class="ai-orbit-dot is-one"></span>
            <span class="ai-orbit-dot is-two"></span>
            <span class="ai-orbit-dot is-three"></span>
            <span class="ai-note-card is-front"></span>
            <span class="ai-note-card is-back"></span>
          </div>
        </template>
      </AppRive>
    </div>
    <div class="ai-status-copy">
      <div class="ai-status-heading">
        <strong id="ai-parse-status-title">正在解析待办内容</strong>
        <span>智能整理中</span>
      </div>
      <p>正在识别时间、地点和事项，稍后自动填入表单。</p>
      <div class="ai-status-steps" aria-hidden="true">
        <span
          v-for="(step, index) in aiParsingSteps"
          :key="step"
          :style="{ '--step-index': index }"
        >
          <i></i>
          {{ step }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-parse-status {
  position: absolute;
  z-index: 7;
  top: calc(100% + 10px);
  left: 0;
  right: 0;
  box-sizing: border-box;
  min-height: 104px;
  border: 1px solid rgba(147, 197, 253, 0.6);
  border-radius: 18px;
  background: radial-gradient(circle at 82% 20%, rgba(219, 234, 254, 0.76), transparent 34%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(239, 246, 255, 0.92)), #ffffff;
  color: #334155;
  box-shadow:
    0 22px 42px -34px rgba(var(--todo-primary-rgb), 0.55),
    0 13px 26px -24px rgba(15, 23, 42, 0.18);
  padding: 14px 18px;
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  pointer-events: none;
  backdrop-filter: blur(3px);
}

.ai-rive-stage {
  width: 68px;
  height: 68px;
  border-radius: 22px;
  background: radial-gradient(circle at 66% 24%, rgba(255, 255, 255, 0.98), transparent 28%),
    linear-gradient(135deg, rgba(239, 246, 255, 0.96), rgba(219, 234, 254, 0.78));
  box-shadow:
    inset 0 0 0 1px rgba(191, 219, 254, 0.88),
    0 14px 22px -20px rgba(var(--todo-primary-rgb), 0.58);
  overflow: hidden;
}

.ai-rive-player {
  width: 100%;
  height: 100%;
}

.ai-rive-fallback {
  position: relative;
  width: 100%;
  height: 100%;
}

.ai-orbit-ring {
  position: absolute;
  inset: 13px;
  border: 1px dashed rgba(96, 165, 250, 0.55);
  border-radius: 18px;
  animation: ai-rive-orbit 2.8s linear infinite;
}

.ai-orbit-dot {
  position: absolute;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #60a5fa;
  box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.13);
  animation: ai-orbit-dot 1.18s ease-in-out infinite;
}

.ai-orbit-dot.is-one {
  top: 17px;
  left: 17px;
}

.ai-orbit-dot.is-two {
  top: 17px;
  right: 17px;
  animation-delay: 0.16s;
}

.ai-orbit-dot.is-three {
  right: 20px;
  bottom: 17px;
  animation-delay: 0.32s;
}

.ai-note-card {
  position: absolute;
  left: 24px;
  top: 28px;
  width: 24px;
  height: 18px;
  border-radius: 7px;
  background: #ffffff;
  box-shadow:
    inset 0 0 0 1px rgba(147, 197, 253, 0.58),
    0 8px 14px -12px rgba(37, 99, 235, 0.48);
}

.ai-note-card::before,
.ai-note-card::after {
  content: '';
  position: absolute;
  left: 6px;
  right: 6px;
  height: 2px;
  border-radius: 999px;
  background: rgba(96, 165, 250, 0.52);
}

.ai-note-card::before {
  top: 6px;
}

.ai-note-card::after {
  top: 11px;
}

.ai-note-card.is-front {
  animation: ai-note-sort 1.8s ease-in-out infinite;
}

.ai-note-card.is-back {
  top: 22px;
  left: 20px;
  opacity: 0.72;
  transform: rotate(-8deg);
  animation: ai-note-back 1.8s ease-in-out infinite;
}

.ai-status-copy {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.ai-status-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

.ai-status-heading strong {
  display: block;
  color: #1e293b;
  font-size: 14px;
  font-weight: 900;
  line-height: 1.35;
}

.ai-status-heading span {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  border-radius: 999px;
  background: rgba(219, 234, 254, 0.88);
  color: #2563eb;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 900;
}

.ai-parse-status p {
  margin: 0;
  color: #475569;
  font-size: 12px;
  line-height: 1.45;
}

.ai-status-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
}

.ai-status-steps span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 23px;
  border: 1px solid rgba(191, 219, 254, 0.9);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  color: #64748b;
  padding: 0 9px;
  font-size: 11px;
  font-weight: 850;
  animation: ai-step-pulse 1.72s ease-in-out infinite;
  animation-delay: calc(var(--step-index) * 0.16s);
}

.ai-status-steps i {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: #60a5fa;
}

:global(.ai-parse-status-enter-active),
:global(.ai-parse-status-leave-active) {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

:global(.ai-parse-status-enter-from),
:global(.ai-parse-status-leave-to) {
  opacity: 0;
  transform: translateY(-5px);
}

@keyframes ai-rive-orbit {
  to {
    transform: rotate(360deg);
  }
}

@keyframes ai-orbit-dot {
  0%,
  100% {
    transform: translateY(0) scale(0.88);
    opacity: 0.58;
  }
  42% {
    transform: translateY(-3px) scale(1);
    opacity: 1;
  }
}

@keyframes ai-note-sort {
  0%,
  100% {
    transform: translate(0, 0) rotate(2deg);
  }
  48% {
    transform: translate(6px, -5px) rotate(9deg);
  }
}

@keyframes ai-note-back {
  0%,
  100% {
    transform: translate(0, 0) rotate(-8deg);
  }
  48% {
    transform: translate(-4px, 4px) rotate(-13deg);
  }
}

@keyframes ai-step-pulse {
  0%,
  100% {
    border-color: rgba(191, 219, 254, 0.9);
    color: #64748b;
    transform: translateY(0);
  }
  46% {
    border-color: rgba(96, 165, 250, 0.58);
    color: #2563eb;
    transform: translateY(-1px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ai-rive-fallback *,
  .ai-status-steps span {
    animation: none;
  }
}

@media (max-width: 760px) {
  .ai-parse-status {
    grid-template-columns: 58px minmax(0, 1fr);
    gap: 12px;
    padding: 12px;
  }

  .ai-rive-stage {
    width: 58px;
    height: 58px;
    border-radius: 19px;
  }
}
</style>
