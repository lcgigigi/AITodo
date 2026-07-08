<template>
  <RouterView />
  <DesktopAuthConfirmDialog />
  <GlobalFeedback />
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import DesktopAuthConfirmDialog from '@/modules/auth/DesktopAuthConfirmDialog.vue'
import GlobalFeedback from '@/shared/components/feedback/GlobalFeedback.vue'
</script>
