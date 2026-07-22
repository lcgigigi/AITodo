<script setup lang="ts">
import { onMounted } from 'vue'
import H5LoginView from './components/H5LoginView.vue'
import H5Toast from './components/H5Toast.vue'
import { useH5Auth } from './composables/useH5Auth'
import H5TodoWorkspace from './H5TodoWorkspace.vue'

const { userStore, isBootstrapping, isAuthenticating, authError, restoreSession, login, logout } =
  useH5Auth()

onMounted(() => {
  void restoreSession()
})

async function handleLogin(payload: { username: string; password: string }) {
  await login(payload.username, payload.password)
}
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

    <H5LoginView
      v-else-if="!userStore.isLoggedIn"
      :loading="isAuthenticating"
      :error="authError"
      @submit="handleLogin"
    />

    <H5TodoWorkspace v-else @unauthorized="logout" />
  </div>
</template>
