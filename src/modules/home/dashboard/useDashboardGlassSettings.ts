import { computed, ref, watch } from 'vue'

export type DashboardGlassSettings = {
  blur: number
  saturate: number
  baseOpacity: number
  highlightOpacity: number
  gradientStart: number
  gradientEnd: number
  borderOpacity: number
}

export const DASHBOARD_GLASS_STORAGE_KEY = 'dashboard-glass-settings'
const LEGACY_GLASS_STORAGE_KEY = 'dashboard-topbar-glass-settings'

export const DEFAULT_DASHBOARD_GLASS_SETTINGS: DashboardGlassSettings = {
  blur: 24,
  saturate: 1.16,
  baseOpacity: 0.18,
  highlightOpacity: 0.7,
  gradientStart: 0.28,
  gradientEnd: 0.2,
  borderOpacity: 0.64,
}

function loadDashboardGlassSettings(): DashboardGlassSettings {
  try {
    const raw =
      localStorage.getItem(DASHBOARD_GLASS_STORAGE_KEY) ??
      localStorage.getItem(LEGACY_GLASS_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_DASHBOARD_GLASS_SETTINGS }
    return { ...DEFAULT_DASHBOARD_GLASS_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_DASHBOARD_GLASS_SETTINGS }
  }
}

const glassSettings = ref<DashboardGlassSettings>(loadDashboardGlassSettings())

watch(
  glassSettings,
  (value) => {
    localStorage.setItem(DASHBOARD_GLASS_STORAGE_KEY, JSON.stringify(value))
  },
  { deep: true },
)

export function buildDashboardGlassStyle(settings: DashboardGlassSettings) {
  return {
    '--glass-blur': `${settings.blur}px`,
    '--glass-saturate': String(settings.saturate),
    '--glass-base-opacity': String(settings.baseOpacity),
    '--glass-highlight-opacity': String(settings.highlightOpacity),
    '--glass-gradient-start': String(settings.gradientStart),
    '--glass-gradient-end': String(settings.gradientEnd),
    '--glass-border-opacity': String(settings.borderOpacity),
  }
}

export function useDashboardGlassSettings() {
  const glassStyle = computed(() => buildDashboardGlassStyle(glassSettings.value))

  function resetGlassSettings() {
    glassSettings.value = { ...DEFAULT_DASHBOARD_GLASS_SETTINGS }
  }

  return {
    glassSettings,
    glassStyle,
    resetGlassSettings,
  }
}
