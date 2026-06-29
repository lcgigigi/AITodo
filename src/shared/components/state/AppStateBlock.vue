<script setup lang="ts">
import type { Component, HTMLAttributes } from 'vue'
import { computed } from 'vue'
import IconAlertCircle from '~icons/lucide/circle-alert'
import IconInbox from '~icons/lucide/inbox'
import IconLoaderCircle from '~icons/lucide/loader-circle'
import IconRefreshCw from '~icons/lucide/refresh-cw'
import IconSparkles from '~icons/lucide/sparkles'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type AppStateBlockType = 'loading' | 'empty' | 'error' | 'info'
export type AppStateBlockSize = 'sm' | 'md' | 'lg'
export type AppStateBlockVariant = 'panel' | 'inline' | 'overlay'

const stateMeta: Record<
  AppStateBlockType,
  {
    title: string
    description: string
    icon: Component
  }
> = {
  loading: {
    title: '正在加载数据',
    description: '数据同步后会自动刷新。',
    icon: IconLoaderCircle,
  },
  empty: {
    title: '暂无数据',
    description: '调整筛选条件或稍后再看。',
    icon: IconInbox,
  },
  error: {
    title: '数据加载失败',
    description: '服务暂时不可用，请稍后重试。',
    icon: IconAlertCircle,
  },
  info: {
    title: '暂无内容',
    description: '这里会展示后续产生的数据。',
    icon: IconSparkles,
  },
}

const props = withDefaults(
  defineProps<{
    type?: AppStateBlockType
    title?: string
    description?: string
    actionLabel?: string
    size?: AppStateBlockSize
    variant?: AppStateBlockVariant
    icon?: Component
    class?: HTMLAttributes['class']
  }>(),
  {
    type: 'empty',
    size: 'md',
    variant: 'panel',
  },
)

const emit = defineEmits<{
  action: []
}>()

const currentMeta = computed(() => stateMeta[props.type])
const stateIcon = computed(() => props.icon ?? currentMeta.value.icon)
const stateTitle = computed(() => props.title || currentMeta.value.title)
const stateDescription = computed(() => props.description || currentMeta.value.description)
const rootClass = computed(() =>
  cn('app-state-block', `is-${props.type}`, `is-${props.size}`, `is-${props.variant}`, props.class),
)
const role = computed(() => (props.type === 'error' ? 'alert' : 'status'))
const ariaLive = 'polite' as const
</script>

<template>
  <article :class="rootClass" :role="role" :aria-live="ariaLive">
    <span class="app-state-block__icon" aria-hidden="true">
      <slot name="icon">
        <component :is="stateIcon" />
      </slot>
    </span>

    <div class="app-state-block__copy">
      <h3>{{ stateTitle }}</h3>
      <p v-if="stateDescription">{{ stateDescription }}</p>
      <slot />
    </div>

    <div v-if="actionLabel || $slots.action" class="app-state-block__actions">
      <slot name="action">
        <Button type="button" size="sm" variant="outline" @click="emit('action')">
          <IconRefreshCw v-if="type === 'error'" aria-hidden="true" />
          {{ actionLabel }}
        </Button>
      </slot>
    </div>
  </article>
</template>

<style scoped>
.app-state-block {
  --state-accent: #2f7fff;
  --state-soft: rgba(47, 127, 255, 0.1);
  --state-border: rgba(190, 207, 232, 0.72);
  --state-ink: #172033;
  --state-muted: #6d7f9d;

  position: relative;
  box-sizing: border-box;
  display: grid;
  justify-items: center;
  gap: 12px;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--state-border);
  border-radius: 18px;
  background: radial-gradient(
      circle at 18% 12%,
      color-mix(in srgb, var(--state-accent) 10%, transparent),
      transparent 34%
    ),
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(248, 251, 255, 0.84));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.88),
    0 16px 36px rgba(56, 91, 147, 0.08);
  color: var(--state-ink);
  text-align: center;
}

.app-state-block::after {
  position: absolute;
  right: -34px;
  bottom: -42px;
  width: 108px;
  height: 108px;
  border-radius: 50%;
  background: var(--state-soft);
  content: '';
  pointer-events: none;
}

.app-state-block.is-error {
  --state-accent: #ef4444;
  --state-soft: rgba(239, 68, 68, 0.1);
  --state-border: rgba(248, 188, 188, 0.86);
}

.app-state-block.is-empty {
  --state-accent: #6d86b2;
  --state-soft: rgba(109, 134, 178, 0.1);
}

.app-state-block.is-info {
  --state-accent: #7c6df2;
  --state-soft: rgba(124, 109, 242, 0.1);
}

.app-state-block.is-sm {
  min-height: 104px;
  padding: 16px 18px;
  gap: 8px;
  border-radius: 14px;
}

.app-state-block.is-md {
  min-height: 164px;
  padding: 26px 28px;
}

.app-state-block.is-lg {
  min-height: 240px;
  padding: 34px 38px;
}

.app-state-block.is-inline {
  border-style: dashed;
  background: radial-gradient(
      circle at 16% 20%,
      color-mix(in srgb, var(--state-accent) 8%, transparent),
      transparent 35%
    ),
    rgba(248, 250, 252, 0.64);
  box-shadow: none;
}

.app-state-block.is-overlay {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: radial-gradient(
      circle at 18% 16%,
      color-mix(in srgb, var(--state-accent) 11%, transparent),
      transparent 34%
    ),
    rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(8px) saturate(120%);
}

.app-state-block__icon {
  position: relative;
  z-index: 1;
  display: inline-grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 14px;
  color: var(--state-accent);
  background: color-mix(in srgb, var(--state-accent) 12%, #ffffff);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 10px 24px color-mix(in srgb, var(--state-accent) 16%, transparent);
}

.app-state-block.is-sm .app-state-block__icon {
  width: 34px;
  height: 34px;
  border-radius: 12px;
}

.app-state-block.is-lg .app-state-block__icon {
  width: 54px;
  height: 54px;
  border-radius: 18px;
}

.app-state-block__icon svg {
  width: 20px;
  height: 20px;
  stroke-width: 2.4;
}

.app-state-block.is-sm .app-state-block__icon svg {
  width: 17px;
  height: 17px;
}

.app-state-block.is-lg .app-state-block__icon svg {
  width: 25px;
  height: 25px;
}

.app-state-block.is-loading .app-state-block__icon svg {
  animation: state-spin 1.05s linear infinite;
}

.app-state-block__copy {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 6px;
  max-width: 420px;
}

.app-state-block__copy h3 {
  margin: 0;
  color: var(--state-ink);
  font-size: 16px;
  font-weight: 900;
  line-height: 1.25;
}

.app-state-block.is-sm .app-state-block__copy h3 {
  font-size: 13px;
}

.app-state-block.is-lg .app-state-block__copy h3 {
  font-size: 20px;
}

.app-state-block__copy p {
  margin: 0;
  color: var(--state-muted);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.55;
}

.app-state-block.is-sm .app-state-block__copy p {
  font-size: 12px;
  line-height: 1.45;
}

.app-state-block.is-lg .app-state-block__copy p {
  font-size: 14px;
}

.app-state-block__actions {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.app-state-block__actions svg {
  width: 14px;
  height: 14px;
}

@media (prefers-reduced-motion: reduce) {
  .app-state-block.is-loading .app-state-block__icon svg {
    animation: none;
  }
}

@keyframes state-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
