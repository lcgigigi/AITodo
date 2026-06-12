<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useFeedbackStore } from '@/stores/feedback.store'

const feedbackStore = useFeedbackStore()
const { isLoading, toastMessage, toastType } = storeToRefs(feedbackStore)
</script>

<template>
  <Teleport to="body">
    <div class="global-feedback" aria-live="polite">
      <Transition name="global-loading-fade">
        <div v-if="isLoading" class="global-loading" aria-hidden="true">
          <span class="global-loading__bar" />
        </div>
      </Transition>

      <Transition name="global-toast-fade">
        <div
          v-if="toastMessage"
          class="global-toast"
          :class="`is-${toastType}`"
          role="status"
        >
          {{ toastMessage }}
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
.global-feedback {
  pointer-events: none;
}

.global-loading {
  position: fixed;
  z-index: 2000;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  overflow: hidden;
  background: rgba(148, 163, 184, 0.18);
}

.global-loading__bar {
  display: block;
  width: 36%;
  height: 100%;
  border-radius: 0 999px 999px 0;
  background: linear-gradient(90deg, #3b82f6, #60a5fa 58%, rgba(96, 165, 250, 0.2));
  box-shadow: 0 0 14px rgba(59, 130, 246, 0.42);
  animation: global-loading-slide 1.1s ease-in-out infinite;
}

.global-toast {
  position: fixed;
  z-index: 2001;
  top: 18px;
  left: 50%;
  max-width: min(560px, calc(100vw - 32px));
  min-height: 38px;
  box-sizing: border-box;
  border-radius: 999px;
  padding: 0 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 13px;
  font-weight: 850;
  line-height: 1.35;
  text-align: center;
  transform: translateX(-50%);
  box-shadow: 0 12px 28px -18px rgba(15, 23, 42, 0.55);
}

.global-toast.is-info {
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(17, 24, 39, 0.94);
}

.global-toast.is-success {
  border: 1px solid rgba(16, 185, 129, 0.24);
  background: rgba(6, 78, 59, 0.94);
}

.global-toast.is-error {
  top: 16px;
  max-width: min(420px, calc(100vw - 32px));
  min-height: 0;
  border-radius: 14px;
  padding: 10px 16px;
  white-space: normal;
  word-break: break-word;
  border: 1px solid rgba(248, 113, 113, 0.28);
  background: rgba(127, 29, 29, 0.94);
}

.global-loading-fade-enter-active,
.global-loading-fade-leave-active {
  transition: opacity 0.18s ease;
}

.global-loading-fade-enter-from,
.global-loading-fade-leave-to {
  opacity: 0;
}

.global-toast-fade-enter-active,
.global-toast-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.global-toast-fade-enter-from,
.global-toast-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -6px);
}

@keyframes global-loading-slide {
  0% {
    transform: translateX(-120%);
  }

  100% {
    transform: translateX(320%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .global-loading__bar {
    animation: none;
    width: 100%;
    border-radius: 0;
  }

  .global-loading-fade-enter-active,
  .global-loading-fade-leave-active,
  .global-toast-fade-enter-active,
  .global-toast-fade-leave-active {
    transition: none;
  }
}
</style>
