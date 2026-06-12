<template>
  <RouterView />
  <GlobalFeedback />
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import GlobalFeedback from '@/shared/components/feedback/GlobalFeedback.vue'
</script>
