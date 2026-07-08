<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Component } from 'vue'
import IconCircleAlert from '~icons/lucide/circle-alert'
import IconCircleCheck from '~icons/lucide/circle-check'
import IconInfo from '~icons/lucide/info'
import IconTriangleAlert from '~icons/lucide/triangle-alert'
import IconX from '~icons/lucide/x'
import { Button } from '@/components/ui/button'
import type { FeedbackType } from '@/stores/feedback.store'
import { useFeedbackStore } from '@/stores/feedback.store'

const feedbackStore = useFeedbackStore()
const { currentToast } = storeToRefs(feedbackStore)

const toastMeta: Record<FeedbackType, { icon: Component }> = {
  success: {
    icon: IconCircleCheck,
  },
  error: {
    icon: IconCircleAlert,
  },
  warning: {
    icon: IconTriangleAlert,
  },
  info: {
    icon: IconInfo,
  },
}
</script>

<template>
  <Teleport to="body">
    <div class="global-feedback">
      <div class="global-toast-region" aria-live="polite" aria-relevant="additions text">
        <Transition name="global-toast" mode="out-in">
          <article
            v-if="currentToast"
            :key="currentToast.id"
            class="global-toast"
            :class="`is-${currentToast.type}`"
            :role="currentToast.type === 'error' ? 'alert' : 'status'"
            @mouseenter="feedbackStore.pauseToastTimer()"
            @mouseleave="feedbackStore.resumeToastTimer()"
          >
            <span class="global-toast__icon" aria-hidden="true">
              <component :is="toastMeta[currentToast.type].icon" />
            </span>
            <span class="global-toast__content">
              <span class="global-toast__message">{{ currentToast.message }}</span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              class="global-toast__close"
              aria-label="关闭提示"
              @click="feedbackStore.dismissToast(currentToast.id)"
            >
              <IconX />
            </Button>
            <span class="global-toast__progress" aria-hidden="true" />
          </article>
        </Transition>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.global-feedback {
  pointer-events: none;
}

.global-toast-region {
  position: fixed;
  z-index: 2100;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(500px, calc(100vw - 32px));
  gap: 10px;
  pointer-events: none;
}

.global-toast {
  --toast-accent: #0ea5e9;
  --toast-glow: color-mix(in srgb, var(--toast-accent) 30%, transparent);

  position: relative;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  width: max-content;
  max-width: 100%;
  overflow: hidden;
  border: none;
  border-radius: 16px;
  padding: 12px 14px 12px 16px;
  color: var(--app-text-primary);
  background: color-mix(in srgb, var(--app-card-bg, #ffffff) 85%, transparent);
  backdrop-filter: blur(16px) saturate(140%);
  box-shadow:
    0 8px 24px -6px rgba(0, 0, 0, 0.08),
    0 0 16px -6px var(--toast-glow),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.15);
  pointer-events: auto;
}

@media (prefers-color-scheme: dark) {
  .global-toast {
    box-shadow:
      0 8px 24px -6px rgba(0, 0, 0, 0.3),
      0 0 16px -6px var(--toast-glow),
      inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
  }
}

.global-toast__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--toast-accent);
  background: color-mix(in srgb, var(--toast-accent) 15%, transparent);
  border-radius: 8px;
  box-shadow: inset 0 0 6px color-mix(in srgb, var(--toast-accent) 20%, transparent);
  animation: toast-icon-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.2) forwards;
}

.global-toast__icon svg {
  width: 18px;
  height: 18px;
  filter: drop-shadow(0 0 3px var(--toast-glow));
}

.global-toast__content {
  display: flex;
  flex-direction: row; /* 水平排列，大大降低高度 */
  align-items: center;
  flex-wrap: wrap; /* 允许超长文本换行 */
  gap: 8px;
  min-width: 0;
}

.global-toast__message {
  color: var(--app-text-primary);
  font-size: 15px;
  font-weight: 500;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.global-toast__close {
  color: var(--app-text-tertiary);
  pointer-events: auto;
  border-radius: 6px;
  padding: 4px;
  margin-left: 4px;
  height: auto;
  transition: all 0.2s ease;
}

.global-toast__close:hover {
  color: var(--toast-accent);
  background: color-mix(in srgb, var(--toast-accent) 12%, transparent);
  transform: scale(1.1);
}

.global-toast__close svg {
  width: 16px;
  height: 16px;
}

.global-toast__progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--toast-accent) 35%,
    color-mix(in srgb, var(--toast-accent) 80%, #fff) 50%,
    var(--toast-accent) 65%,
    transparent 100%
  );
  animation: global-toast-breathe 2.4s ease-in-out infinite;
}

.global-toast.is-info {
  --toast-accent: #0ea5e9;
}

.global-toast.is-success {
  --toast-accent: #10b981;
}

.global-toast.is-error {
  --toast-accent: #f43f5e;
}

.global-toast.is-warning {
  --toast-accent: #f59e0b;
}

.global-toast-enter-active,
.global-toast-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.global-toast-enter-from {
  opacity: 0;
  transform: translateY(-24px) scale(0.9);
}

.global-toast-leave-to {
  opacity: 0;
  transform: translateY(-16px) scale(0.95);
}

@keyframes global-toast-breathe {
  0%,
  100% {
    opacity: 0.35;
    box-shadow: 0 0 4px 0 var(--toast-glow);
  }
  50% {
    opacity: 1;
    box-shadow: 0 0 12px 2px var(--toast-glow);
  }
}

@keyframes toast-icon-pop {
  0% {
    transform: scale(0.5) rotate(-15deg);
    opacity: 0;
  }
  50% {
    transform: scale(1.15) rotate(5deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
}

@media (max-width: 640px) {
  .global-toast-region {
    top: 16px;
    width: calc(100vw - 32px);
  }
  .global-toast {
    width: 100%; /* 移动端占满屏幕宽度更好 */
  }
}

@media (prefers-reduced-motion: reduce) {
  .global-toast__progress,
  .global-toast__icon {
    animation: none;
  }

  .global-toast-enter-active,
  .global-toast-leave-active {
    transition: none;
  }
}
</style>
