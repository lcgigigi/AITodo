<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useFeedbackStore } from '@/stores/feedback.store'

const feedbackStore = useFeedbackStore()
const { currentToast } = storeToRefs(feedbackStore)

function dismiss() {
  feedbackStore.dismissToast()
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="currentToast"
      class="st-toast"
      :class="`is-${currentToast.type}`"
      role="status"
      @click="dismiss"
    >
      {{ currentToast.message }}
    </div>
  </Teleport>
</template>
