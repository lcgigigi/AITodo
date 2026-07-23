<script setup lang="ts">
import { onMounted } from 'vue'
import H5Toast from './components/H5Toast.vue'
import { useH5Auth } from './composables/useH5Auth'
import H5TodoWorkspace from './H5TodoWorkspace.vue'

const { userStore, isBootstrapping, authError, restoreSession, reauthenticate } = useH5Auth()

onMounted(() => {
  void restoreSession()
})
</script>

<template>
  <div>
    <H5Toast />

    <div v-if="isBootstrapping" class="st-app st-app--auth">
      <section class="st-auth-hero">
        <p class="st-auth-hero__brand">Smart Todo</p>
        <div class="st-boot" role="status" aria-live="polite">
          <span class="st-boot__mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>正在整理你的日程</span>
        </div>
      </section>
    </div>

    <div v-else-if="!userStore.isLoggedIn" class="st-app st-app--auth">
      <section class="st-auth-hero">
        <p class="st-auth-hero__brand">Smart Todo</p>
        <h1 class="st-auth-hero__title">无法自动登录</h1>
        <p class="st-pad-auth__message">{{ authError || '暂时无法获取 PAD 账号信息' }}</p>
        <button type="button" class="st-pad-auth__retry" @click="restoreSession">重新获取</button>
      </section>
    </div>

    <H5TodoWorkspace v-else @unauthorized="reauthenticate" />
  </div>
</template>
