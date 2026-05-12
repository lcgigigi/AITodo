<template>
  <article class="app-card" :class="{ 'app-card--interactive': interactive }">
    <header v-if="title || description || $slots.extra" class="app-card__header">
      <div>
        <h2 v-if="title" class="app-card__title">{{ title }}</h2>
        <p v-if="description" class="app-card__description">{{ description }}</p>
      </div>
      <slot name="extra" />
    </header>
    <slot />
  </article>
</template>

<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
  interactive?: boolean
}>()
</script>

<style scoped>
.app-card {
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-card-bg);
  box-shadow: var(--app-shadow-soft);
  backdrop-filter: blur(18px);
}

.app-card--interactive {
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.app-card--interactive:hover {
  transform: translateY(-2px);
  border-color: rgba(79, 124, 255, 0.26);
  box-shadow: 0 22px 48px rgba(42, 70, 140, 0.12);
}

.app-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 16px;
}

.app-card__title {
  margin: 0;
  color: var(--app-text-primary);
  font-size: 17px;
  line-height: 1.35;
}

.app-card__description {
  margin: 6px 0 0;
  color: var(--app-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}
</style>
