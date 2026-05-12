import { ref } from 'vue'

export function useRequest<T>(service: () => Promise<T>) {
  const data = ref<T>()
  const loading = ref(false)
  const error = ref<Error | null>(null)

  async function run() {
    loading.value = true
    error.value = null

    try {
      data.value = await service()
      return data.value
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      throw error.value
    } finally {
      loading.value = false
    }
  }

  return {
    data,
    loading,
    error,
    run,
  }
}
