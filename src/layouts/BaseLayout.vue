<template>
  <div class="base-layout">
    <RouterView />
  </div>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<style scoped>
.base-layout {
  min-height: 100vh;
  background: var(--app-bg);
}
</style>
