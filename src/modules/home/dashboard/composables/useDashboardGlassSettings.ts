import { computed } from 'vue'

export type DashboardGlassSettings = {
  blur: number
  saturate: number
  baseOpacity: number
  highlightOpacity: number
  gradientStart: number
  gradientEnd: number
  borderOpacity: number
}

export const DASHBOARD_GLASS_SETTINGS: DashboardGlassSettings = {
  blur: 40,
  saturate: 2,
  baseOpacity: 0.6,
  highlightOpacity: 0,
  gradientStart: 0,
  gradientEnd: 0,
  borderOpacity: 0,
}

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

const dashboardGlassStyle = buildDashboardGlassStyle(DASHBOARD_GLASS_SETTINGS)

export function useDashboardGlassSettings() {
  const glassStyle = computed(() => dashboardGlassStyle)

  return {
    glassStyle,
  }
}
