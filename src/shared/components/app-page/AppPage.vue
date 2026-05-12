<template>
  <section class="app-page">
    <header v-if="title || description || $slots.actions" class="app-page__header">
      <div>
        <p v-if="eyebrow" class="app-page__eyebrow">{{ eyebrow }}</p>
        <h1 v-if="title" class="app-page__title">{{ title }}</h1>
        <p v-if="description" class="app-page__description">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="app-page__actions">
        <slot name="actions" />
      </div>
    </header>

    <slot />
  </section>
</template>

<script setup lang="ts">
defineProps<{
  eyebrow?: string
  title?: string
  description?: string
}>()
</script>

<style scoped>
.app-page {
  display: grid;
  gap: 18px;
}

.app-page__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.app-page__eyebrow {
  margin: 0 0 8px;
  color: var(--app-primary);
  font-size: 13px;
  font-weight: 700;
}

.app-page__title {
  margin: 0;
  color: var(--app-text-primary);
  font-size: 30px;
  line-height: 1.2;
  letter-spacing: 0;
}

.app-page__description {
  max-width: 720px;
  margin: 10px 0 0;
  color: var(--app-text-secondary);
  font-size: 15px;
  line-height: 1.7;
}

.app-page__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
}

@media (max-width: 760px) {
  .app-page__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .app-page__title {
    font-size: 24px;
  }
}
</style>
