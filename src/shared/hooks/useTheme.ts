import { storeToRefs } from 'pinia'
import { useThemeStore } from '@/stores/theme.store'

export function useTheme() {
  const themeStore = useThemeStore()

  return {
    ...storeToRefs(themeStore),
    setPrimaryColor: themeStore.setPrimaryColor,
    setDarkMode: themeStore.setDarkMode,
    setCompact: themeStore.setCompact,
  }
}
